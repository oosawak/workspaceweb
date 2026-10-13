import { vaultStore } from "../stores/vault";
import { toVaultAssetUrl } from "./vaultPaths";
import { t } from "../i18n";
import { saveCraftExport } from "./craftSave";

/** Open a Vault spreadsheet in GridCraft and write same-name saves back. */
export function openSpreadsheetInGridCraft(relativePath: string): void {
  const vault = vaultStore.vaultInfo();
  const fileUrl = new URL(toVaultAssetUrl(vault?.path ?? "", relativePath), window.location.href).toString();
  const fileName = relativePath.split(/[\\/]/).pop() || "workbook.xlsx";
  const appBase = new URL(import.meta.env.BASE_URL, window.location.origin);
  const url = new URL("gridcraft/index.html", appBase);
  const token = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  url.searchParams.set("mindzj_file_url", fileUrl);
  url.searchParams.set("mindzj_file_name", fileName);
  url.searchParams.set("mindzj_token", token);

  const channel = typeof BroadcastChannel === "undefined"
    ? undefined
    : new BroadcastChannel(`mindzj-gridcraft:${token}`);
  if (channel) {
    channel.onmessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; requestId?: string; fileName?: string; blob?: Blob };
      if (data?.type !== "saved-file" || !(data.blob instanceof Blob)) return;
      void data.blob.arrayBuffer()
        .then((buffer) => writeToVault(new Uint8Array(buffer), relativePath, data.fileName || fileName, channel, data.requestId))
        .catch((error) => {
          console.error("Could not read the GridCraft export:", error);
          channel.postMessage({ type: "save-result", requestId: data.requestId, ok: false, message: String(error) });
        });
    };
  }

  window.dispatchEvent(new CustomEvent("mindzj:open-gridcraft", {
    detail: { url: url.toString(), fileName, editor: "GridCraft", close: () => channel?.close() },
  }));
}

async function writeToVault(bytes: Uint8Array, relativePath: string, fileName: string, channel: BroadcastChannel, requestId?: string): Promise<void> {
  try {
    const savedName = await saveCraftExport(bytes, relativePath, fileName);
    document.dispatchEvent(new CustomEvent("mindzj:show-toast", { detail: { message: t("gridcraft.saved", { fileName: savedName }) } }));
    channel.postMessage({ type: "save-result", requestId, ok: true, fileName: savedName });
  } catch (error) {
    console.error("Could not save the GridCraft spreadsheet to the Vault:", error);
    document.dispatchEvent(new CustomEvent("mindzj:show-toast", { detail: { message: t("gridcraft.saveFailed", { fileName }) } }));
    channel.postMessage({ type: "save-result", requestId, ok: false, message: String(error) });
  }
}
