#!/usr/bin/env bash
# Build an unsigned iOS IPA for SideStore (macOS only).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Optional Sentry SDK is linked, but CI has no Sentry org/auth for source map upload.
export SENTRY_DISABLE_AUTO_UPLOAD=true

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This script must run on macOS (use GitHub Actions if you are on Windows)." >&2
  exit 1
fi

if [[ -z "${EXPO_PUBLIC_SUPABASE_URL:-}" || -z "${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}" ]]; then
  echo "Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY before building." >&2
  exit 1
fi

echo "Generating native iOS project..."
npx expo prebuild --platform ios --non-interactive --no-install

echo "Patching Podfile for unsigned build..."
python3 scripts/patch-podfile-unsigned.py

echo "Installing CocoaPods dependencies..."
cd ios
pod install
cd "$ROOT"

WORKSPACE="$(find ios -maxdepth 1 -name '*.xcworkspace' | head -n 1)"
PROJECT="$(find ios -maxdepth 1 -name '*.xcodeproj' | head -n 1)"
SCHEME="$(basename "$PROJECT" .xcodeproj)"

if [[ -z "$WORKSPACE" || -z "$PROJECT" ]]; then
  echo "Could not find Xcode workspace/project under ios/." >&2
  exit 1
fi

DERIVED="$ROOT/ios-build"
rm -rf "$DERIVED"

echo "Building Release app for iOS device (${SCHEME})..."
xcodebuild \
  -workspace "$WORKSPACE" \
  -scheme "$SCHEME" \
  -configuration Release \
  -sdk iphoneos \
  -derivedDataPath "$DERIVED" \
  CODE_SIGN_IDENTITY="" \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGNING_ALLOWED=NO \
  DEVELOPMENT_TEAM=""

APP_PATH="$(find "$DERIVED/Build/Products/Release-iphoneos" -maxdepth 1 -name '*.app' | head -n 1)"
if [[ -z "$APP_PATH" || ! -d "$APP_PATH" ]]; then
  echo "Build finished but no .app was produced." >&2
  exit 1
fi

OUTPUT_DIR="$ROOT/dist/ios"
IPA_PATH="$OUTPUT_DIR/weigh-way.ipa"
rm -rf "$OUTPUT_DIR/Payload"
mkdir -p "$OUTPUT_DIR/Payload"
cp -R "$APP_PATH" "$OUTPUT_DIR/Payload/"

cd "$OUTPUT_DIR"
rm -f weigh-way.ipa
zip -0 -y -r weigh-way.ipa Payload
cd "$ROOT"

echo "IPA ready: $IPA_PATH"
