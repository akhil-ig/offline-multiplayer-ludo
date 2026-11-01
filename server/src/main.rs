use clap::Parser;
use ludo_server::{build_state, router, spawn_gc, Args};
use std::net::SocketAddr;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("ludo_server=info".parse().unwrap()),
        )
        .init();
    let args = Args::parse();
    let app = build_state(&args);
    spawn_gc(app.clone());
    let addr = SocketAddr::new(args.bind, args.port);
    let listener = tokio::net::TcpListener::bind(addr).await.expect("bind");
    println!(
        "Ludo server listening on http://{}:{}  (LAN: http://{}:{})",
        args.bind, args.port, app.advertise, args.port
    );
    axum::serve(listener, router(app)).await.expect("serve");
}
