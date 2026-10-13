# Embedded font attribution

GridCraft Web v0.6.1 embeds **BIZ UDPGothic Regular** in its WebAssembly so Japanese spreadsheet cell text renders even when the browser has no Japanese system font.

- Copyright: The BIZ UDGothic Project Authors (Morisawa Inc.)
- Source: [googlefonts/morisawa-biz-ud-gothic](https://github.com/googlefonts/morisawa-biz-ud-gothic/tree/18934af56b9c003ca58c54bffbf226848cb11032)
- Font source bundle: [storytold/craft-fonts@3d9ab3a](https://github.com/storytold/craft-fonts/tree/3d9ab3a132ed0eff457e424226a435a901da30d3)
- License: SIL Open Font License 1.1, included as [OFL-BIZUDPGothic.txt](OFL-BIZUDPGothic.txt)
- Font SHA-256: `258d7156c165f2ff774b6efee637c22c3b950de0d8a10e501137061bc8085d01`

The MindZJ integration patch adds the embedded font to GridCraft's Japanese glyph fallback chain. GridCraft's UI language remains English.
