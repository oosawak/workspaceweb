// Load a selected MindZJ Vault image after PhotoCraft's web runner is ready.
(function () {
  const params = new URLSearchParams(window.location.search);
  let imageUrl = params.get("mindzj_image_url");
  let imageName = params.get("mindzj_image_name") || "image";
  const token = params.get("mindzj_image_token");
  const vaultFilePath = params.get("mindzj_vault_file_path");
  const vaultFileName = vaultFilePath ? vaultFilePath.split(/[\\/]/).pop() : null;
  let appStarted = false;
  let appReady = false;
  let pendingFile = null;

  function dropFile(file) {
    const canvas = document.getElementById("photocraft_canvas");
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

  function checkRunnerReady(observer) {
    if (!appStarted || document.getElementById("photocraft_loading")) return;
    appReady = true;
    observer.disconnect();
    if (pendingFile) {
      dropFile(pendingFile);
      pendingFile = null;
    }
  }

  window.addEventListener("TrunkApplicationStarted", function () {
    appStarted = true;
    const observer = new MutationObserver(function () {
      checkRunnerReady(observer);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    checkRunnerReady(observer);
  }, { once: true });

  function queueImage(blob, name) {
    const file = new File([blob], name || imageName, {
      type: blob.type || "application/octet-stream",
    });
    if (appReady) dropFile(file);
    else pendingFile = file;
  }

  function showSaveNotice(message, success) {
    let notice = document.getElementById("mindzj-photocraft-save-notice");
    if (!notice) {
      notice = document.createElement("div");
      notice.id = "mindzj-photocraft-save-notice";
      Object.assign(notice.style, {
        position: "fixed",
        top: "16px",
        right: "16px",
        zIndex: "2147483647",
        padding: "10px 14px",
        borderRadius: "8px",
        color: "white",
        font: "14px system-ui, sans-serif",
        boxShadow: "0 4px 16px rgba(0,0,0,.4)",
      });
      document.body.appendChild(notice);
    }
    notice.textContent = message;
    notice.style.background = success ? "#15803d" : "#b91c1c";
    window.setTimeout(function () { notice.remove(); }, 5000);
  }

  function interceptSaveDownloads(channel) {
    if (!vaultFilePath || !vaultFileName || !window.HTMLAnchorElement) return;
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
      // Keep a direct reference to generated blobs: PhotoCraft revokes its
      // object URL immediately after clicking the download link.
      const savedBlob = objectUrlBlobs.get(anchor.href);
      const blobPromise = savedBlob
        ? Promise.resolve(savedBlob)
        : fetch(anchor.href).then(function (response) {
          if (!response.ok) throw new Error("HTTP " + response.status);
          return response.blob();
        });
      blobPromise
        .then(function (blob) {
          channel.postMessage({
            type: "saved-file",
            fileName: anchor.download || vaultFileName,
            blob,
          });
          showSaveNotice("Sending " + (anchor.download || vaultFileName) + " to MindZJ…", true);
        })
        .catch(function (error) {
          console.error("Could not transfer the saved file to MindZJ:", error);
          retryDownload.add(anchor);
          originalClick.call(anchor);
          showSaveNotice("Could not save to the Vault; downloaded a copy instead.", false);
        });
    };
    document.addEventListener("click", function (event) {
      const anchor = event.target && event.target.closest
        ? event.target.closest("a[download]")
        : null;
      if (!anchor || !anchor.href.startsWith("blob:")) return;
      if (retryDownload.has(anchor)) {
        retryDownload.delete(anchor);
        return;
      }
      // Route exports back to MindZJ even when PhotoCraft changes the name or
      // format. The host overwrites same-format edits and stores conversions
      // beside the source using the exported extension.
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
  }

  if (token && typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(`mindzj-photocraft:${token}`);
    interceptSaveDownloads(channel);
    channel.onmessage = function (event) {
      if (event.data?.type === "image" && event.data.blob instanceof Blob) {
        imageName = typeof event.data.imageName === "string" ? event.data.imageName : imageName;
        queueImage(event.data.blob, imageName);
      } else if (event.data?.type === "save-result") {
        showSaveNotice(
          event.data.ok ? `Saved to Vault: ${event.data.fileName}` : (event.data.message || "Could not save to Vault."),
          Boolean(event.data.ok),
        );
      }
    };
    channel.postMessage({ type: "ready" });
    return;
  }

  if (!imageUrl) return;
  const parsedImageUrl = new URL(imageUrl, window.location.href);
  if (parsedImageUrl.protocol !== "data:" && parsedImageUrl.origin !== window.location.origin) {
    console.error("MindZJ PhotoCraft loader rejected an image URL from another origin.");
    return;
  }
  fetch(parsedImageUrl, { credentials: "same-origin" })
    .then(function (response) {
      if (!response.ok) throw new Error("Image request failed (" + response.status + ")");
      return response.blob();
    })
    .then(function (blob) { queueImage(blob, imageName); })
    .catch(function (error) {
      console.error("MindZJ could not load the selected image in PhotoCraft:", error);
    });
})();
