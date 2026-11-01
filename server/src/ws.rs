//! One task per WebSocket. The first message must be `create`, `join` or
//! `reconnect`; afterwards the socket relays intents, state and hints.
use crate::protocol::{ClientMsg, ServerMsg};
use crate::rooms::{Joined, RoomError};
use crate::AppState;
use axum::extract::ws::{Message, WebSocket};
use futures_util::{SinkExt, StreamExt};
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{debug, info, warn};

fn ser(msg: &ServerMsg) -> Message {
    Message::Text(serde_json::to_string(msg).unwrap_or_default().into())
}

pub async fn handle(socket: WebSocket, app: Arc<AppState>) {
    let (mut sink, mut stream) = socket.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<ServerMsg>();

    // Outbound pump.
    let writer = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if sink.send(ser(&msg)).await.is_err() {
                break;
            }
        }
    });

    let mut session: Option<(String, Joined)> = None;

    while let Some(Ok(frame)) = stream.next().await {
        let text = match frame {
            Message::Text(t) => t,
            Message::Close(_) => break,
            _ => continue,
        };
        let msg: ClientMsg = match serde_json::from_str(text.as_str()) {
            Ok(m) => m,
            Err(e) => {
                let _ = tx.send(ServerMsg::error(format!("bad message: {e}")));
                continue;
            }
        };

        match (&session, msg) {
            (_, ClientMsg::Ping) => {
                let _ = tx.send(ServerMsg::Pong);
            }
            (None, hello) => {
                let mut reg = app.registry.lock().await;
                let result: Result<(String, Joined), RoomError> = match hello {
                    ClientMsg::Create { name } => {
                        let (code, j) = reg.create(&name, tx.clone());
                        Ok((code, j))
                    }
                    ClientMsg::Join { code, name } => {
                        let code = code.trim().to_ascii_uppercase();
                        reg.join(&code, &name, tx.clone()).map(|j| (code, j))
                    }
                    ClientMsg::Reconnect { code, seat_token } => {
                        let code = code.trim().to_ascii_uppercase();
                        reg.reconnect(&code, &seat_token, tx.clone()).map(|j| (code, j))
                    }
                    _ => {
                        let _ = tx.send(ServerMsg::error("say hello first (create/join/reconnect)"));
                        continue;
                    }
                };
                match result {
                    Ok((code, joined)) => {
                        info!(code, player = joined.player_id, host = joined.is_host, "seat attached");
                        let _ = tx.send(ServerMsg::Welcome {
                            code: code.clone(),
                            player_id: joined.player_id.clone(),
                            seat_token: joined.seat_token.clone(),
                            is_host: joined.is_host,
                            join_url: app.join_url(&code),
                        });
                        if let Some(room) = reg.rooms.get(&code) {
                            room.broadcast_lobby();
                            if let Some((state, seats)) = &room.last_state {
                                let _ = tx.send(ServerMsg::State {
                                    state: state.clone(),
                                    events: serde_json::Value::Array(vec![]),
                                    seats: seats.clone(),
                                });
                            }
                        }
                        session = Some((code, joined));
                    }
                    Err(e) => {
                        let _ = tx.send(ServerMsg::error(e.to_string()));
                    }
                }
            }
            (Some((code, me)), ClientMsg::Intent { action, token }) => {
                let reg = app.registry.lock().await;
                if let Some(room) = reg.rooms.get(code) {
                    if let Some(host) = room.host() {
                        room.send_to(
                            &host.id,
                            ServerMsg::Intent {
                                from: me.player_id.clone(),
                                action,
                                token,
                            },
                        );
                    }
                }
            }
            (Some((code, me)), ClientMsg::State { state, events, seats }) => {
                if !me.is_host {
                    let _ = tx.send(ServerMsg::error("only the host may publish state"));
                    continue;
                }
                let mut reg = app.registry.lock().await;
                if let Some(room) = reg.rooms.get_mut(code) {
                    room.last_state = Some((state.clone(), seats.clone()));
                    room.last_activity = Some(std::time::Instant::now());
                    room.broadcast(&ServerMsg::State { state, events, seats }, Some(&me.player_id));
                }
            }
            (Some((code, me)), ClientMsg::Hint { kind, color }) => {
                let reg = app.registry.lock().await;
                if let Some(room) = reg.rooms.get(code) {
                    room.broadcast(&ServerMsg::Hint { kind, color }, Some(&me.player_id));
                }
            }
            (Some(_), _) => {
                debug!("ignoring hello after session established");
            }
        }
    }

    if let Some((code, me)) = session {
        let mut reg = app.registry.lock().await;
        reg.detach(&code, &me.player_id);
        if let Some(room) = reg.rooms.get(&code) {
            room.broadcast_lobby();
        }
        info!(code, player = me.player_id, "seat detached");
    } else {
        warn!("socket closed before hello");
    }
    writer.abort();
}
