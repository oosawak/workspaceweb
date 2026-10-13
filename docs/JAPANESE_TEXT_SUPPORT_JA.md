# 日本語ファイル名と文字表示

MindZJはファイル名をUTF-8で扱います。PdfCraft v0.7.1との連携はファイル名とPDFデータを親画面とのメッセージで渡すため、日本語名のPDFも同じ名前でVaultへ保存します。

同梱しているWeb版のフォント状況はアプリごとに異なります。

- PhotoCraft v0.8.2の公式Webビルドはcraft-fontsの日本語フォントを含みません。日本語の表示はWebビルドのフォント対応やブラウザー環境に依存します。
- PdfCraft v0.7.1の公式WebビルドはBIZ UDPGothic Regularを含みます。フォントのライセンスはOFL 1.1です。
- MindZJ同梱のGridCraft v0.6.1 Webビルドには、日本語セルデータ表示用にBIZ UDPGothic Regularを埋め込みました。UI言語は英語のままです。フォントのライセンスはSIL Open Font License 1.1で、`public/gridcraft/OFL-BIZUDPGothic.txt`に同梱しています。

GridCraftの上流Web版を更新するときは、`scripts/update-craft-web.sh --update`が日本語フォント入りWeb版も再ビルドします。単独で再生成する場合は `scripts/build-gridcraft-japanese.sh` を実行します。

フォントは文字の描画方法に関するもので、内部データが文字化けして保存されたファイルを修復するものではありません。上流のWebビルドを更新すると同梱フォントの内容が変わることがあるため、ライセンス画面とアプリ内のNOTICE・素材帰属情報を確認してください。

- [PdfCraft連携説明](PDFCRAFT_INTEGRATION_JA.md)
- [上流ソース PhotoCraft](https://github.com/storytold/photocraft)
- [上流ソース PdfCraft](https://github.com/storytold/pdfcraft)
- [上流ソース GridCraft](https://github.com/storytold/gridcraft)
