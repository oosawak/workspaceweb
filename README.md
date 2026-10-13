<h1 align="center">MindZJWeb</h1>

<p align="center">
  MindZJ の Markdown Vault を、ブラウザーから閲覧・編集する Web 版です。
</p>

MindZJWeb には、サーバー上の Vault を複数の端末から利用する Web サーバー版と、
GitHub Pages で動くブラウザーデモがあります。Web サーバー版では、Vault を通常の
ファイルとしてサーバーに保存します。ブラウザーデモはサーバーを使わず、編集内容を
利用者のブラウザー内に保存します。

## GitHub Pages デモ

[MindZJWeb を開く](https://oosawak.github.io/mindzjweb/web/)

Pages 版では、サンプル Vault のノートやリソースを閲覧できます。ノートの作成・編集や
設定は、アクセスしたブラウザーのローカルストレージに保存されます。公開中のサンプル
ファイルは変更されず、別のブラウザーや端末とは共有されません。Rust サーバーは不要です。

## 主な機能

- Markdown ノートの閲覧、編集、ソース表示
- Wiki リンク、検索、アウトライン、カレンダー
- 日報・議事録の作成と一覧表示
- 画像、PDF、音声、動画、HTML、3D データなどのリソース管理
- `.url` ファイルのリンクをアプリ内で表示（Ctrl/Cmd を押しながらクリックすると外部ブラウザーで開く）
- 画像の表示と PhotoCraft による編集
- PDFのPdfCraft編集、表計算ファイルのGridCraft編集とVaultへの保存
- 音声・動画・3D データのプレビュー
- 複数端末からサーバー上の同じ Vault を利用（Web サーバー版）
- Web サーバー版での Markdown ノート共同編集と自動保存

## 共同編集（Web サーバー版）

Web サーバー版では、同じ Vault の同じ Markdown ノートを複数のブラウザーで開くと、編集内容がほかの参加者へリアルタイムに同期されます。共同編集ノートの入力内容はサーバー上の Vault に自動保存されるため、通常の保存ボタンや `Ctrl+S` で保存する必要はありません。保存状態はエディター上部に表示されます。

共同編集は Rust サーバーへ接続している Web サーバー版で利用できます。GitHub Pages のブラウザーデモでは共同編集されず、変更は各ブラウザー内に保存されます。

## 開発環境で起動

Node.js 22 以上、Rust stable が必要です。

### 1. 依存関係をインストール

```bash
npm ci
```

### 2. Web UI を起動

```bash
npm run dev -- --host 0.0.0.0
```

開発用 HTTPS の URL は次のとおりです。

- ローカル: <https://localhost:1430/>
- 同じネットワーク上の端末: `https://SERVER_IP:1430/`

自己署名証明書の警告が表示された場合は、開発環境として証明書を許可してください。
スクリーンショットなど一部のブラウザー機能は HTTPS または localhost でのみ利用できます。

### 3. Rust API サーバーを起動

別のターミナルで実行します。

```bash
MINDZJ_BIND=0.0.0.0 \
MINDZJ_PORT=3000 \
MINDZJ_VAULT=/absolute/path/to/Vaults/test \
cargo run -p mindzj --bin mindzj-server
```

Web UI は `1430`、Rust API サーバーは `3000` で起動します。`MINDZJ_VAULT` を省略
すると、Welcome 画面からサーバー上の Vault フォルダーを選択できます。

## 本番ビルド

```bash
npm ci
npm run build:web
```

Ubuntu で HTTPS、認証、systemd を設定して運用する手順は、[Web サーバーのデプロイ手順](docs/mindzjweb/WEB_SERVER_DEPLOYMENT_JA.md)を参照してください。

## 関連資料

- [MindZJ の日本語 README](docs/README_JA.md)
- [MindZJWeb の詳細](docs/mindzjweb.md)
- [PhotoCraft・PdfCraft・GridCraftの更新手順](docs/CRAFT_WEB_UPDATES_JA.md)
- [Ubuntu サーバーへのデプロイ手順](docs/mindzjweb/WEB_SERVER_DEPLOYMENT_JA.md)
- [Google Group 対応 MindZJ の企業利用検討資料](docs/mindzjweb/MINDZJ_GOOGLE_GROUP_BUSINESS_PROPOSAL_JA.md)

## セキュリティ

Web サーバーは、設定によっては認証なしで Vault を読み書きできます。信頼できる
ネットワーク内で使用し、公開インターネットへ直接公開しないでください。本番環境では
HTTPS、認証、ファイアウォール、バックアップを設定してください。

## ライセンス

MindZJWeb 本体は AGPL-3.0-or-later で提供しています（別途商用ライセンスを取得した場合を除きます）。
Web サービスとして運用する場合も、AGPL の条件に従ってください。

PhotoCraft、PdfCraft、GridCraftには、それぞれの上流ライセンスと著作権表示が適用されます。上流ライセンス、NOTICE、素材の帰属情報、MindZJの連携内容は `public/<craft>/` と `docs/web/<craft>/` に置いてあり、アプリ内の「ライセンス」画面からも確認できます。
