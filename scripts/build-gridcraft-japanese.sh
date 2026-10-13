#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="$ROOT/scripts/craft-web-versions.json"
VERSION="$(jq -r '.gridcraft.version' "$MANIFEST")"
COMMIT="$(jq -r '.gridcraft.commit' "$MANIFEST")"
FONT_COMMIT="3d9ab3a132ed0eff457e424226a435a901da30d3"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

git clone --depth 1 --branch "$VERSION" https://github.com/storytold/gridcraft.git "$TMP/gridcraft"
git -C "$TMP/gridcraft" fetch --depth 1 origin "$COMMIT"
git -C "$TMP/gridcraft" checkout --detach FETCH_HEAD
git clone --no-checkout https://github.com/storytold/craft-fonts.git "$TMP/craft-fonts"
git -C "$TMP/craft-fonts" fetch --depth 1 origin "$FONT_COMMIT"
git -C "$TMP/craft-fonts" checkout --detach FETCH_HEAD

patch -d "$TMP/gridcraft" -p1 < "$ROOT/scripts/gridcraft-japanese-font.patch"
FONT_DIR="$TMP/gridcraft/crates/ui-egui/assets/fonts"
mkdir -p "$FONT_DIR"
cp "$TMP/craft-fonts/fonts/biz-ud-pgothic/BIZUDPGothic-Regular.ttf" "$FONT_DIR/"

DIST="$TMP/web"
(cd "$TMP/gridcraft/apps/gridcraft-web" && env -u NO_COLOR trunk build --release --dist "$DIST" --public-url ./)

for DEST in "$ROOT/public/gridcraft" "$ROOT/docs/web/gridcraft"; do
  find "$DEST" -maxdepth 1 -type f \( -name 'gridcraft-web-*.js' -o -name 'gridcraft-web-*_bg.wasm' \) -delete
  cp "$DIST"/gridcraft-web-*.js "$DIST"/gridcraft-web-*_bg.wasm "$DEST/"
  cp "$DIST/index.html" "$DEST/index.html"
  sed -i '/<\/body>/i\\  <script src="./mindzj-loader.js?v=japanese-font-1"></script>' "$DEST/index.html"
  cp "$TMP/gridcraft/NOTICE" "$DEST/NOTICE"
  cat >> "$DEST/NOTICE" <<EOF

MindZJ Web build: embeds BIZ UDPGothic Regular, licensed under the SIL Open Font License 1.1. See OFL-BIZUDPGothic.txt and CRAFT-FONTS-ATTRIBUTION.md.
EOF
  cp "$TMP/craft-fonts/fonts/biz-ud-pgothic/OFL.txt" "$DEST/OFL-BIZUDPGothic.txt"
  cat > "$DEST/CRAFT-FONTS-ATTRIBUTION.md" <<EOF
# Embedded font attribution

GridCraft Web $VERSION embeds **BIZ UDPGothic Regular** in its WebAssembly to render Japanese spreadsheet cell text when the browser has no Japanese system font.

- Copyright: The BIZ UDGothic Project Authors (Morisawa Inc.)
- Source: [googlefonts/morisawa-biz-ud-gothic](https://github.com/googlefonts/morisawa-biz-ud-gothic/tree/18934af56b9c003ca58c54bffbf226848cb11032)
- Font source bundle: [storytold/craft-fonts@$FONT_COMMIT](https://github.com/storytold/craft-fonts/tree/$FONT_COMMIT)
- License: SIL Open Font License 1.1, included as [OFL-BIZUDPGothic.txt](OFL-BIZUDPGothic.txt)
- Font SHA-256: 258d7156c165f2ff774b6efee637c22c3b950de0d8a10e501137061bc8085d01

The MindZJ integration patch adds the embedded font to GridCraft's Japanese glyph fallback chain. GridCraft's UI language remains English.
EOF
  cat > "$DEST/MINDZJ-BUNDLE-NOTICE.md" <<EOF
# MindZJ integration notice

GridCraft Web $VERSION is based on the official \`storytold/gridcraft\` source at commit $COMMIT. MindZJ adds \`mindzj-loader.js\` to transfer Vault spreadsheets and same-name saves and embeds BIZ UDPGothic Regular so Japanese cell data renders in browsers without Japanese system fonts. The MindZJ integration patch and loader are maintained under AGPL-3.0-or-later; GridCraft's upstream license is unchanged. The font is under SIL Open Font License 1.1; see \`OFL-BIZUDPGothic.txt\` and \`CRAFT-FONTS-ATTRIBUTION.md\`.
EOF
done
