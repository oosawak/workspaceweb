# PhotoCraft・PdfCraft・GridCraftの更新

同梱しているWebAssembly版の上流リリースを確認するには、MindZJのリポジトリで実行します。

```sh
./scripts/update-craft-web.sh --check
```

更新版がある場合は、公式GitHub ReleasesのWeb ZIPを取得し、リリースが提供するSHA-256を照合してから `public/<craft>/` と `docs/web/<craft>/` に配置します。PhotoCraftとGridCraftのMindZJ連携ローダーは維持されます。PdfCraftは公式の `?host=parent` 通信機能を使います。ライセンス、NOTICE、素材帰属ファイル、表示用バージョン情報も更新します。

```sh
./scripts/update-craft-web.sh --update
```

更新後は差分を確認し、各アプリのライセンス画面と編集・保存の動作を確認してください。MindZJの配布物へ反映する場合は、更新後に通常のビルドと公開作業を行います。
