# PdfCraft連携

WorkspaceWebは [PdfCraft](https://github.com/storytold/pdfcraft) の公式Webリリース v0.7.1 を同梱しています。PrintCraftはPdfCraftへ改名されました。Web版はMIT LicenseまたはApache License 2.0で提供されています。

## MindZJ側の連携

- PdfCraftの公式 `?host=parent` 通信機能を使い、Vault内で選択したPDFを中央ペインで開きます。
- 元のファイル名で保存すると、同じVaultパスへ保存します。
- 別名保存はPdfCraftからブラウザーのダウンロードとして保存します。
- ライセンス画面に上流プロジェクト、MIT/Apacheライセンス、NOTICE、素材帰属情報へのリンクを表示します。

## 同梱物とライセンス

`public/pdfcraft` と `docs/web/pdfcraft` に公式Webビルド、ライセンス、NOTICE、素材帰属情報を置いています。MindZJの統合コードはWorkspaceWebのAGPL-3.0-or-laterに従います。PdfCraft本体のライセンスやArtCraftのブランド条件は変わりません。

アップデート確認とWeb成果物の取得には [`scripts/update-craft-web.sh`](../scripts/update-craft-web.sh) を使います。
