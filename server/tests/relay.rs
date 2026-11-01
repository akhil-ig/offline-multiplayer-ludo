//! End-to-end relay behaviour over real WebSockets.
use futures_util::{SinkExt, StreamExt};
use ludo_server::{build_state, router, Args};
use serde_json::{json, Value};
use std::net::{IpAddr, SocketAddr};
use std::time::Duration;
use tokio::net::TcpListener;
use tokio_tungstenite::{connect_async, tungstenite::Message, MaybeTlsStream, WebSocketStream};

type Ws = WebSocketStream<MaybeTlsStream<tokio::net::TcpStream>>;

async fn start() -> SocketAddr {
    let args = Args {
        port: 0,
        bind: "127.0.0.1".parse().unwrap(),
        advertise: Some(IpAddr::from([127, 0, 0, 1])),
    };
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    let app = build_state(&Args {
        port: addr.port(),
        ..args
    });
    tokio::spawn(async move { axum::serve(listener, router(app)).await.unwrap() });
    addr
}

async fn connect(addr: SocketAddr) -> Ws {
    let (ws, _) = connect_async(format!("ws://{addr}/ws")).await.unwrap();
    ws
}

async fn send(ws: &mut Ws, v: Value) {
    ws.send(Message::Text(v.to_string().into())).await.unwrap();
}

async fn recv(ws: &mut Ws) -> Value {
    let msg = tokio::time::timeout(Duration::from_secs(3), ws.next())
        .await
        .expect("timeout")
        .unwrap()
        .unwrap();
    serde_json::from_str(msg.to_text().unwrap()).unwrap()
}

/// Reads until a message of the given type arrives (skipping unrelated ones).
async fn recv_type(ws: &mut Ws, ty: &str) -> Value {
    for _ in 0..10 {
        let v = recv(ws).await;
        if v["type"] == ty {
            return v;
        }
    }
    panic!("no {ty} message");
}

#[tokio::test]
async fn create_join_relay_reconnect() {
    let addr = start().await;

    // Host creates a room.
    let mut host = connect(addr).await;
    send(&mut host, json!({"type":"create","name":"Akhil"})).await;
    let w = recv_type(&mut host, "welcome").await;
    assert_eq!(w["isHost"], true);
    let code = w["code"].as_str().unwrap().to_string();
    assert_eq!(code.len(), 4);
    assert_eq!(
        w["joinUrl"],
        format!("http://127.0.0.1:{}/?room={}", addr.port(), code)
    );
    let lobby = recv_type(&mut host, "lobby").await;
    assert_eq!(lobby["players"].as_array().unwrap().len(), 1);

    // Joiner joins; both sides see a 2-player lobby.
    let mut joiner = connect(addr).await;
    send(
        &mut joiner,
        json!({"type":"join","code":code.to_lowercase(),"name":"Kajal"}),
    )
    .await;
    let jw = recv_type(&mut joiner, "welcome").await;
    assert_eq!(jw["isHost"], false);
    let joiner_id = jw["playerId"].as_str().unwrap().to_string();
    let joiner_token = jw["seatToken"].as_str().unwrap().to_string();
    let l = recv_type(&mut joiner, "lobby").await;
    assert_eq!(l["players"].as_array().unwrap().len(), 2);
    let l = recv_type(&mut host, "lobby").await;
    assert_eq!(l["players"][1]["name"], "Kajal");
    assert_eq!(l["players"][1]["connected"], true);

    // Joiner intent goes to the host only, stamped with the sender id.
    send(
        &mut joiner,
        json!({"type":"intent","action":"move","token":2}),
    )
    .await;
    let i = recv_type(&mut host, "intent").await;
    assert_eq!(i["from"], joiner_id);
    assert_eq!(i["action"], "move");
    assert_eq!(i["token"], 2);

    // Host state fans out to the joiner, not back to the host.
    send(
        &mut host,
        json!({"type":"state","state":{"turn":7},"events":[{"type":"rolled"}],"seats":{"x":"red"}}),
    )
    .await;
    let s = recv_type(&mut joiner, "state").await;
    assert_eq!(s["state"]["turn"], 7);
    assert_eq!(s["seats"]["x"], "red");
    send(&mut host, json!({"type":"ping"})).await;
    assert_eq!(recv(&mut host).await["type"], "pong"); // nothing else was queued for the host

    // Joiners may not publish state.
    send(
        &mut joiner,
        json!({"type":"state","state":{},"events":[],"seats":{}}),
    )
    .await;
    assert_eq!(
        recv_type(&mut joiner, "error").await["message"],
        "only the host may publish state"
    );

    // Hints relay to everyone else.
    send(
        &mut host,
        json!({"type":"hint","kind":"rolling","color":"red"}),
    )
    .await;
    assert_eq!(recv_type(&mut joiner, "hint").await["color"], "red");

    // Joiner drops: host sees connected=false. Reconnect restores the seat and replays the last state.
    joiner.close(None).await.unwrap();
    let l = recv_type(&mut host, "lobby").await;
    assert_eq!(l["players"][1]["connected"], false);
    let mut again = connect(addr).await;
    send(
        &mut again,
        json!({"type":"reconnect","code":code,"seatToken":joiner_token}),
    )
    .await;
    let w2 = recv_type(&mut again, "welcome").await;
    assert_eq!(w2["playerId"], joiner_id);
    let replay = recv_type(&mut again, "state").await;
    assert_eq!(replay["state"]["turn"], 7);
    assert_eq!(replay["events"].as_array().unwrap().len(), 0);
    let l = recv_type(&mut host, "lobby").await;
    assert_eq!(l["players"][1]["connected"], true);
}

#[tokio::test]
async fn bad_hello_and_unknown_room() {
    let addr = start().await;
    let mut ws = connect(addr).await;
    send(&mut ws, json!({"type":"join","code":"ZZZZ","name":"x"})).await;
    assert_eq!(
        recv_type(&mut ws, "error").await["message"],
        "room not found"
    );
    send(&mut ws, json!({"type":"intent","action":"roll"})).await;
    assert!(recv_type(&mut ws, "error").await["message"]
        .as_str()
        .unwrap()
        .contains("hello"));
    send(&mut ws, json!({"nonsense":1})).await;
    assert!(recv_type(&mut ws, "error").await["message"]
        .as_str()
        .unwrap()
        .contains("bad message"));
    send(
        &mut ws,
        json!({"type":"reconnect","code":"ZZZZ","seatToken":"t"}),
    )
    .await;
    assert_eq!(
        recv_type(&mut ws, "error").await["message"],
        "room not found"
    );
}

#[tokio::test]
async fn room_fills_at_four() {
    let addr = start().await;
    let mut host = connect(addr).await;
    send(&mut host, json!({"type":"create","name":"H"})).await;
    let code = recv_type(&mut host, "welcome").await["code"]
        .as_str()
        .unwrap()
        .to_string();
    let mut keep = vec![];
    for n in ["A", "B", "C"] {
        let mut j = connect(addr).await;
        send(&mut j, json!({"type":"join","code":code,"name":n})).await;
        assert_eq!(recv_type(&mut j, "welcome").await["isHost"], false);
        keep.push(j);
    }
    let mut extra = connect(addr).await;
    send(&mut extra, json!({"type":"join","code":code,"name":"D"})).await;
    assert_eq!(
        recv_type(&mut extra, "error").await["message"],
        "room is full"
    );
}
