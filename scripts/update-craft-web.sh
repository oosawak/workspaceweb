#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:---check}"
if [[ "$MODE" != "--check" && "$MODE" != "--update" ]]; then
  echo "Usage: $0 [--check|--update]" >&2
  exit 2
fi

for command in curl jq unzip sha256sum; do
  command -v "$command" >/dev/null || { echo "Missing required command: $command" >&2; exit 1; }
done

MANIFEST="$ROOT/scripts/craft-web-versions.json"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
UPDATED="$TMP/craft-web-versions.json"
cp "$MANIFEST" "$UPDATED"
FOUND_UPDATE=0
GRIDCRAFT_UPDATED=0

update_one() {
  local slug="$1" repo="$2" pattern="$3"
  local release tag asset url digest current stage public_dir pages_dir commit notice
  release="$TMP/$slug-release.json"
  curl -fsSL "https://api.github.com/repos/$repo/releases/latest" -o "$release"
  tag="$(jq -r '.tag_name' "$release")"
  [[ -n "$tag" && "$tag" != "null" ]] || { echo "Could not read latest release for $repo" >&2; exit 1; }
  asset="$(jq -r --arg pattern "$pattern" '.assets[] | select(.name | test($pattern)) | .name' "$release" | head -n 1)"
  url="$(jq -r --arg name "$asset" '.assets[] | select(.name == $name) | .browser_download_url' "$release")"
  digest="$(jq -r --arg name "$asset" '.assets[] | select(.name == $name) | .digest // ""' "$release")"
  [[ -n "$asset" && -n "$url" ]] || { echo "No matching web release archive for $repo ($pattern)" >&2; exit 1; }
  [[ "$digest" == sha256:* ]] || { echo "GitHub did not provide a SHA-256 digest for $asset; refusing an unverifiable update." >&2; exit 1; }
  current="$(jq -r --arg slug "$slug" '.[$slug].version // "not recorded"' "$MANIFEST")"
  printf '%-12s local %-10s latest %s\n' "$slug" "$current" "$tag"
  [[ "$current" == "$tag" ]] || FOUND_UPDATE=1
  if [[ "$slug" == gridcraft && "$current" != "$tag" ]]; then GRIDCRAFT_UPDATED=1; fi
  commit="$(curl -fsSL "https://api.github.com/repos/$repo/commits/$tag" | jq -r '.sha')"
  if [[ "$MODE" == "--check" || "$current" == "$tag" ]]; then return; fi

  echo "Downloading $asset"
  curl -fL --retry 2 "$url" -o "$TMP/$asset"
  local expected actual
  expected="${digest#sha256:}"
  actual="$(sha256sum "$TMP/$asset" | cut -d ' ' -f 1)"
  [[ "$actual" == "$expected" ]] || { echo "SHA-256 mismatch for $asset" >&2; exit 1; }
  stage="$TMP/$slug-stage"
  mkdir -p "$stage"
  unzip -q "$TMP/$asset" -d "$stage"
  [[ -f "$stage/index.html" ]] || { echo "Archive does not contain a root index.html: $asset" >&2; exit 1; }
  public_dir="$ROOT/public/$slug"
  pages_dir="$ROOT/docs/web/$slug"
  mkdir -p "$public_dir" "$pages_dir"
  cp -a "$stage/." "$public_dir/"
  cp -a "$stage/." "$pages_dir/"
  if [[ "$slug" == photocraft || "$slug" == gridcraft ]]; then
    if ! grep -q 'mindzj-loader.js' "$public_dir/index.html"; then
      sed -i '/<\/body>/i\  <script src="./mindzj-loader.js"></script>' "$public_dir/index.html"
    fi
    cp "$ROOT/scripts/$slug-mindzj-loader.js" "$public_dir/mindzj-loader.js"
    cp "$public_dir/index.html" "$pages_dir/index.html"
    cp "$public_dir/mindzj-loader.js" "$pages_dir/mindzj-loader.js"
  fi
  if [[ "$slug" == pdfcraft ]]; then
    find "$public_dir" "$pages_dir" -maxdepth 1 -type f -name 'printcraft-web-*' -delete
    rm -f "$public_dir/MINDZJ-PATCH.diff" "$pages_dir/MINDZJ-PATCH.diff"
  elif [[ "$slug" == photocraft ]]; then
    rm -f "$public_dir/MINDZJ-CJK-PATCH.diff" "$pages_dir/MINDZJ-CJK-PATCH.diff" "$public_dir/CRAFT-FONTS-ATTRIBUTION.md" "$pages_dir/CRAFT-FONTS-ATTRIBUTION.md"
  fi
  local source_js source_wasm
  source_js="$(find "$stage" -maxdepth 1 -type f -name '*-web-*.js' | head -n 1)"
  source_wasm="$(find "$stage" -maxdepth 1 -type f -name '*-web-*_bg.wasm' | head -n 1)"
  [[ -n "$source_js" && -n "$source_wasm" ]] || { echo "Could not locate the WebAssembly app files in $asset" >&2; exit 1; }
  find "$public_dir" "$pages_dir" -maxdepth 1 -type f \( -name 'photocraft-web-*' -o -name 'pdfcraft-web-*' -o -name 'gridcraft-web-*' \) ! -name "$(basename "$source_js")" ! -name "$(basename "$source_wasm")" -delete
  curl -fsSL "https://raw.githubusercontent.com/$repo/$tag/ATTRIBUTION.md" -o "$public_dir/ATTRIBUTION.md"
  cp "$public_dir/ATTRIBUTION.md" "$pages_dir/ATTRIBUTION.md"
  if curl -fsSL "https://raw.githubusercontent.com/$repo/$tag/NOTICE" -o "$public_dir/NOTICE"; then
    cp "$public_dir/NOTICE" "$pages_dir/NOTICE"
  else
    rm -f "$public_dir/NOTICE" "$pages_dir/NOTICE"
  fi
  case "$slug" in
    photocraft)
      notice="PhotoCraft Web $tag is based on the official $repo release. MindZJ adds mindzj-loader.js and a script tag in index.html to pass selected Vault images to PhotoCraft and return same-name saves to the original Vault path. MindZJ integration code is AGPL-3.0-or-later; PhotoCraft's upstream license and ArtCraft trademark terms are unchanged. See ATTRIBUTION.md."
      ;;
    pdfcraft)
      notice="PdfCraft Web $tag is based on the official $repo release (PrintCraft is the former project name). MindZJ uses PdfCraft's ?host=parent message bridge to open Vault PDFs and write same-name saves back. MindZJ integration code is AGPL-3.0-or-later; PdfCraft's upstream license and ArtCraft trademark terms are unchanged. See ATTRIBUTION.md."
      ;;
    gridcraft)
      notice="GridCraft Web $tag is based on the official $repo release. MindZJ adds mindzj-loader.js and a script tag in index.html to transfer Vault spreadsheets and same-name saves. MindZJ integration code is AGPL-3.0-or-later; GridCraft's upstream license and ArtCraft trademark terms are unchanged. See ATTRIBUTION.md."
      ;;
  esac
  printf '# MindZJ integration notice\n\n%s\n' "$notice" > "$public_dir/MINDZJ-BUNDLE-NOTICE.md"
  cp "$public_dir/MINDZJ-BUNDLE-NOTICE.md" "$pages_dir/MINDZJ-BUNDLE-NOTICE.md"
  jq --arg slug "$slug" --arg repo "$repo" --arg version "$tag" --arg asset "$asset" \
    --arg commit "$commit" \
    '.[$slug] = {repository:$repo, version:$version, asset:$asset, commit:$commit}' "$UPDATED" > "$TMP/manifest-next.json"
  mv "$TMP/manifest-next.json" "$UPDATED"
}

update_one photocraft storytold/photocraft 'photocraft-web-.*\.zip$'
update_one pdfcraft storytold/pdfcraft 'pdfcraft-web-.*\.zip$'
update_one gridcraft storytold/gridcraft 'gridcraft-web-.*\.zip$'

if [[ "$MODE" == "--update" && "$FOUND_UPDATE" == 1 ]]; then
  cp "$UPDATED" "$MANIFEST"
  jq 'with_entries(.value |= {version, commit})' "$UPDATED" > "$ROOT/public/craft-web-versions.json"
  cp "$ROOT/public/craft-web-versions.json" "$ROOT/docs/web/craft-web-versions.json"
  if [[ "$GRIDCRAFT_UPDATED" == 1 ]]; then
    "$ROOT/scripts/build-gridcraft-japanese.sh"
  fi
  echo "Updated craft Web bundles in public/ and docs/web/. Review the versioned licenses and integration notices before publishing."
elif [[ "$MODE" == "--check" && "$FOUND_UPDATE" == 1 ]]; then
  echo "An upstream Web release is available. Run $0 --update to download and sync it."
elif [[ "$MODE" == "--check" ]]; then
  echo "All recorded craft Web versions are current."
else
  echo "No craft Web bundle needed an update."
fi
