#!/bin/sh
# Builds "Cabinet of War.app" (WKWebView shell, like Orison Command Table). Run from outputs/app.
set -e
cd "$(dirname "$0")"
OUT="${1:-$HOME/Applications}"
APP="$OUT/Cabinet of War.app"
SRC="$(cd .. && pwd)"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/web"
swiftc -O -o "$APP/Contents/MacOS/CabinetOfWar" CabinetOfWar.swift
cp CabinetOfWar.icns "$APP/Contents/Resources/CabinetOfWar.icns"
cp "$SRC/cabinet-of-war.html" "$APP/Contents/Resources/web/"
for d in tiles1740 realms1740 paint cities; do mkdir -p "$APP/Contents/Resources/web/$d"; rsync -a --exclude "*.jpg" "$SRC/$d/" "$APP/Contents/Resources/web/$d/"; done
cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>Cabinet of War</string>
  <key>CFBundleDisplayName</key><string>Cabinet of War</string>
  <key>CFBundleExecutable</key><string>CabinetOfWar</string>
  <key>CFBundleIdentifier</key><string>local.cabinetofwar.desk</string>
  <key>CFBundleIconFile</key><string>CabinetOfWar</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>NSPrincipalClass</key><string>NSApplication</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>LSApplicationCategoryType</key><string>public.app-category.strategy-games</string>
</dict></plist>
PLIST
codesign --force --deep --sign - "$APP" >/dev/null 2>&1 || true
echo "Built $APP"
