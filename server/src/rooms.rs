//! Room registry: seats, tokens, fan-out and expiry. Pure bookkeeping, no I/O.
use crate::protocol::{LobbyPlayer, ServerMsg};
use serde_json::Value;
use std::collections::HashMap;
use std::time::{Duration, Instant};
use tokio::sync::mpsc;

pub const MAX_SEATS: usize = 4;
pub const ROOM_TTL: Duration = Duration::from_secs(10 * 60);
const CODE_ALPHABET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

pub type Tx = mpsc::UnboundedSender<ServerMsg>;

#[derive(Debug)]
pub struct Seat {
    pub id: String,
    pub token: String,
    pub name: String,
    pub is_host: bool,
    pub tx: Option<Tx>,
}

#[derive(Debug, Default)]
pub struct Room {
    pub code: String,
    pub seats: Vec<Seat>,
    /// Last `state` broadcast by the host, replayed to reconnecting seats.
    pub last_state: Option<(Value, Value)>,
    pub last_activity: Option<Instant>,
}

impl Room {
    pub fn lobby(&self) -> Vec<LobbyPlayer> {
        self.seats
            .iter()
            .map(|s| LobbyPlayer {
                id: s.id.clone(),
                name: s.name.clone(),
                connected: s.tx.is_some(),
                is_host: s.is_host,
            })
            .collect()
    }

    pub fn host(&self) -> Option<&Seat> {
        self.seats.iter().find(|s| s.is_host)
    }

    pub fn seat_by_token(&mut self, token: &str) -> Option<&mut Seat> {
        self.seats.iter_mut().find(|s| s.token == token)
    }

    pub fn seat_by_id(&self, id: &str) -> Option<&Seat> {
        self.seats.iter().find(|s| s.id == id)
    }

    pub fn connected(&self) -> usize {
        self.seats.iter().filter(|s| s.tx.is_some()).count()
    }

    /// Send to every connected seat except `except`.
    pub fn broadcast(&self, msg: &ServerMsg, except: Option<&str>) {
        for s in &self.seats {
            if Some(s.id.as_str()) == except {
                continue;
            }
            if let Some(tx) = &s.tx {
                let _ = tx.send(msg.clone());
            }
        }
    }

    pub fn send_to(&self, id: &str, msg: ServerMsg) {
        if let Some(tx) = self.seat_by_id(id).and_then(|s| s.tx.as_ref()) {
            let _ = tx.send(msg);
        }
    }

    pub fn broadcast_lobby(&self) {
        self.broadcast(&ServerMsg::Lobby { players: self.lobby() }, None);
    }
}

#[derive(Debug)]
pub enum RoomError {
    NoSuchRoom,
    RoomFull,
    BadToken,
    NameTaken,
}

impl std::fmt::Display for RoomError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            RoomError::NoSuchRoom => "room not found",
            RoomError::RoomFull => "room is full",
            RoomError::BadToken => "unknown seat",
            RoomError::NameTaken => "name already taken",
        };
        f.write_str(s)
    }
}

impl std::error::Error for RoomError {}

#[derive(Debug, Default)]
pub struct Registry {
    pub rooms: HashMap<String, Room>,
}

pub struct Joined {
    pub player_id: String,
    pub seat_token: String,
    pub is_host: bool,
}

fn random_u64() -> u64 {
    rand::random::<u64>()
}

pub fn random_code() -> String {
    let mut n = random_u64();
    (0..4)
        .map(|_| {
            let c = CODE_ALPHABET[(n % CODE_ALPHABET.len() as u64) as usize] as char;
            n /= CODE_ALPHABET.len() as u64;
            c
        })
        .collect()
}

pub fn random_token() -> String {
    format!("{:016x}{:016x}", random_u64(), random_u64())
}

fn short_id() -> String {
    format!("{:08x}", random_u64() as u32)
}

fn clean_name(name: &str, fallback: &str) -> String {
    let n: String = name.trim().chars().take(12).collect();
    if n.is_empty() {
        fallback.to_string()
    } else {
        n
    }
}

impl Registry {
    pub fn create(&mut self, name: &str, tx: Tx) -> (String, Joined) {
        let mut code = random_code();
        while self.rooms.contains_key(&code) {
            code = random_code();
        }
        let seat = Seat {
            id: short_id(),
            token: random_token(),
            name: clean_name(name, "Host"),
            is_host: true,
            tx: Some(tx),
        };
        let joined = Joined {
            player_id: seat.id.clone(),
            seat_token: seat.token.clone(),
            is_host: true,
        };
        let room = Room {
            code: code.clone(),
            seats: vec![seat],
            last_state: None,
            last_activity: Some(Instant::now()),
        };
        self.rooms.insert(code.clone(), room);
        (code, joined)
    }

    pub fn join(&mut self, code: &str, name: &str, tx: Tx) -> Result<Joined, RoomError> {
        let room = self.rooms.get_mut(code).ok_or(RoomError::NoSuchRoom)?;
        if room.seats.len() >= MAX_SEATS {
            return Err(RoomError::RoomFull);
        }
        let name = clean_name(name, "Player");
        if room.seats.iter().any(|s| s.name.eq_ignore_ascii_case(&name)) {
            return Err(RoomError::NameTaken);
        }
        let seat = Seat {
            id: short_id(),
            token: random_token(),
            name,
            is_host: false,
            tx: Some(tx),
        };
        let joined = Joined {
            player_id: seat.id.clone(),
            seat_token: seat.token.clone(),
            is_host: false,
        };
        room.seats.push(seat);
        room.last_activity = Some(Instant::now());
        Ok(joined)
    }

    /// Reattach a socket to an existing seat.
    pub fn reconnect(&mut self, code: &str, token: &str, tx: Tx) -> Result<Joined, RoomError> {
        let room = self.rooms.get_mut(code).ok_or(RoomError::NoSuchRoom)?;
        let seat = room.seat_by_token(token).ok_or(RoomError::BadToken)?;
        seat.tx = Some(tx);
        let joined = Joined {
            player_id: seat.id.clone(),
            seat_token: seat.token.clone(),
            is_host: seat.is_host,
        };
        room.last_activity = Some(Instant::now());
        Ok(joined)
    }

    pub fn detach(&mut self, code: &str, player_id: &str) {
        if let Some(room) = self.rooms.get_mut(code) {
            if let Some(seat) = room.seats.iter_mut().find(|s| s.id == player_id) {
                seat.tx = None;
            }
            room.last_activity = Some(Instant::now());
        }
    }

    /// Drop rooms that have had no connected seat for longer than the TTL.
    pub fn gc(&mut self, now: Instant) -> usize {
        let before = self.rooms.len();
        self.rooms.retain(|_, r| {
            r.connected() > 0
                || r
                    .last_activity
                    .map(|t| now.duration_since(t) < ROOM_TTL)
                    .unwrap_or(false)
        });
        before - self.rooms.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tx() -> (Tx, mpsc::UnboundedReceiver<ServerMsg>) {
        mpsc::unbounded_channel()
    }

    #[test]
    fn codes_are_four_unambiguous_chars() {
        for _ in 0..200 {
            let c = random_code();
            assert_eq!(c.len(), 4);
            assert!(c.bytes().all(|b| CODE_ALPHABET.contains(&b)), "{c}");
        }
        assert_ne!(random_token(), random_token());
    }

    #[test]
    fn create_join_reconnect_and_full() {
        let mut reg = Registry::default();
        let (htx, _hrx) = tx();
        let (code, host) = reg.create("  Akhil  ", htx);
        assert!(host.is_host);
        assert_eq!(reg.rooms[&code].host().unwrap().name, "Akhil");

        let mut joined = vec![];
        for n in ["Kajal", "Ravi", "Neha"] {
            let (t, _r) = tx();
            joined.push(reg.join(&code, n, t).unwrap());
        }
        let (t, _r) = tx();
        assert!(matches!(reg.join(&code, "Five", t), Err(RoomError::RoomFull)));
        let (t, _r) = tx();
        assert!(matches!(reg.join("ZZZZ", "X", t), Err(RoomError::NoSuchRoom)));

        // Drop a joiner, lobby shows disconnected, reconnect restores it.
        reg.detach(&code, &joined[0].player_id);
        let lobby = reg.rooms[&code].lobby();
        assert!(!lobby.iter().find(|p| p.name == "Kajal").unwrap().connected);
        let (t, _r) = tx();
        let again = reg.reconnect(&code, &joined[0].seat_token, t).unwrap();
        assert_eq!(again.player_id, joined[0].player_id);
        assert!(reg.rooms[&code].lobby().iter().find(|p| p.name == "Kajal").unwrap().connected);
        let (t, _r) = tx();
        assert!(matches!(reg.reconnect(&code, "nope", t), Err(RoomError::BadToken)));
    }

    #[test]
    fn duplicate_names_rejected() {
        let mut reg = Registry::default();
        let (htx, _) = tx();
        let (code, _) = reg.create("A", htx);
        let (t, _) = tx();
        assert!(matches!(reg.join(&code, "a", t), Err(RoomError::NameTaken)));
    }

    #[test]
    fn broadcast_skips_sender_and_disconnected() {
        let mut reg = Registry::default();
        let (htx, mut hrx) = tx();
        let (code, host) = reg.create("H", htx);
        let (jtx, mut jrx) = tx();
        let j = reg.join(&code, "J", jtx).unwrap();
        let (ktx, mut krx) = tx();
        let k = reg.join(&code, "K", ktx).unwrap();
        reg.detach(&code, &k.player_id);
        reg.rooms[&code].broadcast(&ServerMsg::Pong, Some(&host.player_id));
        assert!(hrx.try_recv().is_err());
        assert!(matches!(jrx.try_recv(), Ok(ServerMsg::Pong)));
        assert!(krx.try_recv().is_err());
        let _ = j;
    }

    #[test]
    fn gc_expires_only_empty_old_rooms() {
        let mut reg = Registry::default();
        let (htx, _hrx) = tx();
        let (live, _) = reg.create("H", htx);
        let (t2, _r2) = tx();
        let (dead, d) = reg.create("H2", t2);
        reg.detach(&dead, &d.player_id);
        reg.rooms.get_mut(&dead).unwrap().last_activity = Some(Instant::now() - ROOM_TTL - Duration::from_secs(1));
        assert_eq!(reg.gc(Instant::now()), 1);
        assert!(reg.rooms.contains_key(&live));
        assert!(!reg.rooms.contains_key(&dead));
    }
}
