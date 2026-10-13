import {
  Component,
  For,
  Show,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";
import { Dynamic } from "solid-js/web";
import { Highlighter, Image as ImageIcon } from "lucide-solid";
import { t } from "../../i18n";
import { editorStore } from "../../stores/editor";
import { settingsStore } from "../../stores/settings";
import { vaultStore } from "../../stores/vault";
import { getMarkerPalette } from "./markerColors";
import { ImagePicker } from "./ImagePicker";
import { requestViewModeChange } from "../../utils/editMode";
import { openImageInPhotoCraft } from "../../utils/photoCraft";
import { openPdfInPrintCraft } from "../../utils/printCraft";
import { openSpreadsheetInGridCraft } from "../../utils/gridCraft";
import { openVideoInFilmCraft } from "../../utils/filmCraft";
import { openAudioInAudioMass } from "../../utils/audioMass";
import { collaborationStore } from "../../stores/collaboration";
import { isCollaborativeWebNote } from "../../utils/collaboration";
import { FALLBACK_CRAFT_WEB_VERSIONS, loadCraftWebVersions } from "../../utils/craftVersions";

interface ToolbarButton {
  command: string;
  icon: string | Component<any>;
  label: string;
  level?: number;
  separator?: boolean;
  shortcut?: string;
}

const TOOLBAR_ITEMS: ToolbarButton[] = [
  { icon: "↶", label: "toolbar.undo", command: "undo", shortcut: "Ctrl+Z" },
  {
    icon: "↷",
    label: "toolbar.redo",
    command: "redo",
    shortcut: "Ctrl+Shift+Z",
    separator: true,
  },
  {
    icon: "P",
    label: "toolbar.paragraph",
    command: "heading",
    shortcut: "Ctrl+0",
    level: 0,
  },
  ...Array.from({ length: 6 }, (_, index) => ({
    icon: `H${index + 1}`,
    label: "toolbar.heading",
    command: "heading",
    shortcut: `Ctrl+${index + 1}`,
    level: index + 1,
    separator: index === 5,
  })),
  { icon: "B", label: "toolbar.bold", command: "bold", shortcut: "Ctrl+B" },
  { icon: "I", label: "toolbar.italic", command: "italic", shortcut: "Ctrl+I" },
  {
    icon: "S",
    label: "toolbar.strikethrough",
    command: "strikethrough",
    shortcut: "Ctrl+Shift+S",
  },
  { icon: "U", label: "toolbar.underline", command: "underline", shortcut: "Ctrl+U" },
  {
    icon: Highlighter,
    label: "toolbar.markImportant",
    command: "color-highlight",
  },
  {
    icon: "H",
    label: "toolbar.highlight",
    command: "highlight",
    shortcut: "Ctrl+Shift+H",
    separator: true,
  },
  { icon: "🔗", label: "toolbar.link", command: "link", shortcut: "Ctrl+K" },
  { icon: ImageIcon, label: "toolbar.imagePicker", command: "image-picker", separator: true },
  { icon: "</>", label: "toolbar.code", command: "code", shortcut: "Ctrl+Shift+E" },
  { icon: "{ }", label: "toolbar.codeBlock", command: "codeblock", separator: true },
  { icon: "▦", label: "toolbar.table", command: "table" },
  { icon: "—", label: "toolbar.separator", command: "horizontal-rule" },
  { icon: "☑", label: "toolbar.taskList", command: "task-list" },
  { icon: "•", label: "toolbar.bulletList", command: "bullet-list" },
  { icon: "1.", label: "toolbar.numberedList", command: "numbered-list" },
  { icon: "❝", label: "toolbar.quote", command: "quote", separator: true },
  { icon: "AI", label: "toolbar.ai", command: "ai-panel" },
];

export const Toolbar: Component = () => {
  const [showHeadingMenu, setShowHeadingMenu] = createSignal(false);
  const [showOverflowMenu, setShowOverflowMenu] = createSignal(false);
  const [showMarkerMenu, setShowMarkerMenu] = createSignal(false);
  const [showImagePicker, setShowImagePicker] = createSignal(false);
  const [showPhotoCraftLicense, setShowPhotoCraftLicense] = createSignal(false);
  const [showPrintCraftLicense, setShowPrintCraftLicense] = createSignal(false);
  const [showGridCraftLicense, setShowGridCraftLicense] = createSignal(false);
  const [showFilmCraftLicense, setShowFilmCraftLicense] = createSignal(false);
  const [showAudioMassLicense, setShowAudioMassLicense] = createSignal(false);
  const [craftVersions, setCraftVersions] = createSignal(FALLBACK_CRAFT_WEB_VERSIONS);
  const [overflowIndex, setOverflowIndex] = createSignal<number>(-1);
  const [headingMenuPos, setHeadingMenuPos] = createSignal({ x: 0, y: 0 });
  const [markerMenuPos, setMarkerMenuPos] = createSignal({ x: 0, y: 0 });
  let toolbarRef: HTMLDivElement | undefined;
  let itemsRef: HTMLDivElement | undefined;
  let headingBtnRef: HTMLButtonElement | undefined;
  let rightAreaRef: HTMLDivElement | undefined;

  const translateLabel = (item: ToolbarButton) =>
    item.label === "toolbar.heading"
      ? t(item.label, { level: item.level ?? 1 })
      : t(item.label);

  const markerColors = () => getMarkerPalette(settingsStore.settings().marker_colors);

  const applyMarkerColor = (color: string) => {
    document.dispatchEvent(
      new CustomEvent("mindzj:editor-command", {
        detail: {
          command: "color-highlight",
          color,
        },
      }),
    );
    setShowMarkerMenu(false);
  };

  const dispatchCommand = (item: ToolbarButton, event?: MouseEvent) => {
    if (item.command === "image-picker") {
      setShowImagePicker(true);
      return;
    }
    if (item.command === "ai-panel") {
      document.dispatchEvent(new CustomEvent("mindzj:toggle-ai-panel"));
      return;
    }

    if (item.command === "color-highlight") {
      const rect = (event?.currentTarget as HTMLElement | null)?.getBoundingClientRect();
      if (rect) {
        setMarkerMenuPos({ x: rect.left, y: rect.bottom + 2 });
      }
      setShowHeadingMenu(false);
      setShowOverflowMenu(false);
      setShowMarkerMenu((value) => !value);
      return;
    }

    const detail: Record<string, any> = { command: item.command };
    if (item.command === "heading") detail.level = item.level ?? 2;
    document.dispatchEvent(new CustomEvent("mindzj:editor-command", { detail }));
  };

  const isImageFile = () => vaultStore.activeFile()?.kind === "image";
  const isPdfFile = () => /\.pdf$/i.test(vaultStore.activeFile()?.path ?? "");
  const isSpreadsheetFile = () => /\.(xlsx|xlsm|xlsb|xls|ods)$/i.test(vaultStore.activeFile()?.path ?? "");
  const isVideoFile = () => /\.(mp4|mov|m4v|webm|mkv|avi|wmv|mpg|mpeg|mxf|mts|m2ts)$/i.test(vaultStore.activeFile()?.path ?? "");
  const isAudioFile = () => /\.(mp3|wav|ogg|flac|aac|m4a|opus)$/i.test(vaultStore.activeFile()?.path ?? "");
  const currentViewMode = () => isImageFile() || isPdfFile() || isSpreadsheetFile() || isVideoFile() || isAudioFile()
    ? "reading"
    : editorStore.getViewModeForFile(vaultStore.activeFile()?.path ?? null);
  const activePath = () => vaultStore.activeFile()?.path ?? null;
  const isCollaborationActive = () =>
    isCollaborativeWebNote(activePath()) && currentViewMode() !== "reading";
  const collaborationLabel = () => {
    const path = activePath();
    if (!path) return "";
    const state = collaborationStore.status(path);
    if (state.connection === "connecting") return t("collab.connecting");
    if (state.connection === "error") return t("collab.error");
    if (state.connection === "disconnected") return t("collab.disconnected");
    if (state.input === "editing") return `${t("collab.input")} · ${t("collab.connectedCount", { count: state.participants })}`;
    if (state.input === "updated") return `${t("collab.received")} · ${t("collab.connectedCount", { count: state.participants })}`;
    if (state.save === "pending") return `${t("collab.saving")} · ${t("collab.connectedCount", { count: state.participants })}`;
    return `${t("collab.saved")} · ${t("collab.connectedCount", { count: state.participants })}`;
  };
  const modeButtons = createMemo(() => isAudioFile()
    ? [
        { mode: "reading" as const, label: t("context.readingView") },
        { mode: "audiomass-edit" as const, label: t("audiomass.editButton") },
        { mode: "audiomass-license" as const, label: t("audiomass.licenseButton") },
      ]
    : isVideoFile()
    ? [
        { mode: "reading" as const, label: t("context.readingView") },
      ]
    : isPdfFile()
    ? [
        { mode: "reading" as const, label: t("context.readingView") },
        { mode: "printcraft-edit" as const, label: t("printcraft.editButton") },
        { mode: "printcraft-license" as const, label: t("printcraft.licenseButton") },
      ]
    : isSpreadsheetFile()
    ? [
        { mode: "reading" as const, label: t("context.readingView") },
        { mode: "gridcraft-edit" as const, label: t("gridcraft.editButton") },
        { mode: "gridcraft-license" as const, label: t("gridcraft.licenseButton") },
      ]
    : isImageFile()
    ? [
        { mode: "reading" as const, label: t("context.readingView") },
        { mode: "live-preview" as const, label: t("context.editMode") },
        { mode: "photocraft-license" as const, label: t("photocraft.licenseButton") },
      ]
    : [
        { mode: "reading" as const, label: t("context.readingView") },
        { mode: "live-preview" as const, label: t("context.editMode") },
        { mode: "source" as const, label: t("context.sourceMode") },
      ]);
  const openPhotoCraftLicense = () => setShowPhotoCraftLicense(true);
  const selectMode = (mode: "reading" | "live-preview" | "source" | "printcraft-edit" | "gridcraft-edit" | "filmcraft-edit" | "audiomass-edit") => {
    const path = activePath();
    if (isAudioFile()) {
      if (mode === "audiomass-edit" && path) openAudioInAudioMass(path);
      return;
    }
    if (isVideoFile()) {
      if (mode === "filmcraft-edit" && path) openVideoInFilmCraft(path);
      return;
    }
    if (isPdfFile()) {
      if (mode === "printcraft-edit" && path) openPdfInPrintCraft(path);
      return;
    }
    if (isSpreadsheetFile()) {
      if (mode === "gridcraft-edit" && path) openSpreadsheetInGridCraft(path);
      return;
    }
    if (isImageFile()) {
      if (mode === "live-preview" && path) openImageInPhotoCraft(path);
      return;
    }
    if (mode === "printcraft-edit" || mode === "gridcraft-edit" || mode === "filmcraft-edit" || mode === "audiomass-edit") return;
    if (path) void requestViewModeChange(path, mode);
  };
  const saveCurrent = () => {
    const path = activePath();
    if (path) void editorStore.savePendingManually(path);
  };

  const headingItems = createMemo(() =>
    TOOLBAR_ITEMS.filter((item) => item.command === "heading"),
  );
  const otherItems = createMemo(() =>
    TOOLBAR_ITEMS.filter((item) => item.command !== "heading"),
  );
  const flatOtherItems = createMemo(() => otherItems().slice(2));

  const checkOverflow = () => {
    if (!toolbarRef || !itemsRef || !rightAreaRef) return;

    const rightWidth = rightAreaRef.getBoundingClientRect().width + 8;
    const containerRight = toolbarRef.getBoundingClientRect().right - rightWidth;
    const children = itemsRef.querySelectorAll<HTMLElement>("[data-toolbar-idx]");
    let cutoff = -1;

    for (let index = 0; index < children.length; index += 1) {
      const rect = children[index].getBoundingClientRect();
      if (rect.width === 0) continue;
      if (rect.right > containerRight) {
        cutoff = index;
        break;
      }
    }

    setOverflowIndex(cutoff);
  };

  onMount(() => {
    void loadCraftWebVersions().then(setCraftVersions).catch((error) => {
      console.warn("Could not load the bundled Craft version manifest:", error);
    });
    requestAnimationFrame(checkOverflow);
    const observer = new ResizeObserver(() => requestAnimationFrame(checkOverflow));
    if (toolbarRef) observer.observe(toolbarRef);

    const handleClick = (event: MouseEvent) => {
      if (showHeadingMenu()) {
        const portal = document.getElementById("mz-heading-dropdown");
        if (
          headingBtnRef &&
          !headingBtnRef.contains(event.target as Node) &&
          (!portal || !portal.contains(event.target as Node))
        ) {
          setShowHeadingMenu(false);
        }
      }

      if (showOverflowMenu()) {
        const portal = document.getElementById("mz-overflow-dropdown");
        if (!portal || !portal.contains(event.target as Node)) {
          setShowOverflowMenu(false);
        }
      }

      if (showMarkerMenu()) {
        const portal = document.getElementById("mz-marker-dropdown");
        const target = event.target as HTMLElement;
        if (
          !portal ||
          (!portal.contains(target) &&
            !target.closest('[data-toolbar-command="color-highlight"]'))
        ) {
          setShowMarkerMenu(false);
        }
      }
    };

    document.addEventListener("mousedown", handleClick);
    onCleanup(() => {
      observer.disconnect();
      document.removeEventListener("mousedown", handleClick);
    });
  });

  const overflowItems = () => {
    const cutoff = overflowIndex();
    if (cutoff < 0) return [];
    const flat = flatOtherItems();
    const start = cutoff - 3;
    return start < 0 ? flat : flat.slice(start);
  };

  const isItemVisible = (flatIndex: number) => {
    const cutoff = overflowIndex();
    if (cutoff < 0) return true;
    return flatIndex + 3 < cutoff;
  };

  const openHeadingMenu = () => {
    if (headingBtnRef) {
      const rect = headingBtnRef.getBoundingClientRect();
      setHeadingMenuPos({ x: rect.left, y: rect.bottom + 2 });
    }
    setShowHeadingMenu((value) => !value);
  };

  return (
    <div
      ref={toolbarRef}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      style={{
        display: "flex",
        "align-items": "center",
        height: "var(--mz-toolbar-height)",
        "min-height": "var(--mz-toolbar-height)",
        padding: "0 var(--mz-space-2)",
        background: "var(--mz-bg-secondary)",
        "border-bottom": "1px solid var(--mz-border)",
        position: "relative",
        "z-index": "100",
        "flex-shrink": "0",
      }}
    >
      <Show when={!isImageFile() && !isPdfFile() && !isSpreadsheetFile() && !isAudioFile()}>
        <div
          ref={itemsRef}
          style={{
            display: "flex",
            "align-items": "center",
            gap: "1px",
            flex: "1",
            "min-width": "0",
            overflow: "hidden",
          }}
        >
        <For each={otherItems().slice(0, 2)}>
          {(item, index) => (
            <span data-toolbar-idx={index()} style={{ display: "inline-flex", "align-items": "center" }}>
              <ToolbarBtn item={item} label={translateLabel(item)} onClick={(event) => dispatchCommand(item, event)} />
              <Show when={item.separator}>
                <ToolbarSep />
              </Show>
            </span>
          )}
        </For>

        <span data-toolbar-idx={2} style={{ display: "inline-flex", "align-items": "center" }}>
          <button
            ref={headingBtnRef}
            onClick={openHeadingMenu}
            title={t("toolbar.headingLevel")}
            style={headingButtonStyle}
            onMouseEnter={hoverToolbarButton}
            onMouseLeave={resetToolbarButton}
          >
            H
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M1.5 3L4 5.5L6.5 3" />
            </svg>
          </button>
          <ToolbarSep />
        </span>

        <For each={flatOtherItems()}>
          {(item, index) => (
            <span
              data-toolbar-idx={index() + 3}
              style={{
                display: isItemVisible(index()) ? "inline-flex" : "none",
                "align-items": "center",
              }}
            >
              <ToolbarBtn item={item} label={translateLabel(item)} onClick={(event) => dispatchCommand(item, event)} />
              <Show when={item.separator}>
                <ToolbarSep />
              </Show>
            </span>
          )}
        </For>
        </div>
      </Show>

      <div
        ref={rightAreaRef}
        style={{
          display: "flex",
          "align-items": "center",
          gap: "2px",
          "flex-shrink": "0",
          "margin-left": isImageFile() || isPdfFile() || isAudioFile() ? "auto" : "4px",
        }}
      >
        <Show when={!isImageFile() && !isAudioFile() && overflowIndex() >= 0}>
          <button
            onClick={(event) => {
              event.stopPropagation();
              setShowOverflowMenu((value) => !value);
            }}
            title={t("toolbar.moreTools")}
            style={iconButtonStyle}
            onMouseEnter={hoverToolbarButton}
            onMouseLeave={resetToolbarButton}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="3" cy="8" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="13" cy="8" r="1.5" />
            </svg>
          </button>
        </Show>

        <Show when={!isCollaborationActive() && !isImageFile() && !isAudioFile() && activePath() && currentViewMode() !== "reading"}>
          <button
            onClick={saveCurrent}
            title={t("common.save")}
            style={{
              ...iconButtonStyle,
              width: "auto",
              padding: "0 9px",
              border: "1px solid var(--mz-border)",
              "border-radius": "var(--mz-radius-md)",
              "font-size": "var(--mz-font-size-xs)",
              "font-family": "var(--mz-font-sans)",
              "white-space": "nowrap",
              "writing-mode": "horizontal-tb",
              "word-break": "keep-all",
              "min-width": "max-content",
              "margin-right": "6px",
            }}
          >
            <span style={{ "white-space": "nowrap", "writing-mode": "horizontal-tb" }}>
              {t("common.save")}
            </span>
          </button>
        </Show>
        <Show when={isCollaborationActive()}>
          <span
            role="status"
            title={collaborationLabel()}
            style={{
              padding: "4px 8px",
              border: "1px solid var(--mz-border)",
              "border-radius": "var(--mz-radius-md)",
              color: collaborationStore.status(activePath() ?? "").connection === "error"
                ? "var(--mz-danger, #ef6b73)"
                : "var(--mz-text-secondary)",
              "font-size": "var(--mz-font-size-xs)",
              "white-space": "nowrap",
            }}
          >{collaborationLabel()}</span>
        </Show>
        <For each={modeButtons()}>{({ mode, label }) => {
          const selected = () => mode === "photocraft-license"
            ? showPhotoCraftLicense()
            : mode === "audiomass-license"
              ? showAudioMassLicense()
            : mode === "printcraft-license"
              ? showPrintCraftLicense()
              : mode === "gridcraft-license"
                ? showGridCraftLicense()
              : mode === "filmcraft-license"
                ? showFilmCraftLicense()
                : currentViewMode() === mode;
          return <button
            onClick={() => mode === "photocraft-license"
              ? openPhotoCraftLicense()
              : mode === "audiomass-license"
                ? setShowAudioMassLicense(true)
              : mode === "printcraft-license"
                ? setShowPrintCraftLicense(true)
                : mode === "gridcraft-license"
                  ? setShowGridCraftLicense(true)
                : mode === "filmcraft-license"
                  ? setShowFilmCraftLicense(true)
                  : selectMode(mode)}
            title={label}
            aria-pressed={selected()}
            style={{
              padding: "4px 7px", border: "1px solid var(--mz-border)",
              background: selected() ? "var(--mz-bg-active)" : "transparent",
              color: selected() ? "var(--mz-accent)" : "var(--mz-text-secondary)",
              cursor: "pointer", "border-radius": "var(--mz-radius-md)",
              "font-size": "var(--mz-font-size-xs)", "font-family": "var(--mz-font-sans)",
              "flex-shrink": "0",
            }}
          >{label}</button>;
        }}</For>
      </div>

      <Show when={showPrintCraftLicense()}>
        <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowPrintCraftLicense(false); }} style={{ position: "fixed", inset: "0", display: "flex", "align-items": "center", "justify-content": "center", padding: "20px", background: "rgba(0,0,0,.58)", "z-index": "20000" }}>
          <section role="dialog" aria-modal="true" aria-labelledby="printcraft-license-title" style={{ width: "min(560px, 100%)", padding: "22px", color: "var(--mz-text-primary)", background: "var(--mz-bg-secondary)", border: "1px solid var(--mz-border-strong)", "border-radius": "var(--mz-radius-lg)", "box-shadow": "0 20px 60px rgba(0,0,0,.45)" }}>
            <div style={{ display: "flex", "align-items": "center", gap: "12px", "margin-bottom": "16px" }}>
              <h2 id="printcraft-license-title" style={{ margin: "0", flex: "1", "font-size": "var(--mz-font-size-lg)" }}>{t("printcraft.licenseTitle")}</h2>
              <button type="button" title={t("common.close")} aria-label={t("common.close")} onClick={() => setShowPrintCraftLicense(false)} style={{ ...iconButtonStyle, border: "1px solid var(--mz-border)", "border-radius": "var(--mz-radius-sm)" }}>×</button>
            </div>
            <p style={{ "line-height": "1.6", color: "var(--mz-text-secondary)" }}>{t("printcraft.licenseSummary")}</p>
            <h3 style={{ "margin-bottom": "6px", "font-size": "var(--mz-font-size-md)" }}>{t("printcraft.mindzjChangesTitle")}</h3>
            <p style={{ "line-height": "1.6", color: "var(--mz-text-secondary)" }}>{t("printcraft.mindzjChanges")}</p>
            <div style={{ display: "flex", "flex-wrap": "wrap", gap: "8px", "margin-top": "18px" }}>
              <a href="https://github.com/storytold/pdfcraft" target="_blank" rel="noreferrer" style={licenseLinkStyle}>{t("printcraft.upstreamLink")}</a>
              <a href={printCraftLicenseUrl("LICENSE-MIT")} target="_blank" rel="noreferrer" style={licenseLinkStyle}>MIT License</a>
              <a href={printCraftLicenseUrl("LICENSE-APACHE")} target="_blank" rel="noreferrer" style={licenseLinkStyle}>Apache-2.0</a>
              <a href={printCraftLicenseUrl("NOTICE")} target="_blank" rel="noreferrer" style={licenseLinkStyle}>NOTICE</a>
              <a href={printCraftLicenseUrl("ATTRIBUTION.md")} target="_blank" rel="noreferrer" style={licenseLinkStyle}>{t("printcraft.attributionLink")}</a>
              <a href={printCraftLicenseUrl("OFL-BIZUDPGothic.txt")} target="_blank" rel="noreferrer" style={licenseLinkStyle}>{t("printcraft.japaneseFontLicense")}</a>
              <a href={printCraftLicenseUrl("CRAFT-FONTS-ATTRIBUTION.md")} target="_blank" rel="noreferrer" style={licenseLinkStyle}>{t("printcraft.japaneseFontCredits")}</a>
              <a href={printCraftLicenseUrl("MINDZJ-BUNDLE-NOTICE.md")} target="_blank" rel="noreferrer" style={licenseLinkStyle}>{t("printcraft.mindzjChangesTitle")}</a>
              <span style={{ width: "100%", "font-size": "var(--mz-font-size-xs)", color: "var(--mz-text-muted)" }}>PdfCraft Web {craftVersions().pdfcraft.version} · {craftVersions().pdfcraft.commit} · MindZJ host bridge</span>
            </div>
          </section>
        </div>
      </Show>

      <Show when={showGridCraftLicense()}>
        <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowGridCraftLicense(false); }} style={{ position: "fixed", inset: "0", display: "flex", "align-items": "center", "justify-content": "center", padding: "20px", background: "rgba(0,0,0,.58)", "z-index": "20000" }}>
          <section role="dialog" aria-modal="true" aria-labelledby="gridcraft-license-title" style={{ width: "min(560px, 100%)", padding: "22px", color: "var(--mz-text-primary)", background: "var(--mz-bg-secondary)", border: "1px solid var(--mz-border-strong)", "border-radius": "var(--mz-radius-lg)", "box-shadow": "0 20px 60px rgba(0,0,0,.45)" }}>
            <div style={{ display: "flex", "align-items": "center", gap: "12px", "margin-bottom": "16px" }}>
              <h2 id="gridcraft-license-title" style={{ margin: "0", flex: "1", "font-size": "var(--mz-font-size-lg)" }}>{t("gridcraft.licenseTitle")}</h2>
              <button type="button" title={t("common.close")} aria-label={t("common.close")} onClick={() => setShowGridCraftLicense(false)} style={{ ...iconButtonStyle, border: "1px solid var(--mz-border)", "border-radius": "var(--mz-radius-sm)" }}>×</button>
            </div>
            <p style={{ "line-height": "1.6", color: "var(--mz-text-secondary)" }}>{t("gridcraft.licenseSummary")}</p>
            <h3 style={{ "margin-bottom": "6px", "font-size": "var(--mz-font-size-md)" }}>{t("gridcraft.mindzjChangesTitle")}</h3>
            <p style={{ "line-height": "1.6", color: "var(--mz-text-secondary)" }}>{t("gridcraft.mindzjChanges")}</p>
            <div style={{ display: "flex", "flex-wrap": "wrap", gap: "8px", "margin-top": "18px" }}>
              <a href="https://github.com/storytold/gridcraft" target="_blank" rel="noreferrer" style={licenseLinkStyle}>{t("gridcraft.upstreamLink")}</a>
              <a href={gridCraftLicenseUrl("LICENSE-MIT")} target="_blank" rel="noreferrer" style={licenseLinkStyle}>MIT License</a>
              <a href={gridCraftLicenseUrl("LICENSE-APACHE")} target="_blank" rel="noreferrer" style={licenseLinkStyle}>Apache-2.0</a>
              <a href={gridCraftLicenseUrl("NOTICE")} target="_blank" rel="noreferrer" style={licenseLinkStyle}>NOTICE</a>
              <a href={gridCraftLicenseUrl("ATTRIBUTION.md")} target="_blank" rel="noreferrer" style={licenseLinkStyle}>{t("gridcraft.attributionLink")}</a>
              <a href={gridCraftLicenseUrl("MINDZJ-BUNDLE-NOTICE.md")} target="_blank" rel="noreferrer" style={licenseLinkStyle}>{t("gridcraft.mindzjChangesTitle")}</a>
              <a href={gridCraftLicenseUrl("OFL-BIZUDPGothic.txt")} target="_blank" rel="noreferrer" style={licenseLinkStyle}>{t("printcraft.japaneseFontLicense")}</a>
              <a href={gridCraftLicenseUrl("CRAFT-FONTS-ATTRIBUTION.md")} target="_blank" rel="noreferrer" style={licenseLinkStyle}>{t("printcraft.japaneseFontCredits")}</a>
              <span style={{ width: "100%", "font-size": "var(--mz-font-size-xs)", color: "var(--mz-text-muted)" }}>GridCraft Web {craftVersions().gridcraft.version} · {craftVersions().gridcraft.commit} · MindZJ bridge + Japanese font</span>
            </div>
          </section>
        </div>
      </Show>

      <Show when={showFilmCraftLicense()}>
        <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowFilmCraftLicense(false); }} style={{ position: "fixed", inset: "0", display: "flex", "align-items": "center", "justify-content": "center", padding: "20px", background: "rgba(0,0,0,.58)", "z-index": "20000" }}>
          <section role="dialog" aria-modal="true" aria-labelledby="filmcraft-license-title" style={{ width: "min(560px, 100%)", "max-height": "min(80vh, 700px)", overflow: "auto", padding: "22px", color: "var(--mz-text-primary)", background: "var(--mz-bg-secondary)", border: "1px solid var(--mz-border-strong)", "border-radius": "var(--mz-radius-lg)", "box-shadow": "0 20px 60px rgba(0,0,0,.45)" }}>
            <div style={{ display: "flex", "align-items": "center", gap: "12px", "margin-bottom": "16px" }}>
              <h2 id="filmcraft-license-title" style={{ margin: "0", flex: "1", "font-size": "var(--mz-font-size-lg)" }}>{t("filmcraft.licenseTitle")}</h2>
              <button type="button" title={t("common.close")} aria-label={t("common.close")} onClick={() => setShowFilmCraftLicense(false)} style={{ ...iconButtonStyle, border: "1px solid var(--mz-border)", "border-radius": "var(--mz-radius-sm)" }}>×</button>
            </div>
            <p style={{ "line-height": "1.6", color: "var(--mz-text-secondary)" }}>{t("filmcraft.licenseSummary")}</p>
            <h3 style={{ "margin-bottom": "6px", "font-size": "var(--mz-font-size-md)" }}>{t("filmcraft.mindzjChangesTitle")}</h3>
            <p style={{ "line-height": "1.6", color: "var(--mz-text-secondary)" }}>{t("filmcraft.mindzjChanges")}</p>
            <p style={{ "font-size": "var(--mz-font-size-xs)", color: "var(--mz-text-muted)" }}>FilmCraft Web 0.2.1 · official release files are unmodified</p>
            <div style={{ display: "flex", "flex-wrap": "wrap", gap: "8px", "margin-top": "18px" }}>
              <a href="https://github.com/storytold/filmcraft" target="_blank" rel="noreferrer" style={licenseLinkStyle}>{t("filmcraft.upstreamLink")}</a>
              <a href={filmCraftLicenseUrl("LICENSE-MIT")} target="_blank" rel="noreferrer" style={licenseLinkStyle}>MIT License</a>
              <a href={filmCraftLicenseUrl("LICENSE-APACHE")} target="_blank" rel="noreferrer" style={licenseLinkStyle}>Apache-2.0</a>
              <a href={filmCraftLicenseUrl("NOTICE")} target="_blank" rel="noreferrer" style={licenseLinkStyle}>NOTICE</a>
              <a href={filmCraftLicenseUrl("ATTRIBUTION.md")} target="_blank" rel="noreferrer" style={licenseLinkStyle}>{t("filmcraft.attributionLink")}</a>
              <a href={filmCraftLicenseUrl("LICENSE-brand.txt")} target="_blank" rel="noreferrer" style={licenseLinkStyle}>{t("filmcraft.brandLicense")}</a>
            </div>
          </section>
        </div>
      </Show>

      <Show when={showAudioMassLicense()}>
        <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowAudioMassLicense(false); }} style={{ position: "fixed", inset: "0", display: "flex", "align-items": "center", "justify-content": "center", padding: "20px", background: "rgba(0,0,0,.58)", "z-index": "20000" }}>
          <section role="dialog" aria-modal="true" aria-labelledby="audiomass-license-title" style={{ width: "min(560px, 100%)", "max-height": "min(80vh, 700px)", overflow: "auto", padding: "22px", color: "var(--mz-text-primary)", background: "var(--mz-bg-secondary)", border: "1px solid var(--mz-border-strong)", "border-radius": "var(--mz-radius-lg)", "box-shadow": "0 20px 60px rgba(0,0,0,.45)" }}>
            <div style={{ display: "flex", "align-items": "center", gap: "12px", "margin-bottom": "16px" }}>
              <h2 id="audiomass-license-title" style={{ margin: "0", flex: "1", "font-size": "var(--mz-font-size-lg)" }}>{t("audiomass.licenseTitle")}</h2>
              <button type="button" title={t("common.close")} aria-label={t("common.close")} onClick={() => setShowAudioMassLicense(false)} style={{ ...iconButtonStyle, border: "1px solid var(--mz-border)", "border-radius": "var(--mz-radius-sm)" }}>×</button>
            </div>
            <p style={{ "line-height": "1.6", color: "var(--mz-text-secondary)" }}>{t("audiomass.licenseSummary")}</p>
            <h3 style={{ "margin-bottom": "6px", "font-size": "var(--mz-font-size-md)" }}>{t("audiomass.mindzjChangesTitle")}</h3>
            <p style={{ "line-height": "1.6", color: "var(--mz-text-secondary)" }}>{t("audiomass.mindzjChanges")}</p>
            <p style={{ "font-size": "var(--mz-font-size-xs)", color: "var(--mz-text-muted)" }}>AudioMass · upstream source is bundled with integration changes</p>
            <div style={{ display: "flex", "flex-wrap": "wrap", gap: "8px", "margin-top": "18px" }}>
              <a href="https://github.com/pkalogiros/AudioMass" target="_blank" rel="noreferrer" style={licenseLinkStyle}>{t("audiomass.upstreamLink")}</a>
              <a href={audioMassResourceUrl("LICENSE")} target="_blank" rel="noreferrer" style={licenseLinkStyle}>MIT License</a>
              <a href={audioMassResourceUrl("THIRD_PARTY_NOTICES.md")} target="_blank" rel="noreferrer" style={licenseLinkStyle}>{t("audiomass.thirdPartyNotices")}</a>
              <a href={audioMassResourceUrl("MINDZJ-INTEGRATION.md")} target="_blank" rel="noreferrer" style={licenseLinkStyle}>{t("audiomass.integrationNotes")}</a>
            </div>
          </section>
        </div>
      </Show>

      <Show when={showPhotoCraftLicense()}>
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowPhotoCraftLicense(false);
          }}
          style={{
            position: "fixed",
            inset: "0",
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            padding: "20px",
            background: "rgba(0,0,0,.58)",
            "z-index": "20000",
          }}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="photocraft-license-title"
            style={{
              width: "min(560px, 100%)",
              "max-height": "min(80vh, 700px)",
              overflow: "auto",
              padding: "22px",
              color: "var(--mz-text-primary)",
              background: "var(--mz-bg-secondary)",
              border: "1px solid var(--mz-border-strong)",
              "border-radius": "var(--mz-radius-lg)",
              "box-shadow": "0 20px 60px rgba(0,0,0,.45)",
            }}>
            <div style={{ display: "flex", "align-items": "center", gap: "12px", "margin-bottom": "16px" }}>
              <h2 id="photocraft-license-title" style={{ margin: "0", flex: "1", "font-size": "var(--mz-font-size-lg)" }}>
                {t("photocraft.licenseTitle")}
              </h2>
              <button
                type="button"
                title={t("common.close")}
                aria-label={t("common.close")}
                onClick={() => setShowPhotoCraftLicense(false)}
                style={{ ...iconButtonStyle, border: "1px solid var(--mz-border)", "border-radius": "var(--mz-radius-sm)" }}>
                ×
              </button>
            </div>
            <p style={{ "line-height": "1.6", color: "var(--mz-text-secondary)" }}>
              {t("photocraft.licenseSummary")}
            </p>
            <h3 style={{ "margin-bottom": "6px", "font-size": "var(--mz-font-size-md)" }}>
              {t("photocraft.mindzjChangesTitle")}
            </h3>
            <p style={{ "line-height": "1.6", color: "var(--mz-text-secondary)" }}>
              {t("photocraft.mindzjChanges")}
            </p>
            <p style={{ "font-size": "var(--mz-font-size-xs)", color: "var(--mz-text-muted)" }}>
              PhotoCraft Web {craftVersions().photocraft.version} · {craftVersions().photocraft.commit} · MindZJ Vault bridge
            </p>
            <div style={{ display: "flex", "flex-wrap": "wrap", gap: "8px", "margin-top": "18px" }}>
              <a href="https://github.com/storytold/photocraft" target="_blank" rel="noreferrer" style={licenseLinkStyle}>{t("photocraft.upstreamLink")}</a>
              <a href={photoCraftLicenseUrl("LICENSE-MIT")} target="_blank" rel="noreferrer" style={licenseLinkStyle}>MIT License</a>
              <a href={photoCraftLicenseUrl("LICENSE-APACHE")} target="_blank" rel="noreferrer" style={licenseLinkStyle}>Apache-2.0</a>
              <a href={photoCraftLicenseUrl("NOTICE")} target="_blank" rel="noreferrer" style={licenseLinkStyle}>NOTICE</a>
              <a href={photoCraftLicenseUrl("ATTRIBUTION.md")} target="_blank" rel="noreferrer" style={licenseLinkStyle}>{t("photocraft.attributionLink")}</a>
              <a href={photoCraftLicenseUrl("MINDZJ-BUNDLE-NOTICE.md")} target="_blank" rel="noreferrer" style={licenseLinkStyle}>{t("photocraft.mindzjChangesTitle")}</a>
              <a href={photoCraftLicenseUrl("MINDZJ-BUNDLE-NOTICE.md")} target="_blank" rel="noreferrer" style={licenseLinkStyle}>{t("photocraft.mindzjChangesTitle")}</a>
            </div>
          </section>
        </div>
      </Show>

      <Show when={showHeadingMenu()}>
        <div
          id="mz-heading-dropdown"
          style={{
            position: "fixed",
            top: `${headingMenuPos().y}px`,
            left: `${headingMenuPos().x}px`,
            "min-width": "130px",
            background: "var(--mz-bg-secondary)",
            border: "1px solid var(--mz-border-strong)",
            "border-radius": "var(--mz-radius-md)",
            "box-shadow": "0 4px 16px rgba(0,0,0,0.25)",
            padding: "4px 0",
            "z-index": "10000",
          }}
          onMouseLeave={() => setShowHeadingMenu(false)}
        >
          <For each={headingItems()}>
            {(item) => (
              <button
                onClick={() => {
                  dispatchCommand(item);
                  setShowHeadingMenu(false);
                }}
                style={dropdownButtonStyle}
                onMouseEnter={hoverDropdownButton}
                onMouseLeave={resetDropdownButton}
              >
                <span>{translateLabel(item)}</span>
                <span style={shortcutStyle}>{item.shortcut}</span>
              </button>
            )}
          </For>
        </div>
      </Show>

      <Show when={showImagePicker()}>
        <ImagePicker
          onClose={() => setShowImagePicker(false)}
          onSelect={(path) => {
            const fileName = path.split("/").pop() ?? path;
            document.dispatchEvent(new CustomEvent("mindzj:insert-text", {
              // Leading slash marks this as Vault-root-relative. Picker paths
              // already come from the Vault tree; treating them as note-relative
              // duplicated parent folders for notes outside the Vault root.
              detail: { text: `![${fileName}](/${path})` },
            }));
            setShowImagePicker(false);
          }}
        />
      </Show>

      <Show when={showMarkerMenu()}>
        <div
          id="mz-marker-dropdown"
          style={{
            position: "fixed",
            top: `${markerMenuPos().y}px`,
            left: `${markerMenuPos().x}px`,
            display: "flex",
            gap: "6px",
            background: "var(--mz-bg-secondary)",
            border: "1px solid var(--mz-border-strong)",
            "border-radius": "var(--mz-radius-md)",
            "box-shadow": "0 4px 16px rgba(0,0,0,0.25)",
            padding: "6px",
            "z-index": "10000",
          }}
        >
          <For each={markerColors()}>
            {(color) => (
              <button
                title={`${t("toolbar.markImportant")} ${color.color}`}
                onClick={() => applyMarkerColor(color.color)}
                style={{
                  width: "24px",
                  height: "24px",
                  border: "1px solid var(--mz-border-strong)",
                  background: color.color,
                  cursor: "pointer",
                  "border-radius": "var(--mz-radius-sm)",
                  padding: "0",
                }}
                onMouseEnter={(event) => {
                  event.currentTarget.style.transform = "translateY(-1px)";
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.transform = "none";
                }}
              />
            )}
          </For>
        </div>
      </Show>

      <Show when={showOverflowMenu()}>
        <div
          id="mz-overflow-dropdown"
          style={{
            position: "fixed",
            top: `${(toolbarRef?.getBoundingClientRect().bottom ?? 40) + 2}px`,
            right: `${window.innerWidth - (rightAreaRef?.getBoundingClientRect().right ?? window.innerWidth)}px`,
            "min-width": "180px",
            background: "var(--mz-bg-secondary)",
            border: "1px solid var(--mz-border-strong)",
            "border-radius": "var(--mz-radius-md)",
            "box-shadow": "0 4px 16px rgba(0,0,0,0.3)",
            padding: "4px 0",
            "z-index": "10000",
          }}
          onMouseLeave={() => setShowOverflowMenu(false)}
        >
          <For each={overflowItems()}>
            {(item) => (
              <>
                <button
                  onClick={(event) => {
                    dispatchCommand(item, event);
                    setShowOverflowMenu(false);
                  }}
                  style={dropdownButtonStyle}
                  onMouseEnter={hoverDropdownButton}
                  onMouseLeave={resetDropdownButton}
                >
                  <span style={{ display: "flex", "align-items": "center", gap: "8px" }}>
                    <span style={{ "min-width": "20px", "text-align": "center" }}>
                      <ToolbarIcon item={item} />
                    </span>
                    {translateLabel(item)}
                  </span>
                  <Show when={item.shortcut}>
                    <span style={shortcutStyle}>{item.shortcut}</span>
                  </Show>
                </button>
                <Show when={item.separator}>
                  <div style={{ height: "1px", background: "var(--mz-border)", margin: "4px 8px" }} />
                </Show>
              </>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};

function photoCraftLicenseUrl(fileName: string): string {
  const appBase = new URL(import.meta.env.BASE_URL, window.location.origin);
  return new URL(`photocraft/${fileName}`, appBase).toString();
}

function printCraftLicenseUrl(fileName: string): string {
  const appBase = new URL(import.meta.env.BASE_URL, window.location.origin);
  return new URL(`pdfcraft/${fileName}`, appBase).toString();
}

function gridCraftLicenseUrl(fileName: string): string {
  const appBase = new URL(import.meta.env.BASE_URL, window.location.origin);
  return new URL(`gridcraft/${fileName}`, appBase).toString();
}

function filmCraftLicenseUrl(fileName: string): string {
  const appBase = new URL(import.meta.env.BASE_URL, window.location.origin);
  return new URL(`filmcraft/${fileName}`, appBase).toString();
}

function audioMassResourceUrl(fileName: string): string {
  const appBase = new URL(import.meta.env.BASE_URL, window.location.origin);
  return new URL(`audiomass/${fileName}`, appBase).toString();
}

const licenseLinkStyle = {
  display: "inline-flex",
  "align-items": "center",
  padding: "7px 10px",
  color: "var(--mz-accent)",
  border: "1px solid var(--mz-border)",
  "border-radius": "var(--mz-radius-md)",
  "text-decoration": "none",
  "font-size": "var(--mz-font-size-sm)",
};

const ToolbarBtn: Component<{
  item: ToolbarButton;
  label: string;
  onClick: (event: MouseEvent) => void;
}> = (props) => (
  <button
    data-toolbar-command={props.item.command}
    onClick={(event) => props.onClick(event)}
    title={`${
      props.item.command === "numbered-list"
        ? t("toolbar.numberedListToggleHint")
        : props.label
    }${props.item.shortcut ? ` (${props.item.shortcut})` : ""}`}
    style={{
      display: "flex",
      "align-items": "center",
      "justify-content": "center",
      "min-width": "28px",
      height: "28px",
      border: "none",
      background: "transparent",
      color: "var(--mz-text-secondary)",
      cursor: "pointer",
      "border-radius": "var(--mz-radius-sm)",
      "font-size": "13px",
      "font-weight": props.item.icon === "B" ? "700" : "400",
      "font-style": props.item.icon === "I" ? "italic" : "normal",
      "text-decoration":
        props.item.command === "underline"
          ? "underline"
          : props.item.command === "strikethrough"
            ? "line-through"
            : "none",
      padding: "0 4px",
      "font-family": "var(--mz-font-sans)",
      "flex-shrink": "0",
    }}
    onMouseEnter={hoverToolbarButton}
    onMouseLeave={resetToolbarButton}
  >
    <ToolbarIcon item={props.item} />
  </button>
);

const ToolbarIcon: Component<{ item: ToolbarButton }> = (props) => (
  <Show
    when={typeof props.item.icon === "string"}
    fallback={
      <Dynamic
        component={props.item.icon as Component<any>}
        size={15}
        strokeWidth={2}
      />
    }
  >
    {props.item.icon as string}
  </Show>
);

const ToolbarSep: Component = () => (
  <div
    style={{
      width: "1px",
      height: "16px",
      background: "var(--mz-border)",
      margin: "0 3px",
      "flex-shrink": "0",
    }}
  />
);

const headingButtonStyle = {
  display: "flex",
  "align-items": "center",
  gap: "2px",
  "min-width": "28px",
  height: "28px",
  border: "none",
  background: "transparent",
  color: "var(--mz-text-secondary)",
  cursor: "pointer",
  "border-radius": "var(--mz-radius-sm)",
  "font-size": "13px",
  padding: "0 6px",
  "font-family": "var(--mz-font-sans)",
  "flex-shrink": "0",
} as const;

const iconButtonStyle = {
  display: "flex",
  "align-items": "center",
  "justify-content": "center",
  width: "28px",
  height: "28px",
  border: "none",
  background: "transparent",
  color: "var(--mz-text-secondary)",
  cursor: "pointer",
  "border-radius": "var(--mz-radius-sm)",
} as const;

const dropdownButtonStyle = {
  display: "flex",
  "align-items": "center",
  "justify-content": "space-between",
  width: "100%",
  padding: "6px 12px",
  border: "none",
  background: "transparent",
  color: "var(--mz-text-primary)",
  cursor: "pointer",
  "font-size": "var(--mz-font-size-sm)",
  "font-family": "var(--mz-font-sans)",
  "text-align": "left" as const,
} as const;

const shortcutStyle = {
  "font-size": "var(--mz-font-size-xs)",
  color: "var(--mz-text-muted)",
  "font-family": "var(--mz-font-mono)",
} as const;

function hoverToolbarButton(event: MouseEvent) {
  const target = event.currentTarget as HTMLElement;
  target.style.background = "var(--mz-bg-hover)";
  target.style.color = "var(--mz-text-primary)";
}

function resetToolbarButton(event: MouseEvent) {
  const target = event.currentTarget as HTMLElement;
  target.style.background = "transparent";
  target.style.color = "var(--mz-text-secondary)";
}

function hoverDropdownButton(event: MouseEvent) {
  (event.currentTarget as HTMLElement).style.background = "var(--mz-bg-hover)";
}

function resetDropdownButton(event: MouseEvent) {
  (event.currentTarget as HTMLElement).style.background = "transparent";
}
