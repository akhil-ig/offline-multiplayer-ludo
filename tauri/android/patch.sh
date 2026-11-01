#!/usr/bin/env bash
# Run after `cargo tauri android init`. Installs the network security config so
# the WebView may reach the embedded server on 127.0.0.1, and declares the
# permissions the LAN server needs. Idempotent.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$HERE/../gen/android/app/src/main"
MANIFEST="$APP/AndroidManifest.xml"
test -f "$MANIFEST" || { echo "manifest not found at $MANIFEST (run cargo tauri android init first)"; exit 1; }

mkdir -p "$APP/res/xml"
cp "$HERE/network_security_config.xml" "$APP/res/xml/network_security_config.xml"

if ! grep -q 'android:networkSecurityConfig' "$MANIFEST"; then
  sed -i 's|<application|<application android:networkSecurityConfig="@xml/network_security_config"|' "$MANIFEST"
fi
for perm in android.permission.INTERNET android.permission.ACCESS_NETWORK_STATE android.permission.ACCESS_WIFI_STATE android.permission.VIBRATE; do
  if ! grep -q "$perm" "$MANIFEST"; then
    sed -i "s|<application|<uses-permission android:name=\"$perm\" />\n    <application|" "$MANIFEST"
  fi
done
# Keep the game portrait.
if ! grep -q 'android:screenOrientation' "$MANIFEST"; then
  sed -i 's|<activity|<activity android:screenOrientation="portrait"|' "$MANIFEST"
fi
echo "android manifest patched"
