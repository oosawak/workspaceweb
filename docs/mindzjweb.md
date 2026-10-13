# WorkspaceWeb

オフラインノートをWebでつかえるようにしました。

WorkspaceWeb serves the existing SolidJS interface and uses the MindZJ Rust
kernel to access a Markdown vault on the server. Vault files remain ordinary
files on disk.

## Build

From the repository root, build the web UI and server binary:

```bash
npm install
npm run build:web
```

For a production Ubuntu deployment with HTTPS, Basic authentication, systemd,
and GitHub clone/update steps, see [WEB_SERVER_DEPLOYMENT_JA.md](mindzjweb/WEB_SERVER_DEPLOYMENT_JA.md).

## GitHub Pages demo

GitHub Pages builds the actual MindZJ web interface in browser demo mode and
serves it at <https://oosawak.github.io/mindzjweb/web/>. The Rust server is not
needed for this demo. Sample Vault files are copied to `docs/web/Vaults/`;
visitors can create and edit notes, which are saved in that browser's local
storage and do not change the published Vault. Before publishing Vault updates,
run `npm run sync:pages-vault`; hidden `.mindzj` settings, plugins, and snapshots
are excluded. The workflow builds the app and deploys the whole `docs/` folder.
Enable GitHub Pages once in repository **Settings → Pages**, using **GitHub
Actions** as the source.

## Run

Start the server from the repository root:

```bash
MINDZJ_BIND=0.0.0.0 \
MINDZJ_PORT=3000 \
cargo run -p mindzj --bin mindzj-server
```

The welcome screen lists subfolders of `Vaults` under the server's working
directory. With the server started from `/home/oosawak/Workspace/mindzj`, the
standard parent folder is `/home/oosawak/Workspace/mindzj/Vaults`. Use
**Select Vaults Server** to enter a different server-side parent folder. New
Vaults are created under the currently selected parent folder.

Then open `http://SERVER_IP:3000/` in a browser on the same network. To open a
Vault outside `Vaults`, enter its server-side path on the welcome screen.

The default bind address is `127.0.0.1`; set `MINDZJ_BIND=0.0.0.0` to allow
connections from other devices. `MINDZJ_PORT` defaults to `3000`.

## Security

The web server currently has no login or authentication. It can open and
modify any vault path that the server process can access. Keep it on a trusted
private network and do not expose it directly to the public internet. The
kernel validates vault-relative paths and rejects traversal and symlink escapes.
