import { invoke } from "../backend";
import { vaultStore } from "../stores/vault";
import { hasPluginViewForExtension } from "../stores/plugins";
import { getFileHandler } from "./fileTypes";
import { openImageInPhotoCraft } from "./photoCraft";

/**
 * Unified "open a file in the vault" entry point used by every
 * user-facing click site in the app (file tree, search results,
 * wikilink clicks, backlinks panel, command palette, calendar daily
 * note, etc.).
 *
 * Routes the file based on its extension:
 *
 *   - Text / markdown / source code → in-app CodeMirror editor via
 *     `vaultStore.openFile(path)`. The editor can handle any text
 *     encoding that `read_file` returns.
 *
 *   - Plugin-registered extensions (e.g. `.mindzj`) → also through
 *     `vaultStore.openFile(path)`, because the editor area delegates
 *     to a `PluginViewHost` when it detects a registered extension.
 *
 *   - Images (`.png`, `.jpg`, `.gif`, `.webp`, `.svg`, ...) → an
 *     in-app preview tab.
 *
 *   - PDFs and Internet Shortcut files → an in-app preview tab.
 *   - `.doc/.docx` → an in-app document placeholder tab so the file
 *     stays in the workspace rather than jumping out to another app.
 *
 *   - Unsupported Office documents, archives, and media → the OS default app.
 *
 * Errors are logged but NOT thrown, so a single broken file click
 * never crashes the UI — each click site can `void openFileRouted(...)`.
 */
export async function openFileRouted(relativePath: string): Promise<void> {
    if (/\.url$/i.test(relativePath)) {
        try {
            vaultStore.openPreviewFile(relativePath, "document");
        } catch (e) {
            console.error("[openFileRouted] failed to preview Internet Shortcut:", e);
        }
        return;
    }

    const handler = getFileHandler(relativePath, hasPluginViewForExtension);

    switch (handler) {
        case "image": {
            try {
                vaultStore.openPreviewFile(relativePath, "image");
            } catch (e) {
                console.error("[openFileRouted] openPreviewFile(image) failed:", e);
            }
            return;
        }

        case "photocraft": {
            openImageInPhotoCraft(relativePath);
            return;
        }

        case "preview": {
            try {
                vaultStore.openPreviewFile(relativePath, "document");
            } catch (e) {
                console.error("[openFileRouted] openPreviewFile(document) failed:", e);
            }
            return;
        }

        case "external": {
            // Delegate unsupported formats to the OS default app. The Rust
            // `open_in_default_app` command does `cmd /C start "" …`
            // on Windows, `open` on macOS, `xdg-open` on Linux.
            try {
                await invoke("open_in_default_app", { relativePath });
            } catch (e) {
                console.error("[openFileRouted] open_in_default_app failed:", e);
            }
            return;
        }

        case "editor":
        case "plugin":
        case "unknown":
        default: {
            // In-app editor or plugin view — the existing flow.
            // `unknown` falls through to the editor because most
            // unknown extensions are still text files of some kind
            // (readme, config, script), and showing garbled bytes
            // is strictly better than silently swallowing the click.
            try {
                await vaultStore.openFile(relativePath);
            } catch (e) {
                console.error("[openFileRouted] openFile failed:", e);
            }
            return;
        }
    }
}

export async function readInternetShortcutUrl(relativePath: string): Promise<string> {
    return (await readInternetShortcut(relativePath)).url;
}

export async function readInternetShortcut(relativePath: string): Promise<{ url: string; openExternally: boolean }> {
    const shortcut = await invoke<{ content: string }>("read_file", { relativePath });
    const content = shortcut.content.replace(/^\uFEFF/, "");
    const target = content.match(/^\s*URL\s*=\s*(.*?)\s*$/im)?.[1]
        || content.split(/\r?\n/).map((line) => line.trim())
            .find((line) => /^https?:\/\//i.test(line));
    if (!target) throw new Error("The .url file does not contain a URL entry");

    const url = new URL(target);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("Only HTTP and HTTPS links are allowed in .url files");
    }
    const openExternally = /^\s*MindZJ-OpenMode\s*=\s*external\s*$/im.test(content);
    return { url: url.toString(), openExternally };
}

/** Open a .url target in the user's external browser. Call directly from a click. */
export async function openInternetShortcutExternally(relativePath: string): Promise<void> {
    const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    const popup = !isTauri && typeof window !== "undefined"
        ? window.open("about:blank", "_blank")
        : null;
    if (popup) popup.opener = null;

    try {
        const url = await readInternetShortcutUrl(relativePath);
        if (isTauri) {
            const shell = await import("@tauri-apps/plugin-shell");
            await shell.open(url);
        } else if (popup) {
            popup.location.replace(url);
        } else {
            console.warn("[openFileRouted] browser blocked the .url popup");
        }
    } catch (error) {
        popup?.close();
        console.error("[openFileRouted] failed to open Internet Shortcut externally:", error);
    }
}
