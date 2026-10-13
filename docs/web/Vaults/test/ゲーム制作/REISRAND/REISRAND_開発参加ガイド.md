# REISRAND 開発参加ガイド

**Lore CLI + Unreal Multi-User Editing**
初回セットアップから日常作業・ブランチ運用まで

- 対象: Unreal Engine 5.8
- Lore Server: `10.214.72.199:41337`
- Multi-User Server: `10.214.72.199:50001`
- 前提: 同一 LAN
- 推奨プロジェクト保存先: `D:\UnrealProjects\REISRAND`
- 更新: 2026-09-30

> このガイドは現在の検証済み構成に基づきます。専用 PC のサーバー設定や共有先を変更する場合は、チームの管理担当に確認してください。

## 1. この開発環境でできること

| Lore | Multi-User | 専用 PC |
| --- | --- | --- |
| プロジェクトを Revision 単位で管理 | 同じ Level を複数人で同時編集 | Lore Server と Multi-User Server を提供 |
| `main` / `feature` ブランチで作業を分離 | Actor の移動・追加・Details の変更を即時同期 | IP: `10.214.72.199` |
| 変更を Commit して専用 PC へ Push | 共同編集結果は最後に Persist | メンバー側ではサーバーを起動しない |
| 他メンバーは Sync して同じ状態にする | 同じ Branch / Revision から参加 | Lore: `:41337` / Multi-User: `:50001` |

共有対象は `Content`、共通 `Config`、`Plugins` などです。Multi-User だけでは Lore の Revision は増えません。

## 2. 初回セットアップ

最初の 1 回だけ行います。以後は「Sync → Unreal 起動 → 参加」で始めます。

1. Lore CLI をインストールし、バージョンを確認する。
2. 専用 PC から `D:\UnrealProjects` へ REISRAND を Clone する。
3. `UserEngine.ini` に自分の IPv4 を設定する。
4. Unreal Engine 5.8 で Multi-User Editing を有効にする。
5. `REISRAND_Main` への接続を確認する。
6. Lore Revision をチームと揃えて共同編集を始める。

## 3. Lore CLI をインストールして REISRAND を取得

PowerShell は通常権限で使えます。Clone 先に既存の `REISRAND` フォルダーがある場合は、Clone コマンドを実行しないでください。

### Lore CLI のインストール

```powershell
irm https://raw.githubusercontent.com/EpicGames/lore/main/scripts/install.ps1 | iex
lore --version
```

現在の検証環境は Lore `0.10.0` 系です。`lore` が見つからない場合は PowerShell を開き直してください。インストール先の例は `C:\Users\<ユーザー>\bin\lore.exe` です。

### Clone

`member-name` は自分の識別名に置き換えます。Identity はメンバーごとに異なる名前を推奨します。

```powershell
cd D:\UnrealProjects
lore --identity "member-name" clone lore://10.214.72.199:41337/REISRAND "D:\UnrealProjects\REISRAND"
```

Clone 後に `D:\UnrealProjects\REISRAND` が作成されます。まず `lore status` で Branch と Revision を確認します。

## 4. PC 固有の Multi-User 設定

自分の IP アドレスは共有設定に入れず、`Config/UserEngine.ini` で設定します。

1. `ipconfig` を実行し、専用 PC と同じ LAN の IPv4 を確認します（例: `10.214.72.203`）。
2. `D:\UnrealProjects\REISRAND\Config\UserEngine.ini` を作成します。

```ini
[/Script/UdpMessaging.UdpMessagingSettings]
EnableTransport=True
UnicastEndpoint=10.214.72.xxx:0
MulticastEndpoint=230.0.0.1:50000
MulticastTimeToLive=1
+StaticEndpoints=10.214.72.199:50001
```

`10.214.72.xxx` を自分の IPv4 に置き換えます。Project Settings から IP を保存すると `DefaultEngine.ini` に入る可能性があるため、PC 固有の値は `UserEngine.ini` で管理してください。

## 5. Unreal Engine 5.8 で Multi-User に参加

1. `D:\UnrealProjects\REISRAND\REISRAND.uproject` を開きます。
2. Multi-User Browser で `REISRAND_Main` を選択して参加します。
3. 他のメンバーと同じ Level を開いて編集します。

表示名は各自で違う名前にします。`REISRAND_Main` が見えれば接続設定は成功です。

## 6. 毎日の作業開始フロー

Unreal を開く前に Lore を最新化し、全員が同じ Branch / Revision から始めます。Branch 切替や Sync の前に Editor を閉じてください。

```powershell
cd "D:\UnrealProjects\REISRAND"
lore status
lore sync
lore status
```

最後に `Local = Remote` になっていることを確認し、Unreal を起動して `REISRAND_Main` に参加します。

## 7. Multi-User 共同編集のルール

### 共同編集中

- 全員が同じ Branch / Revision で参加します。
- Actor の移動・追加・Details の変更はリアルタイムで同期されます。
- 他の人が編集中の同じ Asset を不用意に変更しません。
- Multi-User 参加中に Branch を切り替えません。
- サーバー PC の起動・停止は管理担当だけが行います。

### セッション終了時

1. Commit 担当者 1 人がセッションの変更を Persist します。
2. `lore status --scan` で差分を確認します。
3. Stage → Commit → Push します。
4. 他のメンバーは Commit 後に `lore sync` します。

**Multi-User の LIVE 編集は、まだ Lore の Revision ではありません。**

## 8. 変更を Lore へ保存

Multi-User で Persist した後、Lore CLI で差分を Revision として確定します。

```powershell
cd "D:\UnrealProjects\REISRAND"
lore status --scan
lore stage .
lore commit "Describe your change"
lore push
lore status
```

Push 後は `Local branch in sync with remote` になるのが期待状態です。UE5 の One File Per Actor では、Level 編集が `Content/__ExternalActors__/...` 内の `.uasset` として現れることがあります。これは正常です。

## 9. ブランチ運用

現在はブランチ作成・切替を CLI で行います。UEFN の Branch Explorer 相当 UI は未導入です。

```powershell
lore branch list
lore branch create feature/example
lore branch switch feature/example
lore status
```

- `feature/<作業名>` の形式で命名します。
- `main` を最新化してからブランチを作ります。
- ローカル変更がある状態で切り替えません。
- 切替前に Unreal Editor を閉じ、Multi-User の全員が同じ Branch に揃えます。
- `--reset` は自己判断で使わず、Merge は当面リードまたは担当者が行います。

## 10. Lore CLI 早見表

迷ったときはまず `status` を使います。破壊的な操作は、管理担当に確認せず実行しないでください。

| 目的 | コマンド | 意味 |
| --- | --- | --- |
| 状態確認 | `lore status` | Branch / Revision / Remote 同期状態を確認 |
| ファイル再検出 | `lore status --scan` | Unreal 外で変わったファイルも再スキャン |
| 最新化 | `lore sync` | 現在の Branch の最新 Revision へ同期 |
| ステージ | `lore stage .` | 検出した変更を Commit 対象にする |
| Commit | `lore commit "message"` | ローカル Revision を作成 |
| Push | `lore push` | 専用 PC の Lore Server へ反映 |
| Branch 一覧 | `lore branch list` | 利用可能な Branch を確認 |
| Branch 作成 | `lore branch create feature/x` | 現在位置から新しい Branch を作成 |
| Branch 切替 | `lore branch switch feature/x` | 指定した Branch へ切替（Unreal を閉じて実行） |

## 11. やらないこと

- Lore / Multi-User Server を各自で起動しない。サーバーは専用 PC 側です。
- UDP の PC 固有 IP を `DefaultEngine.ini` に保存しない。`UserEngine.ini` だけで管理します。
- Multi-User 参加中に Branch を切り替えない。退出して Unreal を終了してから CLI で切り替えます。
- 全員で Persist / Commit しない。セッション終了時の担当者を 1 人決めます。
- `--reset` や強制操作を自己判断で実行しない。変更消失につながるため、困ったら管理担当に相談します。
- Revision が異なるまま共同編集しない。開始前に `lore status` で確認します。

## 12. トラブル時の最短チェック

| 症状 | 確認すること |
| --- | --- |
| Lore に接続できない | `curl.exe -i http://10.214.72.199:41339/health_check` を実行し、`200 OK` ならサーバー到達済み |
| 最新化できない | `lore status` で Branch / Local / Remote Revision を確認 |
| Multi-User が見えない | `UserEngine.ini` の Static Endpoint が `10.214.72.199:50001` か確認 |
| 他の人の変更が見えない | 同じセッション・同じ Level か確認 |
| Lore に差分が出ない | セッション変更を Persist してから `lore status --scan` |
| `lore` が見つからない | PowerShell を再起動し、PATH または `C:\Users\<user>\bin\lore.exe` を確認 |

## 13. 参加前チェックリスト

- [ ] Unreal Engine 5.8 がインストール済み
- [ ] Lore CLI がインストール済み（`lore --version`）
- [ ] `D:\UnrealProjects\REISRAND` に Clone 済み
- [ ] 自分専用の `Config/UserEngine.ini` を作成済み
- [ ] Lore の Branch / Revision がチームと一致
- [ ] `REISRAND_Main` が見えて参加できる
- [ ] 作業終了時の Persist / Commit 担当ルールを理解
- [ ] Branch 切替時は Unreal を閉じるルールを理解

接続先: 専用 PC `10.214.72.199` / Lore `:41337` / Multi-User `:50001` / Session `REISRAND_Main`

## 付録. Unreal Editor 内の Lore 連携（試験導入）

`UE-LoreSourceControl` を使うと、現在の Branch 確認・変更表示・Submit などを Editor 内で行えます。

**現在できること:** Provider で Lore を選択、Server / Repository / Branch の確認、File Locking、Submit 時 Push。
**現在できないこと:** Branch 作成・切替は CLI で行います。Branch Explorer 風 UI は今後の拡張候補です。

このプラグインはコミュニティ製です。チーム標準にする前に動作確認してください。CLI 運用だけでも開発できます。

参考: EpicGames Lore 公式 CLI 仕様 / BenVlodgi/UE-LoreSourceControl
