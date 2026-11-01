//! Wire protocol. Mirrors ui/src/net/protocol.ts. Game state and events are
//! opaque JSON here: the relay never interprets them.
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LobbyPlayer {
    pub id: String,
    pub name: String,
    pub connected: bool,
    pub is_host: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum ClientMsg {
    Create {
        name: String,
    },
    Join {
        code: String,
        name: String,
    },
    Reconnect {
        code: String,
        seat_token: String,
    },
    Intent {
        action: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        token: Option<u32>,
    },
    State {
        state: Value,
        events: Value,
        seats: Value,
    },
    Hint {
        kind: String,
        color: String,
    },
    Ping,
}

#[derive(Debug, Clone, Serialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum ServerMsg {
    Welcome {
        code: String,
        player_id: String,
        seat_token: String,
        is_host: bool,
        join_url: String,
    },
    Lobby {
        players: Vec<LobbyPlayer>,
    },
    Intent {
        from: String,
        action: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        token: Option<u32>,
    },
    State {
        state: Value,
        events: Value,
        seats: Value,
    },
    Hint {
        kind: String,
        color: String,
    },
    Error {
        message: String,
    },
    Pong,
}

impl ServerMsg {
    pub fn error(message: impl Into<String>) -> Self {
        ServerMsg::Error {
            message: message.into(),
        }
    }
}
