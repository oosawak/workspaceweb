import { vaultStore } from "../stores/vault";
import { toVaultAssetUrl } from "./vaultPaths";
import { t } from "../i18n";
import { saveCraftExport } from "./craftSave";

/** Open a Vault PDF in the embedded PdfCraft editor. */
export function openPdfInPrintCraft(relativePath: string): void {
  const vault = vaultStore.vaultInfo();
  const pdfUrl = new URL(toVaultAssetUrl(vault?.path ?? "", relativePath), window.location.href).toString();
  const fileName = relativePath.split(/[\\/]/).pop() || "document.pdf";
  const appBase = new URL(import.meta.env.BASE_URL, window.location.origin);
  const url = new URL("pdfcraft/index.html", appBase);
  url.searchParams.set("host", "parent");

  let frame: HTMLIFrameElement | null = null;
  let messageHandler: ((event: MessageEvent) => void) | null = null;
  const close = () => {
    if (messageHandler) window.removeEventListener("message", messageHandler);
    frame = null;
    messageHandler = null;
  };

  window.dispatchEvent(new CustomEvent("mindzj:open-printcraft", {
    detail: {
      url: url.toString(),
      fileName,
      editor: "PdfCraft",
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
            saveAs?: boolean;
            bytes?: ArrayBuffer | Uint8Array;
            error?: string;
          };

          if (data?.type === "pdfcraft:ready") {
            try {
              const response = await fetch(pdfUrl);
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              const bytes = await response.arrayBuffer();
              frame?.contentWindow?.postMessage(
                { type: "pdfcraft:open", name: fileName, bytes },
                origin,
                [bytes],
              );
            } catch (error) {
              console.error("Could not load the PDF into PdfCraft:", error);
              showCraftToast(t("pdfcraft.openFailed", { fileName }));
            }
          } else if (data?.type === "pdfcraft:save") {
            const bytes = toUint8Array(data.bytes);
            if (!bytes) return;
            void saveCraftExport(bytes, relativePath, data.name || fileName, !data.saveAs)
              .then((savedName) => showCraftToast(t("pdfcraft.saved", { fileName: savedName })))
              .catch((error) => {
                console.error("Could not save the PdfCraft PDF to the Vault:", error);
                showCraftToast(t("pdfcraft.saveFailed", { fileName: data.name || fileName }));
              });
          } else if (data?.type === "pdfcraft:failed") {
            console.error("PdfCraft could not start:", data.error);
            showCraftToast(t("pdfcraft.openFailed", { fileName }));
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

function showCraftToast(message: string): void {
  document.dispatchEvent(new CustomEvent("mindzj:show-toast", { detail: { message } }));
}
