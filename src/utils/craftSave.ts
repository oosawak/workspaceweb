import { invoke } from "../backend";
import { vaultStore, type VaultEntry } from "../stores/vault";

/** Save a Craft editor export into the opened file or a sibling of another format. */
export async function saveCraftExport(
  bytes: Uint8Array,
  sourcePath: string,
  requestedName: string,
  overwriteSource = true,
): Promise<string> {
  const sourceName = sourcePath.split(/[\\/]/).pop() || "export";
  const requestedBase = requestedName.split(/[\\/]/).pop()?.replace(/[\x00-\x1f]/g, "").trim();
  const outputName = requestedBase && requestedBase !== "." && requestedBase !== ".."
    ? requestedBase
    : sourceName;
  const extension = (name: string) => name.includes(".") ? name.slice(name.lastIndexOf(".")).toLowerCase() : "";
  const sourceExtension = extension(sourceName);
  const outputExtension = extension(outputName);
  const directory = sourcePath.split(/[\\/]/).slice(0, -1).join("/");
  let targetPath = sourcePath;

  if ((outputExtension && sourceExtension !== outputExtension) || !overwriteSource) {
    const stem = outputName.slice(0, -outputExtension.length);
    const exists = (path: string, entries: VaultEntry[]): boolean =>
      entries.some((entry) => entry.relative_path === path || (entry.children ? exists(path, entry.children) : false));
    const entries = vaultStore.fileTree();
    let suffix = 0;
    do {
      const candidateName = suffix === 0 ? outputName : `${stem} (${suffix + 1})${outputName.slice(-outputExtension.length)}`;
      targetPath = directory ? `${directory}/${candidateName}` : candidateName;
      suffix += 1;
    } while (exists(targetPath, entries));
  }

  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  await invoke("write_binary_file", { relativePath: targetPath, base64Data: btoa(binary) });
  await vaultStore.refreshFileTree();
  return targetPath.split(/[\\/]/).pop() || outputName;
}
