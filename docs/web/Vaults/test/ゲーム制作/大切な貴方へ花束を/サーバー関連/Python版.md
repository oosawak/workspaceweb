# Unity Web API サーバー構築資料 — Python版

## 1. 目的

Unity製ゲームからWeb APIを経由して、プレイヤーのセーブデータをサーバーへ保存・取得する。

本資料では以下の構成を使用する。

- Unity
- HTTP / HTTPS
- JSON
- Python
- FastAPI
- SQLite

将来的には以下への拡張も想定する。

- ユーザー登録
- ログイン
- 認証
- インベントリ
- ランキング
- 対戦履歴
- WebSocketによるリアルタイム通信

---

# 2. システム構成

```text
Unity
  │
  │ HTTP / HTTPS
  │ JSON
  ▼
Python FastAPI Server
  │
  ▼
SQLite
```

セーブ時：

```text
Unity
 ↓
JSON生成
 ↓
POST /api/save
 ↓
FastAPI
 ↓
SQLite
```

ロード時：

```text
Unity
 ↓
GET /api/load/player001
 ↓
FastAPI
 ↓
SQLite
 ↓
JSON
 ↓
Unity
```

---

# 3. 必要環境

Python 3.11以上を推奨。

確認：

```bash
python --version
```

または：

```bash
python3 --version
```

---

# 4. Pythonプロジェクト作成

例：

```text
unity-game-server/
├── server.py
├── requirements.txt
└── game.db
```

`game.db` は初回実行時に自動生成する。

---

# 5. ライブラリのインストール

```bash
pip install fastapi uvicorn
```

`requirements.txt`

```txt
fastapi
uvicorn
```

インストール：

```bash
pip install -r requirements.txt
```

---

# 6. Pythonサーバー

`server.py`

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import sqlite3

app = FastAPI()

DB_PATH = "game.db"


class SaveData(BaseModel):
    user_id: str
    level: int
    gold: int
    position_x: float
    position_y: float


def init_db():
    conn = sqlite3.connect(DB_PATH)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS saves (
            user_id TEXT PRIMARY KEY,
            level INTEGER NOT NULL,
            gold INTEGER NOT NULL,
            position_x REAL NOT NULL,
            position_y REAL NOT NULL
        )
    """)

    conn.commit()
    conn.close()


init_db()


@app.get("/")
def root():
    return {
        "status": "ok",
        "message": "Unity Game API Server"
    }


@app.post("/api/save")
def save_game(data: SaveData):
    conn = sqlite3.connect(DB_PATH)

    conn.execute("""
        INSERT INTO saves (
            user_id,
            level,
            gold,
            position_x,
            position_y
        )
        VALUES (?, ?, ?, ?, ?)

        ON CONFLICT(user_id)
        DO UPDATE SET
            level = excluded.level,
            gold = excluded.gold,
            position_x = excluded.position_x,
            position_y = excluded.position_y
    """, (
        data.user_id,
        data.level,
        data.gold,
        data.position_x,
        data.position_y
    ))

    conn.commit()
    conn.close()

    return {
        "success": True
    }


@app.get("/api/load/{user_id}")
def load_game(user_id: str):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    row = conn.execute("""
        SELECT
            user_id,
            level,
            gold,
            position_x,
            position_y
        FROM saves
        WHERE user_id = ?
    """, (user_id,)).fetchone()

    conn.close()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="save_not_found"
        )

    return dict(row)
```

---

# 7. サーバー起動

```bash
uvicorn server:app --host 0.0.0.0 --port 3000
```

起動後：

```text
http://localhost:3000
```

にアクセスする。

FastAPIには自動APIドキュメント機能がある。

```text
http://localhost:3000/docs
```

ブラウザから直接APIをテストできる。

---

# 8. API仕様

## サーバー確認

```http
GET /
```

レスポンス例：

```json
{
  "status": "ok",
  "message": "Unity Game API Server"
}
```

---

## セーブ

```http
POST /api/save
```

送信JSON：

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

## ロード

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

# 9. Unity側データクラス

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

# 10. Unity API通信

`GameApi.cs`

```csharp
using System.Collections;
using System.Text;
using UnityEngine;
using UnityEngine.Networking;

public class GameApi : MonoBehaviour
{
    private string apiUrl = "http://localhost:3000";

    public void Save()
    {
        GameSaveData data = new GameSaveData
        {
            user_id = "player001",
            level = 12,
            gold = 3500,
            position_x = 120.5f,
            position_y = 42.1f
        };

        StartCoroutine(SaveGame(data));
    }


    private IEnumerator SaveGame(GameSaveData data)
    {
        string json = JsonUtility.ToJson(data);

        byte[] body =
            Encoding.UTF8.GetBytes(json);

        using UnityWebRequest request =
            new UnityWebRequest(
                apiUrl + "/api/save",
                UnityWebRequest.kHttpVerbPOST
            );

        request.uploadHandler =
            new UploadHandlerRaw(body);

        request.downloadHandler =
            new DownloadHandlerBuffer();

        request.SetRequestHeader(
            "Content-Type",
            "application/json"
        );

        yield return request.SendWebRequest();

        if (request.result ==
            UnityWebRequest.Result.Success)
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
                + request.responseCode
                + " "
                + request.error
            );
        }
    }


    public void Load()
    {
        StartCoroutine(
            LoadGame("player001")
        );
    }


    private IEnumerator LoadGame(string userId)
    {
        string url =
            apiUrl + "/api/load/" + userId;

        using UnityWebRequest request =
            UnityWebRequest.Get(url);

        yield return request.SendWebRequest();

        if (request.result ==
            UnityWebRequest.Result.Success)
        {
            string json =
                request.downloadHandler.text;

            GameSaveData data =
                JsonUtility.FromJson<GameSaveData>(
                    json
                );

            Debug.Log(
                "Level: " + data.level
            );

            Debug.Log(
                "Gold: " + data.gold
            );

            Debug.Log(
                "Position: "
                + data.position_x
                + ", "
                + data.position_y
            );
        }
        else
        {
            Debug.LogError(
                "Load Error: "
                + request.responseCode
                + " "
                + request.error
            );
        }
    }
}
```

---

# 11. Unityから利用

GameObjectへ`GameApi.cs`を追加する。

保存：

```csharp
Save();
```

読み込み：

```csharp
Load();
```

UI Buttonの`OnClick`から呼び出してもよい。

---

# 12. LAN上のサーバーへ接続

PythonサーバーのIPが：

```text
192.168.1.100
```

ならUnity側を：

```csharp
private string apiUrl =
    "http://192.168.1.100:3000";
```

に変更する。

---

# 13. SQLite構造

```text
game.db

saves
├── user_id
├── level
├── gold
├── position_x
└── position_y
```

将来的には：

```text
users
saves
inventory
match_results
rankings
rooms
```

などに分離する。

---

# 14. 本番向けAPI案

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

# 15. 認証

本番環境では単純に：

```text
/api/load/player001
```

とするべきではない。

他人が`player001`を指定してデータを取得できるためである。

ログイン後にトークンを発行する。

```text
Unity
 │
 ▼
POST /api/v1/auth/login
 │
 ▼
Access Token
 │
 ▼
Authorization: Bearer xxxxxxxxx
 │
 ▼
GET /api/v1/save
```

---

# 16. チート対策

Unityから送られてきた値を無条件で信用しない。

例えば：

```json
{
  "gold": 999999999
}
```

をそのまま保存できる設計は危険。

特に以下はサーバー側で検証する。

- 所持金
- 経験値
- レベル
- アイテム
- 対戦結果
- ダメージ
- ランキング
- 報酬

比較的クライアントを信用してよいもの：

- 音量設定
- キー設定
- UI設定
- キャラクター外見
- セーブ地点

---

# 17. WebSocketへの拡張

通常の保存処理：

```text
Unity
 ↓
HTTP API
 ↓
FastAPI
```

リアルタイム通信：

```text
Unity
 ↓
WebSocket
 ↓
FastAPI
```

用途：

- プレイヤー位置
- マッチング
- ルーム
- 対戦
- チャット
- リアルタイムイベント

---

# 18. Python版のメリット

- 実装が簡単
- コード量が少ない
- 開発速度が速い
- FastAPIの自動ドキュメントが便利
- JSON APIを作りやすい
- SQLiteとの連携が簡単
- デバッグしやすい

ゲームサーバーの試作には非常に適している。

---

# 19. Python版の注意点

非常に大量の同時接続やリアルタイム処理では、Rustなどより負荷が高くなる可能性がある。

ただし、

- 学校内ゲーム
- 小規模オンラインゲーム
- 数十～数百人規模
- セーブデータ管理
- ランキング
- ターン制ゲーム

などであれば十分実用的。

---

# 20. 推奨開発順序

```text
Phase 1
FastAPI起動

Phase 2
SQLite保存

Phase 3
UnityからSave / Load

Phase 4
ユーザー登録

Phase 5
ログイン・認証

Phase 6
ランキング

Phase 7
ルーム

Phase 8
WebSocket

Phase 9
オンライン対戦
```

---

# 21. まとめ

最初の構成としては：

```text
Unity
 ↓
UnityWebRequest
 ↓
HTTP / JSON
 ↓
Python FastAPI
 ↓
SQLite
```

が非常にシンプルで開発しやすい。

まずFastAPIでセーブ・ロードを完成させ、その後認証、ランキング、WebSocketを追加していく構成を推奨する。
