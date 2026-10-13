# Unity Web API サーバー構築資料 — Rust版

## 1. 目的

Unity製ゲームからWeb APIを使用してゲームデータをサーバーへ保存・取得する。

本資料では以下の構成を使用する。

- Unity
- HTTP / HTTPS
- JSON
- Rust
- Axum
- SQLite
- rusqlite

将来的には：

- ログイン
- セーブ
- インベントリ
- ランキング
- マッチング
- WebSocket
- リアルタイムオンライン対戦

へ拡張する。

---

# 2. システム構成

```text
Unity
  │
  │ HTTP / HTTPS
  │ JSON
  ▼
Rust / Axum
  │
  ▼
SQLite
```

保存：

```text
Unity
 ↓
JSON
 ↓
POST /api/save
 ↓
Axum
 ↓
rusqlite
 ↓
SQLite
```

読み込み：

```text
Unity
 ↓
GET /api/load/player001
 ↓
Axum
 ↓
SQLite
 ↓
JSON
 ↓
Unity
```

---

# 3. Rust環境

Rustをインストールする。

確認：

```bash
rustc --version
```

```bash
cargo --version
```

---

# 4. プロジェクト作成

```bash
cargo new unity-game-server
cd unity-game-server
```

構成：

```text
unity-game-server/
├── Cargo.toml
├── game.db
└── src/
    └── main.rs
```

`game.db`は自動生成する。

---

# 5. Cargo.toml

```toml
[package]
name = "unity-game-server"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = "0.8"
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
rusqlite = { version = "0.32", features = ["bundled"] }
```

---

# 6. Rustサーバー

`src/main.rs`

```rust
use axum::{
    extract::{Path, State},
    routing::{get, post},
    Json, Router,
};

use rusqlite::{
    params,
    Connection,
};

use serde::{
    Deserialize,
    Serialize,
};

use std::sync::{
    Arc,
    Mutex,
};


#[derive(Clone)]
struct AppState {
    db: Arc<Mutex<Connection>>,
}


#[derive(Debug, Serialize, Deserialize)]
struct SaveData {
    user_id: String,
    level: i32,
    gold: i32,
    position_x: f32,
    position_y: f32,
}


#[tokio::main]
async fn main() {

    let conn =
        Connection::open("game.db")
            .unwrap();


    conn.execute(
        "
        CREATE TABLE IF NOT EXISTS saves (
            user_id TEXT PRIMARY KEY,
            level INTEGER NOT NULL,
            gold INTEGER NOT NULL,
            position_x REAL NOT NULL,
            position_y REAL NOT NULL
        )
        ",
        [],
    )
    .unwrap();


    let state = AppState {
        db: Arc::new(
            Mutex::new(conn)
        ),
    };


    let app = Router::new()

        .route(
            "/",
            get(root)
        )

        .route(
            "/api/save",
            post(save_game)
        )

        .route(
            "/api/load/{user_id}",
            get(load_game)
        )

        .with_state(state);


    let listener =
        tokio::net::TcpListener::bind(
            "0.0.0.0:3000"
        )
        .await
        .unwrap();


    println!(
        "Server started: http://localhost:3000"
    );


    axum::serve(
        listener,
        app
    )
    .await
    .unwrap();
}


async fn root()
    -> Json<serde_json::Value>
{
    Json(
        serde_json::json!({
            "status": "ok",
            "message": "Unity Game API Server"
        })
    )
}


async fn save_game(

    State(state):
        State<AppState>,

    Json(data):
        Json<SaveData>,

) -> Json<serde_json::Value>
{

    let db =
        state.db
            .lock()
            .unwrap();


    db.execute(
        "
        INSERT INTO saves (
            user_id,
            level,
            gold,
            position_x,
            position_y
        )
        VALUES (?1, ?2, ?3, ?4, ?5)

        ON CONFLICT(user_id)
        DO UPDATE SET
            level = excluded.level,
            gold = excluded.gold,
            position_x = excluded.position_x,
            position_y = excluded.position_y
        ",
        params![
            data.user_id,
            data.level,
            data.gold,
            data.position_x,
            data.position_y
        ],
    )
    .unwrap();


    Json(
        serde_json::json!({
            "success": true
        })
    )
}


async fn load_game(

    State(state):
        State<AppState>,

    Path(user_id):
        Path<String>,

) -> Json<serde_json::Value>
{

    let db =
        state.db
            .lock()
            .unwrap();


    let result =
        db.query_row(

            "
            SELECT
                user_id,
                level,
                gold,
                position_x,
                position_y

            FROM saves

            WHERE user_id = ?1
            ",

            [user_id],

            |row| {

                Ok(
                    SaveData {
                        user_id:
                            row.get(0)?,

                        level:
                            row.get(1)?,

                        gold:
                            row.get(2)?,

                        position_x:
                            row.get(3)?,

                        position_y:
                            row.get(4)?,
                    }
                )
            },
        );


    match result {

        Ok(data) =>
            Json(
                serde_json::json!(
                    data
                )
            ),

        Err(_) =>
            Json(
                serde_json::json!({
                    "success": false,
                    "error":
                        "save_not_found"
                })
            ),
    }
}
```

---

# 7. サーバー起動

```bash
cargo run
```

起動：

```text
http://localhost:3000
```

---

# 8. API仕様

## サーバー確認

```http
GET /
```

レスポンス：

```json
{
  "status": "ok",
  "message": "Unity Game API Server"
}
```

---

# 9. セーブ

```http
POST /api/save
```

JSON：

```json
{
  "user_id": "player001",
  "level": 12,
  "gold": 3500,
  "position_x": 120.5,
  "position_y": 42.1
}
```

レスポンス：

```json
{
  "success": true
}
```

---

# 10. ロード

```http
GET /api/load/player001
```

レスポンス：

```json
{
  "user_id": "player001",
  "level": 12,
  "gold": 3500,
  "position_x": 120.5,
  "position_y": 42.1
}
```

---

# 11. Unity側

Unity側はPython版と基本的に同じである。

Unityから見るとサーバー内部がPythonなのかRustなのかは関係ない。

---

# 12. Unityデータクラス

`GameSaveData.cs`

```csharp
using System;

[Serializable]
public class GameSaveData
{
    public string user_id;
    public int level;
    public int gold;
    public float position_x;
    public float position_y;
}
```

---

# 13. Unity APIクライアント

`GameApi.cs`

```csharp
using System.Collections;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

public class GameApi : MonoBehaviour
{
    private string apiUrl =
        "http://localhost:3000";


    public void Save()
    {
        GameSaveData data =
            new GameSaveData
            {
                user_id =
                    "player001",

                level = 12,

                gold = 3500,

                position_x =
                    120.5f,

                position_y =
                    42.1f
            };


        StartCoroutine(
            SaveGame(data)
        );
    }


    private IEnumerator SaveGame(
        GameSaveData data
    )
    {

        string json =
            JsonUtility.ToJson(
                data
            );


        byte[] body =
            Encoding.UTF8.GetBytes(
                json
            );


        using UnityWebRequest request =
            new UnityWebRequest(
                apiUrl + "/api/save",
                UnityWebRequest.kHttpVerbPOST
            );


        request.uploadHandler =
            new UploadHandlerRaw(
                body
            );


        request.downloadHandler =
            new DownloadHandlerBuffer();


        request.SetRequestHeader(
            "Content-Type",
            "application/json"
        );


        yield return
            request.SendWebRequest();


        if (
            request.result ==
            UnityWebRequest.Result.Success
        )
        {
            Debug.Log(
                "Save OK: "
                + request.downloadHandler.text
            );
        }
        else
        {
            Debug.LogError(
                "Save Error: "
                + request.error
            );
        }
    }


    public void Load()
    {
        StartCoroutine(
            LoadGame(
                "player001"
            )
        );
    }


    private IEnumerator LoadGame(
        string userId
    )
    {

        string url =
            apiUrl
            + "/api/load/"
            + userId;


        using UnityWebRequest request =
            UnityWebRequest.Get(
                url
            );


        yield return
            request.SendWebRequest();


        if (
            request.result ==
            UnityWebRequest.Result.Success
        )
        {

            GameSaveData data =
                JsonUtility
                .FromJson<GameSaveData>(
                    request
                    .downloadHandler
                    .text
                );


            Debug.Log(
                "Level: "
                + data.level
            );


            Debug.Log(
                "Gold: "
                + data.gold
            );
        }
        else
        {
            Debug.LogError(
                "Load Error: "
                + request.error
            );
        }
    }
}
```

---

# 14. LAN接続

Rustサーバー：

```text
192.168.1.100
```

ならUnity側：

```csharp
private string apiUrl =
    "http://192.168.1.100:3000";
```

---

# 15. SQLite

初期：

```text
game.db
└── saves
```

将来的：

```text
game.db
├── users
├── saves
├── inventory
├── rooms
├── match_results
└── rankings
```

---

# 16. API拡張案

```text
POST /api/v1/auth/register
POST /api/v1/auth/login

GET  /api/v1/player
PUT  /api/v1/player

POST /api/v1/save
GET  /api/v1/save

GET  /api/v1/inventory
POST /api/v1/inventory

POST /api/v1/room/create
POST /api/v1/room/join

POST /api/v1/match/result

GET  /api/v1/ranking
```

---

# 17. 認証

本番環境ではユーザーIDだけでアクセスさせない。

```text
Unity
 │
 ▼
POST /api/v1/auth/login
 │
 ▼
Token
 │
 ▼
Authorization:
Bearer xxxxxxxxxxxxx
 │
 ▼
API
```

---

# 18. チート対策

以下をUnityに完全に任せない。

```text
Gold
EXP
Level
Damage
HP
Item
Match Result
Ranking
Reward
```

例えば：

```json
{
  "gold": 999999999
}
```

がUnityから送信されても、そのまま信用しない。

サーバー側で：

```text
現在値
+
正規に獲得した量
=
新しい値
```

と計算する。

---

# 19. WebSocket

AxumはWebSocketも扱える。

REST API：

```text
ログイン
セーブ
プロフィール
ランキング
```

WebSocket：

```text
プレイヤー位置
リアルタイム対戦
ルーム
チャット
ゲームイベント
```

と分けるとよい。

---

# 20. Rust版のメリット

- 高速
- メモリ効率が良い
- 高負荷に強い
- 多数接続に向いている
- コンパイル後は単一実行ファイルにしやすい
- サーバー配布が簡単
- 型安全性が高い
- 長期運用に向いている

---

# 21. Rust版の注意点

Pythonに比べると：

- コード量が増える
- 開発難易度が高い
- コンパイルが必要
- DBの非同期化などを考える必要がある

試作品をすぐ作る用途ではPythonの方が速い場合が多い。

---

# 22. SQLiteロックについて

今回のサンプルでは：

```rust
Arc<Mutex<Connection>>
```

を使用している。

これは学習・プロトタイプには分かりやすいが、本格運用ではDB接続を改善した方がよい。

候補：

```text
SQLx
SQLite connection pool
PostgreSQL
```

など。

---

# 23. 開発順序

```text
Phase 1
Axum起動

Phase 2
SQLite

Phase 3
Save / Load

Phase 4
Unity接続

Phase 5
ユーザー登録

Phase 6
ログイン

Phase 7
Token認証

Phase 8
ランキング

Phase 9
WebSocket

Phase 10
オンライン対戦
```

---

# 24. Python版との違い

```text
Python / FastAPI
    ↓
開発速度重視

Rust / Axum
    ↓
性能・長期運用重視
```

Unity側はどちらでもほぼ同じ。

```text
Unity
 ↓
HTTP / JSON
 ↓
API
```

という仕様を統一しておけば、途中で：

```text
Python
↓
Rust
```

へ移行することも可能。

---

# 25. 推奨方針

最初にゲームを完成させることを優先する場合：

```text
Unity
+
Python FastAPI
+
SQLite
```

で始める。

負荷が高くなった部分だけ、後からRustへ置き換える方法も有効。

最初から長期間運用する専用ゲームサーバーとして設計する場合：

```text
Unity
+
Rust Axum
+
SQLite / SQLx
```

も適している。

---

# 26. まとめ

基本構成：

```text
Unity
 ↓
UnityWebRequest
 ↓
HTTP / JSON
 ↓
Rust Axum
 ↓
SQLite
```

REST APIで：

```text
ログイン
セーブ
インベントリ
ランキング
```

を管理し、

WebSocketで：

```text
ルーム
対戦
同期
リアルタイムイベント
```

を処理する設計にすると、オンラインゲーム向けサーバーへ発展させやすい。
