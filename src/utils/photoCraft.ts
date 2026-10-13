import { vaultStore } from "../stores/vault";
import { toVaultAssetUrl } from "./vaultPaths";
import { saveCraftExport } from "./craftSave";

/** Show the app-wide PhotoCraft web bundle with a Vault image queued for import. */
export function openImageInPhotoCraft(relativePath: string): void {
  const vault = vaultStore.vaultInfo();
  const imageUrl = toVaultAssetUrl(vault?.path ?? "", relativePath);
  const appBase = new URL(import.meta.env.BASE_URL, window.location.origin);
  const url = new URL("photocraft/index.html", appBase);
  const imageName = relativePath.split(/[\\/]/).pop() || "image";
  url.searchParams.set("mindzj_vault_file_path", relativePath);
  const token = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let channel: BroadcastChannel | undefined;
  if (typeof BroadcastChannel !== "undefined") {
    url.searchParams.set("mindzj_image_token", token);
    channel = new BroadcastChannel(`mindzj-photocraft:${token}`);
    let transferStarted = false;
    channel.onmessage = (event: MessageEvent<{ type?: string; blob?: Blob; fileName?: string }>) => {
      if (event.data?.type === "ready" && !transferStarted) {
        transferStarted = true;
        void fetch(imageUrl, { cache: "no-store" })
          .then((response) => {
            if (!response.ok) throw new Error(`Image request failed (${response.status})`);
            return response.blob();
          })
          .then((blob) => channel?.postMessage({ type: "image", blob, imageName }))
          .catch((error) => console.error("Could not send the selected image to PhotoCraft:", error));
        return;
      }
      if (event.data?.type !== "saved-file" || !(event.data.blob instanceof Blob)) return;
      void event.data.blob.arrayBuffer()
        .then((buffer) => {
          return saveCraftExport(new Uint8Array(buffer), relativePath, event.data.fileName || imageName);
        })
        .then((savedName) => {
          channel?.postMessage({ type: "save-result", ok: true, fileName: savedName });
        })
        .catch((error) => {
          console.error("Could not save the PhotoCraft image to the Vault:", error);
          channel?.postMessage({ type: "save-result", ok: false, message: String(error) });
        });
    };
  } else {
    url.searchParams.set("mindzj_image_url", new URL(imageUrl, window.location.href).toString());
    url.searchParams.set("mindzj_image_name", imageName);
  }
  if (vault?.path) url.searchParams.set("vault_path", vault.path);
  if (vault?.name) url.searchParams.set("vault_name", vault.name);
  window.dispatchEvent(new CustomEvent("mindzj:open-photocraft", {
    detail: {
      url: url.toString(),
      fileName: imageName,
      editor: "PhotoCraft" as const,
      close: () => channel?.close(),
    },
  }));
}
