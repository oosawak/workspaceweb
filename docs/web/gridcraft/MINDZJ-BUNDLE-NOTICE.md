# WorkspaceWeb integration notice

GridCraft Web v0.6.1 is distributed from the official `storytold/gridcraft` web release. Its source, WebAssembly, and upstream licenses are included alongside this notice.

WorkspaceWeb adds `mindzj-loader.js` and the small script tag in `index.html` to open the selected Vault spreadsheet and return same-name saves to WorkspaceWeb. This integration code is maintained in the WorkspaceWeb repository under AGPL-3.0-or-later. These changes do not alter GridCraft's upstream license.

The WebAssembly build also embeds BIZ UDPGothic Regular so Japanese cell text renders in browsers that have no Japanese system font. This font is licensed under SIL Open Font License 1.1; see `OFL-BIZUDPGothic.txt` and `CRAFT-FONTS-ATTRIBUTION.md`. The GridCraft UI language remains English; the font enables Japanese workbook data to display.
