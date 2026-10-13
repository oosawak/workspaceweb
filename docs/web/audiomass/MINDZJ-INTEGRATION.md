# AudioMass integration in MindZJ

MindZJ bundles the upstream AudioMass web application from commit `21f5ee1`.
The upstream application files are kept unmodified. MindZJ integration code is
implemented in `src/utils/audioMass.ts` and the editor toolbar.

## MindZJ integration changes

- Opens the selected Vault audio file in the embedded AudioMass editor.
- Supports recording through the browser microphone permission prompt.
- Intercepts AudioMass export downloads and writes the exported audio into the
  source file's folder in the Vault.
- Renames AudioMass's generic default export name to `<source>_edited` to avoid
  an unhelpful generic filename. Choosing the source file's exact name replaces
  that Vault file.
- Refreshes the Vault file list after saving.

AudioMass original code is MIT-licensed. Bundled third-party software keeps its
own licenses; see `THIRD_PARTY_NOTICES.md`.
