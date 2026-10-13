/**
 * File-type → handler routing.
 *
 * When the user clicks a file in the tree (or opens one via wikilink,
 * search, command palette etc.) we need to decide HOW to render it:
 *
 *   - Markdown and plain-text files go into the CodeMirror editor.
 *   - `.mindzj` (or any plugin-registered extension) goes into a
 *     plugin view.
 *   - Images open in an in-app preview tab.
 *   - PDFs, supported spreadsheets, common audio/video files, and glTF models open in-app.
 *   - `.doc/.docx` open in an in-app placeholder tab with actions.
 *   - Unsupported Office documents, archives, and media formats are delegated
 *     to the operating system's default app.
 */

export type FileHandler =
    /** Open in the built-in CodeMirror editor as text. */
    | "editor"
    /** Open via a registered plugin view (e.g. `.mindzj` → mind-map). */
    | "plugin"
    /** Open in an in-app image preview tab. */
    | "image"
    /** Open layered Photoshop documents in the integrated PhotoCraft editor. */
    | "photocraft"
    /** Open in an in-app document placeholder tab. */
    | "preview"
    /** Delegate to the OS default application. */
    | "external"
    /** Unknown extension — fall back to the editor (maybe it's text). */
    | "unknown";

const IMAGE_EXTS = new Set([
    "png",
    "jpg",
    "jpeg",
    "gif",
    "webp",
    "awebp",
    "bmp",
    "ico",
    // svg is BOTH an image AND a text file. We treat it as an image
    // here so clicking it in the file tree opens the rendered image.
    // Power users who want to edit the SVG source can still use the
    // OS's "Open with Notepad" from outside the app.
    "svg",
]);

const PHOTOCRAFT_EXTS = new Set(["psb"]);

const MARKDOWN_EXTS = new Set(["md", "markdown", "mdx"]);

/**
 * Extensions we open in the in-app CodeMirror editor.
 *
 * CodeMirror 6 is happy to render arbitrary text with line numbers,
 * syntax highlighting (via markdown lang) etc., so even files like
 * `.py` / `.rs` / `.ts` that we don't natively syntax-highlight still
 * become readable/editable.
 */
const TEXT_EXTS = new Set([
    // Markdown variants
    ...MARKDOWN_EXTS,
    // Plain text / logs
    "txt",
    "log",
    "readme",
    "csv",
    "cvs",
    "tsv",
    // Structured configs
    "json",
    "jsonc",
    "json5",
    "yaml",
    "yml",
    "toml",
    "ini",
    "conf",
    "cfg",
    "env",
    "xml",
    // Source code (readable in editor even if we don't highlight yet)
    "js",
    "mjs",
    "cjs",
    "ts",
    "tsx",
    "jsx",
    "py",
    "rs",
    "go",
    "java",
    "c",
    "cpp",
    "cc",
    "h",
    "hpp",
    "rb",
    "php",
    "lua",
    "sh",
    "bash",
    "zsh",
    "ps1",
    "bat",
    "cmd",
    // Web source (HTML pages are handled by the in-app page preview below)
    "css",
    "scss",
    "sass",
    "less",
    // SQL / misc text
    "sql",
    "graphql",
    "gql",
]);

const PREVIEW_EXTS = new Set([
    "html", "htm",
    "dxf", "dwg",
    "psd",
    "pdf",
    "xls", "xlsx", "xlsm", "xlsb", "ods",
    "doc",
    "docx",
    "mp3", "m4a", "wav", "ogg", "flac", "aac", "opus",
    "mp4", "m4v", "mov", "avi", "mkv", "webm", "ogv",
    "glb", "gltf",
]);

/**
 * Files we hand off to the OS default app. These either can't render
 * in a WebView2 view at all (Office documents, archives) or would
 * render worse than the dedicated native app (A/V files).
 */
const EXTERNAL_EXTS = new Set([
    // Microsoft Office
    "doc",
    "docx",
    "ppt",
    "pptx",
    // OpenDocument
    "odt",
    "odp",
    // Apple iWork
    "pages",
    "numbers",
    "key",
    // Media without an in-app preview
    "wmv",
    // Archives
    "zip",
    "rar",
    "7z",
    "tar",
    "gz",
    "bz2",
    "xz",
    // Executables / installers
    "exe",
    "msi",
    "dmg",
    "deb",
    "rpm",
    "app",
    "apk",
]);

export function getFileExtension(path: string): string {
    // Use lastIndexOf rather than split(".").pop() so that dot-files
    // like `.gitignore` (no extension) return "" instead of
    // "gitignore".
    const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
    const fileName = lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
    const dot = fileName.lastIndexOf(".");
    if (dot <= 0) return "";
    return fileName.slice(dot + 1).toLowerCase();
}

export function getFileHandler(
    path: string,
    hasPluginView: (ext: string) => boolean,
): FileHandler {
    const ext = getFileExtension(path);
    // Plugin views take priority — any plugin-registered extension
    // (e.g. `.mindzj`) routes to the plugin, even if it would
    // otherwise match one of the built-in categories.
    if (ext && hasPluginView(ext)) return "plugin";
    if (PHOTOCRAFT_EXTS.has(ext)) return "photocraft";
    if (IMAGE_EXTS.has(ext)) return "image";
    if (TEXT_EXTS.has(ext)) return "editor";
    if (PREVIEW_EXTS.has(ext)) return "preview";
    if (EXTERNAL_EXTS.has(ext)) return "external";
    // Unknown extension: try the editor. Worst case the user sees
    // garbled bytes and closes the tab — better than silently doing
    // nothing on click.
    return "unknown";
}

export function isImageExtension(ext: string): boolean {
    return IMAGE_EXTS.has(ext.toLowerCase());
}

export function isMarkdownExtension(ext: string): boolean {
    return MARKDOWN_EXTS.has(ext.toLowerCase());
}

export function isMarkdownPath(path: string): boolean {
    return isMarkdownExtension(getFileExtension(path));
}

export function isTextExtension(ext: string): boolean {
    return TEXT_EXTS.has(ext.toLowerCase());
}

export function isExternalExtension(ext: string): boolean {
    return EXTERNAL_EXTS.has(ext.toLowerCase());
}

export function isPreviewExtension(ext: string): boolean {
    return PREVIEW_EXTS.has(ext.toLowerCase());
}
