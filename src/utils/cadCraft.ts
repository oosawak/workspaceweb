import { vaultStore } from "../stores/vault";
import { toVaultAssetUrl } from "./vaultPaths";
import { saveCraftExport } from "./craftSave";
import { t } from "../i18n";

/** Open a Vault DXF/DWG in the embedded CADCraft WebAssembly editor. */
export function openCadDrawingInCadCraft(relativePath: string): void {
  const vault = vaultStore.vaultInfo();
  const fileUrl = new URL(toVaultAssetUrl(vault?.path ?? "", relativePath), window.location.href).toString();
  const fileName = relativePath.split(/[\\/]/).pop() || "Drawing.dxf";
  const appBase = new URL(import.meta.env.BASE_URL, window.location.origin);
  const url = new URL("cadcraft/index.html", appBase);
  url.searchParams.set("host", "parent");

  let frame: HTMLIFrameElement | null = null;
  let messageHandler: ((event: MessageEvent) => void) | null = null;
  const close = () => {
    if (messageHandler) window.removeEventListener("message", messageHandler);
    frame = null;
    messageHandler = null;
  };

  window.dispatchEvent(new CustomEvent("mindzj:open-cadcraft", {
    detail: {
      url: url.toString(),
      fileName,
      editor: "CADCraft",
      close,
      connect: (iframe: HTMLIFrameElement) => {
        close();
        frame = iframe;
        const origin = url.origin;
        messageHandler = async (event: MessageEvent) => {
          if (event.origin !== origin || event.source !== frame?.contentWindow) return;
          const data = event.data as {
            type?: string;
            name?: string;
            version?: string;
            dirty?: boolean;
            bytes?: ArrayBuffer | Uint8Array;
            error?: string;
          };

          if (data?.type === "cadcraft:ready") {
            try {
              const response = await fetch(fileUrl);
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              const bytes = await response.arrayBuffer();
              frame?.contentWindow?.postMessage(
                { type: "cadcraft:open", name: fileName, bytes },
                origin,
                [bytes],
              );
            } catch (error) {
              console.error("Could not load the CAD drawing into CADCraft:", error);
              showToast(t("cadcraft.openFailed", { fileName }));
            }
          } else if (data?.type === "cadcraft:save") {
            const bytes = toUint8Array(data.bytes);
            if (!bytes) return;
            const outputName = data.name || fileName;
            void saveCraftExport(bytes, relativePath, outputName, outputName === fileName)
              .then((savedName) => showToast(t("cadcraft.saved", { fileName: savedName })))
              .catch((error) => {
                console.error("Could not save the CAD drawing to the Vault:", error);
                showToast(t("cadcraft.saveFailed", { fileName: outputName }));
              });
          } else if (data?.type === "cadcraft:failed") {
            console.error("CADCraft could not start:", data.error);
            showToast(t("cadcraft.openFailed", { fileName }));
          }
        };
        window.addEventListener("message", messageHandler);
      },
    },
  }));
}

function toUint8Array(bytes: unknown): Uint8Array | null {
  if (bytes instanceof Uint8Array) return bytes;
  if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes);
  return null;
}

function showToast(message: string): void {
  document.dispatchEvent(new CustomEvent("mindzj:show-toast", { detail: { message } }));
}
