//! Tauri shell: boots the LAN relay inside the app process and points the
//! webview at it, so the host phone is just another client of the same server
//! that friends reach over Wi-Fi.
use ludo_server::{build_state, router, spawn_gc, Args};
use std::net::{IpAddr, SocketAddr};

pub const PORT: u16 = 7878;

fn start_server() {
    std::thread::Builder::new()
        .name("ludo-server".into())
        .spawn(|| {
            let rt = tokio::runtime::Builder::new_multi_thread()
                .worker_threads(2)
                .enable_all()
                .build()
                .expect("tokio runtime");
            rt.block_on(async {
                let args = Args {
                    port: PORT,
                    bind: IpAddr::from([0, 0, 0, 0]),
                    advertise: None,
                };
                let app = build_state(&args);
                spawn_gc(app.clone());
                let addr = SocketAddr::new(args.bind, args.port);
                let listener = tokio::net::TcpListener::bind(addr)
                    .await
                    .expect("bind 0.0.0.0:7878");
                tracing::info!(
                    "ludo server on http://{}:{} (LAN {})",
                    args.bind,
                    args.port,
                    app.advertise
                );
                axum::serve(listener, router(app)).await.expect("serve");
            });
        })
        .expect("spawn server thread");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("ludo_server=info".parse().unwrap()),
        )
        .try_init();
    start_server();
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
