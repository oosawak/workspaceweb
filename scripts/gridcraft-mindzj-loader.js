// MindZJ bridge for the GridCraft static WebAssembly build.
(function () {
  const params = new URLSearchParams(window.location.search);
  const fileUrl = params.get("mindzj_file_url");
  const fileName = params.get("mindzj_file_name") || "workbook.xlsx";
  const token = params.get("mindzj_token");
  const channel = token && typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel(`mindzj-gridcraft:${token}`)
    : null;
  let appStarted = false;
  let appReady = false;
  let pendingFile = null;

  function dropFile(file) {
    const canvas = document.getElementById("gridcraft_canvas");
    if (!canvas || !file) return;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    ["dragenter", "dragover", "drop"].forEach(function (type) {
      canvas.dispatchEvent(new DragEvent(type, {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer,
      }));
    });
  }

  function checkReady(observer) {
    if (!appStarted || document.getElementById("gridcraft_loading")) return;
    appReady = true;
    observer.disconnect();
    if (pendingFile) {
      dropFile(pendingFile);
      pendingFile = null;
    }
  }

  window.addEventListener("TrunkApplicationStarted", function () {
    appStarted = true;
    const observer = new MutationObserver(function () { checkReady(observer); });
    observer.observe(document.body, { childList: true, subtree: true });
    checkReady(observer);
  }, { once: true });

  function queueFile(blob, name) {
    const file = new File([blob], name || fileName, { type: blob.type || "application/octet-stream" });
    if (appReady) dropFile(file);
    else pendingFile = file;
  }

  function showNotice(message, success) {
    let notice = document.getElementById("mindzj-gridcraft-notice");
    if (!notice) {
      notice = document.createElement("div");
      notice.id = "mindzj-gridcraft-notice";
      Object.assign(notice.style, {
        position: "fixed", top: "14px", right: "14px", zIndex: "2147483647",
        padding: "9px 13px", borderRadius: "8px", color: "white",
        font: "14px system-ui, sans-serif", boxShadow: "0 4px 16px rgba(0,0,0,.35)",
      });
      document.body.appendChild(notice);
    }
    notice.textContent = message;
    notice.style.background = success ? "#15803d" : "#b91c1c";
    window.setTimeout(function () { notice.remove(); }, 5000);
  }

  if (channel) {
    const pendingSaves = new Map();
    let saveSequence = 0;
    const originalShowSaveFilePicker = window.showSaveFilePicker?.bind(window);
    if (originalShowSaveFilePicker) {
      // GridCraft uses the File System Access API on supported browsers. Replace
      // its native picker with a small compatible handle that sends the bytes
      // to MindZJ when GridCraft closes the writable stream.
      const mindzjSaveFilePicker = async function (options) {
        const suggestedName = options?.suggestedName || fileName;
        const chunks = [];
        let closed = false;
        return {
          name: suggestedName,
          async createWritable() {
            return {
              async write(data) {
                if (data && typeof data === "object" && "data" in data) data = data.data;
                chunks.push(data instanceof Blob ? data : new Blob([data]));
              },
              async close() {
                if (closed) return;
                closed = true;
                const requestId = `gridcraft-${Date.now()}-${++saveSequence}`;
                const result = new Promise((resolve, reject) => pendingSaves.set(requestId, { resolve, reject }));
                channel.postMessage({
                  type: "saved-file",
                  requestId,
                  fileName: suggestedName,
                  blob: new Blob(chunks, { type: "application/octet-stream" }),
                });
                await result;
              },
              async abort() { chunks.length = 0; },
            };
          },
        };
      };
      Object.defineProperty(window, "showSaveFilePicker", {
        configurable: true,
        value: mindzjSaveFilePicker,
      });
    }
    const originalClick = HTMLAnchorElement.prototype.click;
    const originalCreateObjectURL = URL.createObjectURL.bind(URL);
    const originalRevokeObjectURL = URL.revokeObjectURL.bind(URL);
    const objectUrlBlobs = new Map();
    const retryDownload = new WeakSet();
    URL.createObjectURL = function (blob) {
      const url = originalCreateObjectURL(blob);
      objectUrlBlobs.set(url, blob);
      return url;
    };
    URL.revokeObjectURL = function (url) {
      objectUrlBlobs.delete(url);
      originalRevokeObjectURL(url);
    };
    const transferDownload = function (anchor) {
      showNotice("Sending workbook to MindZJ…", true);
      // GridCraft revokes its object URL after clicking the download link.
      // Retain the Blob itself so the Vault transfer survives that revoke.
      const savedBlob = objectUrlBlobs.get(anchor.href);
      const blobPromise = savedBlob
        ? Promise.resolve(savedBlob)
        : fetch(anchor.href).then(function (response) {
          if (!response.ok) throw new Error("HTTP " + response.status);
          return response.blob();
        });
      blobPromise
        .then(function (blob) {
          channel.postMessage({ type: "saved-file", fileName: anchor.download || fileName, blob });
        })
        .catch(function (error) {
          console.error("Could not transfer the GridCraft workbook to MindZJ:", error);
          retryDownload.add(anchor);
          originalClick.call(anchor);
          showNotice("Could not save to the Vault; downloaded a copy instead.", false);
        });
    };
    document.addEventListener("click", function (event) {
      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      const anchor = path.find((node) => node instanceof HTMLAnchorElement &&
        (node.hasAttribute("download") || node.href.startsWith("blob:")))
        || (event.target && event.target.closest ? event.target.closest("a[download], a[href^='blob:']") : null);
      if (!anchor || !anchor.href ||
          (!anchor.hasAttribute("download") && !anchor.href.startsWith("blob:"))) return;
      if (retryDownload.has(anchor)) {
        retryDownload.delete(anchor);
        return;
      }
      // Route every GridCraft export into MindZJ. The host writes same-format
      // exports over the opened file and saves format changes as sibling files.
      event.preventDefault();
      event.stopImmediatePropagation();
      transferDownload(anchor);
    }, true);
    HTMLAnchorElement.prototype.click = function () {
      if (this.href.startsWith("blob:")) {
        transferDownload(this);
        return;
      }
      originalClick.call(this);
    };

    channel.onmessage = function (event) {
      if (event.data?.type !== "save-result") return;
      const pending = event.data.requestId && pendingSaves.get(event.data.requestId);
      if (pending) {
        pendingSaves.delete(event.data.requestId);
        if (event.data.ok) pending.resolve();
        else pending.reject(new Error(event.data.message || "Could not save to Vault."));
      }
      if (event.data.ok) showNotice("Saved to Vault: " + (event.data.fileName || fileName), true);
      else showNotice(event.data.message || "Could not save to Vault.", false);
    };
    channel.postMessage({ type: "ready" });
  }

  if (!fileUrl) return;
  let parsed;
  try { parsed = new URL(fileUrl, window.location.href); }
  catch (error) { console.error("MindZJ GridCraft loader rejected the file URL:", error); return; }
  if (parsed.origin !== window.location.origin || !["http:", "https:"].includes(parsed.protocol)) {
    console.error("MindZJ GridCraft loader rejected a file URL from another origin.");
    return;
  }

  fetch(parsed, { credentials: "same-origin" })
    .then(function (response) {
      if (!response.ok) throw new Error("HTTP " + response.status);
      return response.blob();
    })
    .then(function (blob) { queueFile(blob, fileName); })
    .catch(function (error) {
      console.error("MindZJ could not load the selected spreadsheet into GridCraft:", error);
    });
})();
