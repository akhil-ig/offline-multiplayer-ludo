//! Offline Multiplayer Ludo — LAN relay and static server.
//! Serves the built UI (embedded at compile time) and a WebSocket relay at /ws.
pub mod protocol;
pub mod rooms;
pub mod ws;

use axum::{
    extract::{ws::WebSocketUpgrade, Path, State},
    http::{header, StatusCode, Uri},
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use clap::Parser;
use rooms::Registry;
use rust_embed::Embed;
use serde::Serialize;
use std::net::IpAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;
use tracing::info;

#[derive(Embed)]
#[folder = "../ui/dist/"]
struct Assets;

#[derive(Parser, Debug, Clone)]
#[command(
    name = "ludo-server",
    about = "LAN relay + static server for Offline Multiplayer Ludo"
)]
pub struct Args {
    /// Port to listen on.
    #[arg(long, default_value_t = 7878)]
    pub port: u16,
    /// Bind address.
    #[arg(long, default_value = "0.0.0.0")]
    pub bind: IpAddr,
    /// Override the advertised LAN address in join URLs (auto-detected by default).
    #[arg(long)]
    pub advertise: Option<IpAddr>,
}

pub struct AppState {
    pub registry: Mutex<Registry>,
    pub advertise: IpAddr,
    pub port: u16,
}

impl AppState {
    pub fn join_url(&self, code: &str) -> String {
        format!("http://{}:{}/?room={}", self.advertise, self.port, code)
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Info {
    ip: String,
    port: u16,
    join_base: String,
    rooms: usize,
    version: &'static str,
}

/// Best-effort LAN address. Android 11+ restricts some interface enumeration,
/// so a failure falls back to the wildcard and the host can type the IP manually.
pub fn detect_lan_ip() -> IpAddr {
    if let Ok(ip) = local_ip_address::local_ip() {
        return ip;
    }
    if let Ok(ifs) = local_ip_address::list_afinet_netifas() {
        if let Some((_, ip)) = ifs
            .into_iter()
            .find(|(_, ip)| ip.is_ipv4() && !ip.is_loopback())
        {
            return ip;
        }
    }
    IpAddr::from([0, 0, 0, 0])
}

pub fn router(app: Arc<AppState>) -> Router {
    Router::new()
        .route("/ws", get(ws_upgrade))
        .route("/api/info", get(info))
        .route("/", get(index))
        .route("/{*path}", get(static_file))
        .with_state(app)
}

async fn ws_upgrade(ws: WebSocketUpgrade, State(app): State<Arc<AppState>>) -> Response {
    ws.on_upgrade(move |socket| ws::handle(socket, app))
}

async fn info(State(app): State<Arc<AppState>>) -> Json<Info> {
    let rooms = app.registry.lock().await.rooms.len();
    Json(Info {
        ip: app.advertise.to_string(),
        port: app.port,
        join_base: format!("http://{}:{}/", app.advertise, app.port),
        rooms,
        version: env!("CARGO_PKG_VERSION"),
    })
}

async fn index() -> Response {
    serve("index.html")
}

async fn static_file(Path(path): Path<String>, _uri: Uri) -> Response {
    match Assets::get(&path) {
        Some(_) => serve(&path),
        // SPA fallback: unknown paths render the app (query strings carry room codes).
        None => serve("index.html"),
    }
}

fn serve(path: &str) -> Response {
    match Assets::get(path) {
        Some(file) => {
            let mime = mime_guess::from_path(path).first_or_octet_stream();
            let cache = if path.starts_with("assets/") {
                "public, max-age=31536000, immutable"
            } else {
                "no-cache"
            };
            (
                [
                    (header::CONTENT_TYPE, mime.as_ref().to_string()),
                    (header::CACHE_CONTROL, cache.to_string()),
                ],
                file.data.into_owned(),
            )
                .into_response()
        }
        None => (StatusCode::NOT_FOUND, "not found").into_response(),
    }
}

pub fn build_state(args: &Args) -> Arc<AppState> {
    let advertise = args.advertise.unwrap_or_else(detect_lan_ip);
    Arc::new(AppState {
        registry: Mutex::new(Registry::default()),
        advertise,
        port: args.port,
    })
}

pub fn spawn_gc(app: Arc<AppState>) {
    tokio::spawn(async move {
        let mut tick = tokio::time::interval(Duration::from_secs(60));
        loop {
            tick.tick().await;
            let removed = app.registry.lock().await.gc(Instant::now());
            if removed > 0 {
                info!(removed, "expired rooms");
            }
        }
    });
}
