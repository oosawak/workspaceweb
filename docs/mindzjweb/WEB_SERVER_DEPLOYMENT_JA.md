# WorkspaceWeb を Ubuntu サーバーで動かす

この手順では、GitHub の `main` を Ubuntu に clone し、WorkspaceWeb を
systemd で常時起動します。Web サーバーは `127.0.0.1:3000` のみで待ち受け、
Nginx が HTTPS と Basic 認証を担当します。Vault は clone したリポジトリ直下の
`Vaults/` に保存します。

公開 IP `160.251.214.180` を使い、Let's Encrypt の IP アドレス証明書を取得する
構成です。IP アドレス証明書は有効期間が約 6 日のため、Certbot の自動更新を
有効にします。Let's Encrypt は IP 証明書を発行していますが、短期証明書の
`shortlived` プロファイルが必要です。[Let's Encrypt の説明](https://letsencrypt.org/2026/01/15/6day-and-ip-general-availability)
Certbot も IP 指定オプションを提供しています。[Certbot のオプション](https://eff-certbot.readthedocs.io/en/stable/man/certbot.html)

## 1. サーバーへログイン

```bash
ssh <Ubuntuのユーザー名>@160.251.214.180
```

## 2. ビルドに必要なツールを入れる

```bash
sudo apt update
sudo apt install -y \
  git curl build-essential pkg-config libssl-dev \
  libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev \
  libwebkit2gtk-4.1-dev libxdo-dev nginx apache2-utils snapd
```

Node.js 20 以上と Rust stable toolchain も必要です。Node.js は組織で利用している
配布元からインストールし、Rust は rustup で入れます。

```bash
node --version
npm --version
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
. "$HOME/.cargo/env"
rustc --version
cargo --version
```

`node --version` が `v20` 以上であることを確認してください。

## 3. GitHub から clone してビルド

```bash
cd ~
git clone https://github.com/oosawak/workspaceweb.git workspaceweb
cd ~/workspaceweb
npm ci
npm run build
cargo build --release -p mindzj --bin mindzj-server
mkdir -p Vaults
```

本番では `cargo run` ではなく、release バイナリを systemd から起動します。

## 4. Web サーバーを systemd に登録

下の `<Ubuntuのユーザー名>` を SSH ログイン名に置き換えてください。

```bash
sudo tee /etc/systemd/system/mindzjweb.service >/dev/null <<'EOF'
[Unit]
Description=WorkspaceWeb server
After=network.target

[Service]
Type=simple
User=<Ubuntuのユーザー名>
WorkingDirectory=/home/<Ubuntuのユーザー名>/workspaceweb
Environment=MINDZJ_BIND=127.0.0.1
Environment=MINDZJ_PORT=3000
ExecStart=/home/<Ubuntuのユーザー名>/workspaceweb/target/release/mindzj-server
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
```

この例は clone 先を `/home/<Ubuntuのユーザー名>/workspaceweb` としています。別の
場所に clone した場合は `WorkingDirectory` と `ExecStart` を合わせてください。

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mindzjweb
sudo systemctl status mindzjweb
```

ログ確認:

```bash
sudo journalctl -u mindzjweb -f
```

## 5. Basic 認証を作成

公開 IP でアクセスできるため、認証を設定します。パスワード入力を求められます。

```bash
sudo htpasswd -cB /etc/nginx/.htpasswd-mindzjweb <ログイン名>
sudo chown root:www-data /etc/nginx/.htpasswd-mindzjweb
sudo chmod 640 /etc/nginx/.htpasswd-mindzjweb
sudo mkdir -p /var/www/certbot/.well-known/acme-challenge
```

## 6. HTTP-01 証明用の Nginx 設定を作る

最初に HTTP の証明用パスを有効にし、Let's Encrypt の証明書を取得します。

```bash
sudo tee /etc/nginx/sites-available/mindzjweb >/dev/null <<'EOF'
server {
    listen 80;
    server_name 160.251.214.180;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 404;
    }
}
EOF
sudo ln -s /etc/nginx/sites-available/mindzjweb /etc/nginx/sites-enabled/mindzjweb
sudo nginx -t
sudo systemctl reload nginx
```

既存の default site が port 80 を使っていて競合する場合は、不要な default site の
symlink を外してから Nginx を reload してください。

## 7. Certbot で IP 証明書を取得

Ubuntu 標準パッケージでは Certbot が古い場合があるため、snap 版を使います。

```bash
sudo snap install certbot --classic
sudo ln -sf /snap/bin/certbot /usr/local/bin/certbot
certbot --version
```

Certbot 5.8 以上であることを確認し、証明書を取得します。

```bash
sudo certbot certonly \
  --webroot -w /var/www/certbot \
  --ip-address 160.251.214.180 \
  --preferred-profile shortlived \
  --cert-name mindzjweb \
  --email <通知先メールアドレス> \
  --agree-tos --non-interactive
```

取得した証明書は `/etc/letsencrypt/live/mindzjweb/fullchain.pem` と
`/etc/letsencrypt/live/mindzjweb/privkey.pem` にあります。

## 8. HTTPS と Basic 認証を設定

```bash
sudo tee /etc/nginx/sites-available/mindzjweb >/dev/null <<'EOF'
server {
    listen 80;
    server_name 160.251.214.180;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name 160.251.214.180;

    ssl_certificate /etc/letsencrypt/live/mindzjweb/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mindzjweb/privkey.pem;
    client_max_body_size 128m;

    auth_basic "WorkspaceWeb";
    auth_basic_user_file /etc/nginx/.htpasswd-mindzjweb;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 300s;
    }
}
EOF
sudo nginx -t
sudo systemctl reload nginx
```

## 9. 証明書を自動更新

Certbot の systemd timer を有効にし、証明書が更新された後に Nginx を reload します。

```bash
sudo systemctl enable --now snap.certbot.renew.timer
sudo mkdir -p /etc/letsencrypt/renewal-hooks/deploy
sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx >/dev/null <<'EOF'
#!/bin/sh
systemctl reload nginx
EOF
sudo chmod 755 /etc/letsencrypt/renewal-hooks/deploy/reload-nginx
sudo certbot renew --dry-run
```

## 10. Firewall と接続確認

SSH を許可してから、HTTP 証明と HTTPS 用の port 80 / 443 を許可します。クラウド側の
security group や provider firewall も同じ port を許可してください。port 3000 は
外部に公開しません。

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw status
```

ブラウザーで `https://160.251.214.180/` を開き、Basic 認証のログイン名とパスワードを
入力します。Web 版の「Select Vaults Server」は標準の `Vaults` のまま使えます。
Vault は clone 先の `Vaults/` に保存され、ブラウザーやサーバーを再起動しても残ります。

## GitHub の更新を反映

```bash
cd ~/workspaceweb
git pull --ff-only
npm ci
npm run build
cargo build --release -p mindzj --bin mindzj-server
sudo systemctl restart mindzjweb
```

`Vaults/` のノートをバックアップしてから更新してください。Vault のバックアップは
GitHub ではなく、サーバー外の安全な保存先に別途取得します。
