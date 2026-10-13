export interface CraftWebVersion {
  version: string;
  commit: string;
}

export type CraftWebVersions = Record<"photocraft" | "pdfcraft" | "gridcraft" | "cadcraft", CraftWebVersion>;

export const FALLBACK_CRAFT_WEB_VERSIONS: CraftWebVersions = {
  photocraft: { version: "v0.8.2", commit: "d43db3e153c76aefce9b32cef9099e458eaf17a8" },
  pdfcraft: { version: "v0.7.1", commit: "7163ba3dee8becfff6871c9a65d0d8314314742b" },
  gridcraft: { version: "v0.6.1", commit: "fc45b7f6d8ab79ef20f74e3c8347a2fd731e6af5" },
  cadcraft: { version: "v0.6.2", commit: "00c7613" },
};

export async function loadCraftWebVersions(): Promise<CraftWebVersions> {
  const base = new URL(import.meta.env.BASE_URL, window.location.origin);
  const response = await fetch(new URL("craft-web-versions.json", base));
  if (!response.ok) throw new Error(`Could not load craft version manifest: ${response.status}`);
  return await response.json() as CraftWebVersions;
}
