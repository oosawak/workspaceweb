import type { MindZjBackend } from "./index";

type Manifest = { notes: { path: string; title: string }[]; files: string[] };
type LocalFile = { content: string; deleted?: boolean; isDir?: boolean };
const localKey = "mindzj-pages-demo-files-v1";
const settingsKey = "mindzj-pages-demo-settings-v1";
const workspaceKey = "mindzj-pages-demo-workspace-v1";
const base = import.meta.env.BASE_URL;
const introPaths: Record<string, string> = {
  "zh-CN": "WorkspaceWeb-zh-CN.md",
  en: "WorkspaceWeb-en.md",
  ja: "WorkspaceWeb-ja.md",
  fr: "WorkspaceWeb-fr.md",
  de: "WorkspaceWeb-de.md",
  es: "WorkspaceWeb-es.md",
};
const legacyIntroPaths = new Set([
  "MindZJWeb-zh-CN.md",
  "MindZJWeb-en.md",
  "MindZJWeb-ja.md",
  "MindZJWeb-fr.md",
  "MindZJWeb-de.md",
  "MindZJWeb-es.md",
]);

let manifestPromise: Promise<Manifest> | undefined;
let activeVault = "Samples";
const files = (): Record<string, LocalFile> => {
  try { return JSON.parse(localStorage.getItem(localKey) || "{}"); }
  catch { return {}; }
};
const saveFiles = (value: Record<string, LocalFile>) => localStorage.setItem(localKey, JSON.stringify(value));
const normalize = (path: string) => path.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "").split("/").filter((part) => part && part !== ".").reduce<string[]>((parts, part) => { if (part === "..") parts.pop(); else parts.push(part); return parts; }, []).join("/");
const vaultRelative = (path: string) => {
  const clean = normalize(path);
  return clean.startsWith(`${activeVault}/`) ? clean.slice(activeVault.length + 1) : clean;
};
const timestamp = () => new Date().toISOString();
const hash = async (value: string) => {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(value)));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};
const manifest = () => manifestPromise ??= fetch(`${base}Vaults/manifest.json`).then((response) => {
  if (!response.ok) throw new Error(`Could not load sample Vault (${response.status})`);
  return response.json() as Promise<Manifest>;
});
const sourceUrl = (path: string) => `${base}Vaults/${normalize(path).split("/").map(encodeURIComponent).join("/")}`;
const assetUrl = (path: string) => {
  const relative = vaultRelative(path);
  const local = files()[`${activeVault}/${relative}`];
  if (local && !local.deleted && local.content.startsWith("data:")) return local.content;
  return sourceUrl(`${activeVault}/${relative}`);
};
const fileResult = async (path: string, content: string) => ({ path: vaultRelative(path), content, modified: timestamp(), hash: await hash(content), kind: "text" as const });

function makeTree(paths: string[], directories: Set<string>) {
  type Node = { name: string; relative_path: string; is_dir: boolean; size: number; modified: string; extension: string; children?: Node[] };
  const root: Node[] = [];
  const byPath = new Map<string, Node>();
  for (const path of [...paths, ...directories]) {
    const parts = path.split("/"); let parent = "";
    parts.forEach((part, index) => {
      const current = parent ? `${parent}/${part}` : part;
      let node = byPath.get(current);
      if (!node) {
        const dir = index < parts.length - 1 || directories.has(current);
        node = { name: part, relative_path: current, is_dir: dir, size: 0, modified: timestamp(), extension: dir ? "" : (part.includes(".") ? part.split(".").pop()!.toLowerCase() : ""), ...(dir ? { children: [] } : {}) };
        byPath.set(current, node);
        (parent ? byPath.get(parent)!.children! : root).push(node);
      }
      parent = current;
    });
  }
  const sort = (entries: Node[]) => { entries.sort((a, b) => Number(b.is_dir) - Number(a.is_dir) || a.name.localeCompare(b.name, "ja")); entries.forEach((entry) => entry.children && sort(entry.children)); };
  sort(root);
  return root;
}

export class PagesDemoBackend implements MindZjBackend {
  async invoke<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
    const all = await manifest();
    const local = files();
    const published = all.files.filter((path) => path.startsWith(`${activeVault}/`)).map((path) => path.slice(activeVault.length + 1));
    // Older demo versions stored published-file deletions as tombstones.
    // Published files are the immutable baseline, so discard those markers
    // and let reads fall back to the deployed copy.
    let clearedPublishedDeletions = false;
    for (const path of published) {
      const key = `${activeVault}/${path}`;
      if (local[key]?.deleted) {
        delete local[key];
        clearedPublishedDeletions = true;
      }
    }
    if (clearedPublishedDeletions) saveFiles(local);
    const userPaths = Object.entries(local).filter(([path, value]) => path.startsWith(`${activeVault}/`) && !value.deleted && !value.isDir).map(([path]) => path.slice(activeVault.length + 1));
    const directories = new Set(Object.entries(local).filter(([path, value]) => path.startsWith(`${activeVault}/`) && !value.deleted && value.isDir).map(([path]) => path.slice(activeVault.length + 1)));
    for (const path of [...published, ...userPaths]) {
      const parts = path.split("/");
      while (parts.length > 1) { parts.pop(); directories.add(parts.join("/")); }
    }
    const paths = [...new Set([...published, ...userPaths])].filter((path) => !local[`${activeVault}/${path}`]?.deleted);
    const text = async (path: string) => {
      const rel = vaultRelative(path); const key = `${activeVault}/${rel}`;
      if (local[key]?.deleted) throw new Error(`File not found: ${rel}`);
      if (local[key] && !local[key].deleted) return local[key].content;
      if (!all.files.includes(key)) throw new Error(`File not found: ${rel}`);
      const response = await fetch(sourceUrl(key));
      if (!response.ok) throw new Error(`File not found: ${rel}`);
      return response.text();
    };
    let result: unknown;
    switch (command) {
      case "list_web_vaults": {
        const roots = [...new Set(all.files.filter((path) => path !== "manifest.json").map((path) => path.split("/")[0]))];
        result = roots.map((name) => ({ name, path: `Vaults/${name}`, lastOpened: 0 })); break;
      }
      case "open_vault": {
        const path = String(args.path ?? ""); activeVault = path.split("/").filter(Boolean).pop() || "Samples";
        result = { name: String(args.name || activeVault), path: `Vaults/${activeVault}`, created_at: timestamp(), last_opened: timestamp() }; break;
      }
      case "get_file_tree": result = makeTree(paths, directories); break;
      case "read_file": result = await fileResult(String(args.relativePath || ""), await text(String(args.relativePath || ""))); break;
      case "write_file": {
        const path = vaultRelative(String(args.relativePath || "")); const content = String(args.content ?? "");
        local[`${activeVault}/${path}`] = { content }; saveFiles(local); result = await fileResult(path, content);
        document.dispatchEvent(new CustomEvent("mindzj:vault-file-saved", { detail: { path } })); break;
      }
      case "create_file": {
        const path = vaultRelative(String(args.relativePath || ""));
        if (paths.includes(path) || directories.has(path)) throw new Error(`File already exists: ${path}`);
        const content = String(args.content ?? ""); local[`${activeVault}/${path}`] = { content }; saveFiles(local); result = await fileResult(path, content); break;
      }
      case "create_dir": {
        const path = vaultRelative(String(args.relativePath || ""));
        local[`${activeVault}/${path}`] = { content: "", isDir: true }; saveFiles(local); result = undefined; break;
      }
      case "delete_file": case "delete_dir": {
        const path = vaultRelative(String(args.relativePath || ""));
        if (command === "delete_file") {
          // Removing an edited published file resets it to the deployed
          // sample. Removing a browser-created file removes it entirely.
          delete local[`${activeVault}/${path}`];
        } else {
          // Drop only browser-local overrides and additions under the folder.
          // Published files naturally reappear from the manifest-backed Vault.
          const prefix = `${activeVault}/${path}`;
          for (const key of Object.keys(local)) {
            if (key === prefix || key.startsWith(`${prefix}/`)) delete local[key];
          }
        }
        saveFiles(local); result = undefined; break;
      }
      case "rename_file": {
        const from = vaultRelative(String(args.from || "")); const to = vaultRelative(String(args.to || ""));
        const content = await text(from); local[`${activeVault}/${to}`] = { content }; delete local[`${activeVault}/${from}`]; saveFiles(local); result = undefined; break;
      }
      case "get_file_metadata": {
        const path = vaultRelative(String(args.relativePath || "")); const body = await text(path);
        result = { relative_path: path, size: new Blob([body]).size, created: timestamp(), modified: timestamp(), is_markdown: path.endsWith(".md"), word_count: body.trim() ? body.trim().split(/\s+/).length : 0, char_count: body.length, tags: [...body.matchAll(/(^|\s)#([\w/-]+)/g)].map((match) => match[2]), backlink_count: 0 }; break;
      }
      case "list_entries": result = paths.map((path) => ({ relative_path: path, name: path.split("/").pop(), is_dir: false, extension: path.split(".").pop()?.toLowerCase() || "" })); break;
      case "search_vault": result = []; break;
      case "get_backlinks": case "get_forward_links": result = []; break;
      case "get_graph_data": result = { nodes: [], edges: [] }; break;
      case "get_settings": result = JSON.parse(localStorage.getItem(settingsKey) || "{}"); break;
      case "update_settings": localStorage.setItem(settingsKey, JSON.stringify(args.settings ?? {})); result = undefined; break;
      case "get_hotkeys": result = []; break;
      case "save_hotkeys": result = undefined; break;
      case "load_workspace": {
        const language = (() => {
          try {
            const settings = JSON.parse(localStorage.getItem(settingsKey) || "{}");
            return settings.locale || localStorage.getItem("mindzj-pending-locale") || "ja";
          } catch { return localStorage.getItem("mindzj-pending-locale") || "ja"; }
        })();
        const intro = introPaths[language] || introPaths.en;
        const saved = JSON.parse(localStorage.getItem(workspaceKey) || "null");
        const previousDefault = "ドキュメント/教科書/UnrealEngine入門.md";
        const introSet = new Set(Object.values(introPaths));
        const workspace = saved ?? {
          open_files: [intro], active_file: intro, primary_pane_path: intro,
          secondary_pane_path: null, active_pane_slot: "primary", split_direction: "right",
          split_ratio: 0.5, sidebar_tab: "files", sidebar_collapsed: false, sidebar_width: 260,
          sidebar_tab_order: [], file_scroll_positions: {}, file_top_lines: {},
          file_view_modes: {}, file_last_non_reading_view_modes: {},
        };
        // Replace seeded intro files when restoring an older Pages-demo workspace.
        const isIntro = (path: string) => path === previousDefault || introSet.has(path) || legacyIntroPaths.has(path);
        workspace.open_files = (workspace.open_files || []).map((path: string) => isIntro(path) ? intro : path);
        workspace.active_file = isIntro(workspace.active_file) ? intro : workspace.active_file;
        workspace.primary_pane_path = isIntro(workspace.primary_pane_path) ? intro : workspace.primary_pane_path;
        result = workspace;
        break;
      }
      case "save_workspace": localStorage.setItem(workspaceKey, JSON.stringify(args.workspace ?? {})); result = undefined; break;
      case "list_plugins": case "list_themes": case "list_css_snippets": result = []; break;
      case "read_binary_file": {
        const response = await fetch(assetUrl(String(args.relativePath || "")));
        const bytes = new Uint8Array(await response.arrayBuffer()); let binary = "";
        for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
        result = btoa(binary); break;
      }
      case "get_ai_api_key": case "get_snippets_dir": case "get_themes_dir": result = null; break;
      case "read_plugin_main": case "read_plugin_styles": case "read_css_snippet": case "read_theme": result = ""; break;
      case "write_binary_file": {
        const path = vaultRelative(String(args.relativePath || "")); const encoded = String(args.base64Data || "");
        const extension = path.split(".").pop()?.toLowerCase() || "bin";
        const mime = ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", pdf: "application/pdf", glb: "model/gltf-binary", mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", wav: "audio/wav", ogg: "audio/ogg", opus: "audio/opus", flac: "audio/flac" } as Record<string, string>)[extension] || "application/octet-stream";
        local[`${activeVault}/${path}`] = { content: `data:${mime};base64,${encoded}` }; saveFiles(local); result = undefined; break;
      }
      case "toggle_plugin": case "delete_plugin": case "import_theme": case "write_theme": case "delete_theme": result = undefined; break;
      default: throw new Error(`This feature is unavailable in the browser demo: ${command}`);
    }
    return result as T;
  }
}

export function pagesDemoAssetUrl(vaultRoot: string, relativePath: string): string {
  const root = vaultRoot.replaceAll("\\", "/").split("/").filter(Boolean).pop() || activeVault;
  const local = files()[`${root}/${normalize(relativePath)}`];
  if (local?.content.startsWith("data:")) return local.content;
  return `${base}Vaults/${[root, normalize(relativePath)].filter(Boolean).join("/").split("/").map(encodeURIComponent).join("/")}`;
}
