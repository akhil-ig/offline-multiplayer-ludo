# Tauri shell

Wraps the game as a native app. The Rust side starts the LAN relay from
`../server` on `0.0.0.0:7878` and the webview loads `http://127.0.0.1:7878`,
so the host phone is simply the first client of the server that friends join.

## Desktop (Linux/macOS/Windows)

```bash
cd ui && npm run build
cd ../tauri && npm ci && npx tauri build
```

## Android APK

Prerequisites: Android SDK + NDK, Java 17, Rust targets
(`rustup target add aarch64-linux-android armv7-linux-androideabi`).

```bash
cd ui && npm run build
cd ../tauri && npm ci
npx tauri icon icons/icon.png
npx tauri android init
./android/patch.sh                 # loopback cleartext + permissions + portrait
npx tauri android build --apk --target aarch64 --target armv7
```

The GitHub Actions `release.yml` workflow does exactly this on every `v*` tag,
signs the release APK and attaches it to the GitHub release. Add the secrets
`ANDROID_KEYSTORE_B64`, `ANDROID_KEYSTORE_PASSWORD` and `ANDROID_KEY_ALIAS` for a
stable signing key; without them each build uses a throwaway key, so a newer
build must be installed after uninstalling the previous one. The workflow can
also be run manually with a `release_tag` input to re-attach builds to an
existing release.

## Known Android caveats

- `local_ip_address` may fail to enumerate interfaces on Android 11+. The
  lobby then shows a `0.0.0.0` join URL and asks the host to read the phone's
  IP from Wi-Fi/hotspot settings; the room code still works once friends open
  `http://<ip>:7878`.
- The Android back button closes the app (no in-app navigation history).
