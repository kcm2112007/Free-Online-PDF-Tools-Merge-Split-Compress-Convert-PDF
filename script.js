/*! PDF Tools — single-file build. Generated from the multi-page version; same functionality, one script. */
(function () {
"use strict";

// ============================================================
// SHARED UTILITIES (formerly pdf-common.js)
// ============================================================
"use strict";

  var loadedScripts = {};

  /** Dynamically load a script from CDN once, cache the promise. */
  function loadScript(src) {
    if (loadedScripts[src]) return loadedScripts[src];
    loadedScripts[src] = new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-src="' + src + '"]');
      if (existing) {
        existing.addEventListener("load", resolve);
        existing.addEventListener("error", reject);
        return;
      }
      var s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.dataset.src = src;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("Failed to load " + src)); };
      document.head.appendChild(s);
    });
    return loadedScripts[src];
  }

  function formatBytes(bytes) {
    if (bytes === 0) return "0 B";
    var units = ["B", "KB", "MB", "GB"];
    var i = Math.floor(Math.log(bytes) / Math.log(1024));
    i = Math.min(i, units.length - 1);
    return (bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1) + " " + units[i];
  }

  function extOf(name) {
    var m = /\.([a-z0-9]+)$/i.exec(name || "");
    return m ? m[1].toLowerCase() : "";
  }

  /**
   * Validate a file against accepted extensions / mime prefixes and a max size.
   * opts: { accept: ['.pdf'], mime: ['application/pdf'], maxSizeMB: 50 }
   */
  function validateFile(file, opts) {
    opts = opts || {};
    if (opts.maxSizeMB && file.size > opts.maxSizeMB * 1024 * 1024) {
      return { ok: false, error: file.name + " is " + formatBytes(file.size) + " — the limit for this tool is " + opts.maxSizeMB + " MB." };
    }
    if (opts.accept && opts.accept.length) {
      var ext = "." + extOf(file.name);
      var extOk = opts.accept.indexOf(ext) !== -1;
      var mimeOk = !opts.mime || !opts.mime.length || opts.mime.indexOf(file.type) !== -1 || file.type === "";
      if (!extOk && !mimeOk) {
        return { ok: false, error: file.name + " isn't a supported file type. Expected: " + opts.accept.join(", ") };
      }
    }
    if (file.size === 0) {
      return { ok: false, error: file.name + " appears to be empty or corrupted." };
    }
    return { ok: true };
  }

  /**
   * Wire up a dropzone element + hidden file input for drag/drop, click-to-browse,
   * and keyboard activation. Calls onFiles(FileList) whenever new files are chosen.
   */
  function initDropzone(dropzoneEl, inputEl, opts) {
    opts = opts || {};
    function open() { inputEl.click(); }

    dropzoneEl.addEventListener("click", open);
    dropzoneEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
    });
    dropzoneEl.setAttribute("tabindex", "0");
    dropzoneEl.setAttribute("role", "button");

    ["dragenter", "dragover"].forEach(function (evt) {
      dropzoneEl.addEventListener(evt, function (e) {
        e.preventDefault(); e.stopPropagation();
        dropzoneEl.classList.add("dragover");
      });
    });
    ["dragleave", "drop"].forEach(function (evt) {
      dropzoneEl.addEventListener(evt, function (e) {
        e.preventDefault(); e.stopPropagation();
        dropzoneEl.classList.remove("dragover");
      });
    });
    dropzoneEl.addEventListener("drop", function (e) {
      var files = e.dataTransfer.files;
      if (files && files.length && opts.onFiles) opts.onFiles(files);
    });
    inputEl.addEventListener("change", function () {
      if (inputEl.files && inputEl.files.length && opts.onFiles) opts.onFiles(inputEl.files);
      inputEl.value = "";
    });
  }

  /** Render a simple removable file list into a <ul>. items: [{name,size,id}] */
  function renderFileList(ulEl, items, onRemove) {
    ulEl.innerHTML = "";
    items.forEach(function (item) {
      var li = document.createElement("li");
      li.className = "pdft-fileitem";
      var name = document.createElement("span");
      name.className = "name"; name.textContent = item.name;
      var size = document.createElement("span");
      size.className = "size"; size.textContent = formatBytes(item.size);
      var rm = document.createElement("button");
      rm.type = "button"; rm.className = "remove"; rm.setAttribute("aria-label", "Remove " + item.name);
      rm.innerHTML = "✕";
      rm.addEventListener("click", function () { onRemove(item.id); });
      li.appendChild(name); li.appendChild(size); li.appendChild(rm);
      ulEl.appendChild(li);
    });
  }

  function showMsg(el, text, type) {
    el.textContent = text;
    el.className = "pdft-msg show " + (type || "info");
  }
  function hideMsg(el) {
    el.className = "pdft-msg";
  }

  function setProgress(container, fillEl, labelEl, pct, label) {
    container.classList.add("active");
    fillEl.style.width = Math.max(0, Math.min(100, pct)) + "%";
    if (labelEl) labelEl.textContent = label || (Math.round(pct) + "%");
  }
  function resetProgress(container, fillEl) {
    container.classList.remove("active");
    fillEl.style.width = "0%";
  }

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function readFileAsArrayBuffer(file) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
      r.readAsArrayBuffer(file);
    });
  }

  function baseName(name) {
    return name.replace(/\.[^/.]+$/, "");
  }

  function uid() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  // Nav toggle (mobile) + set active link — runs on all pages automatically.
  document.addEventListener("DOMContentLoaded", function () {
    var toggle = document.querySelector(".pdft-nav-toggle");
    var links = document.querySelector(".pdft-nav-links");
    if (toggle && links) {
      toggle.addEventListener("click", function () {
        var open = links.classList.toggle("open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
    }
  });

  window.PDFToolsCommon = {
    loadScript: loadScript,
    formatBytes: formatBytes,
    validateFile: validateFile,
    initDropzone: initDropzone,
    renderFileList: renderFileList,
    showMsg: showMsg,
    hideMsg: hideMsg,
    setProgress: setProgress,
    resetProgress: resetProgress,
    downloadBlob: downloadBlob,
    readFileAsArrayBuffer: readFileAsArrayBuffer,
    baseName: baseName,
    uid: uid
  };

// ============================================================
// PAGE MANAGER (formerly page-manager.js)
// ============================================================
"use strict";

  function PageManager(containerEl, options) {
    this.container = containerEl;
    this.options = options || {}; // { mode: 'select' | 'reorder' | 'rotate', selectLabel }
    this.pages = []; // { originalIndex, rotation, selected, canvas }
    this.pdfDoc = null;
  }

  PageManager.prototype.load = async function (arrayBuffer, onPageRendered) {
    this.container.innerHTML = "";
    this.pages = [];
    var loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
    this.pdfDoc = await loadingTask.promise;
    var count = this.pdfDoc.numPages;

    for (var i = 1; i <= count; i++) {
      var page = await this.pdfDoc.getPage(i);
      var viewport = page.getViewport({ scale: 0.35 });
      var canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      var ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;

      this.pages.push({
        originalIndex: i - 1,
        rotation: 0,
        selected: false,
        canvas: canvas
      });
      if (onPageRendered) onPageRendered(i, count);
    }
    this.render();
    return count;
  };

  PageManager.prototype.render = function () {
    var self = this;
    var mode = this.options.mode || "select";
    this.container.innerHTML = "";

    this.pages.forEach(function (p, displayIndex) {
      var card = document.createElement("div");
      card.className = "pdft-pagecard" + (p.selected ? " marked" : "");

      if (mode === "select") {
        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = p.selected;
        cb.setAttribute("aria-label", (self.options.selectLabel || "Select") + " page " + (p.originalIndex + 1));
        cb.addEventListener("change", function () {
          p.selected = cb.checked;
          card.classList.toggle("marked", p.selected);
        });
        card.appendChild(cb);
      }

      var canvasWrap = p.canvas.cloneNode(false);
      var ctx2 = canvasWrap.getContext("2d");
      ctx2.drawImage(p.canvas, 0, 0);
      canvasWrap.style.transform = "rotate(" + p.rotation + "deg)";
      card.appendChild(canvasWrap);

      var num = document.createElement("div");
      num.className = "num";
      num.textContent = "Page " + (p.originalIndex + 1) + (p.rotation ? " · " + p.rotation + "°" : "");
      card.appendChild(num);

      var ctrls = document.createElement("div");
      ctrls.className = "ctrls";

      if (mode === "reorder") {
        var up = document.createElement("button");
        up.type = "button"; up.textContent = "▲ Move up"; up.disabled = displayIndex === 0;
        up.addEventListener("click", function () { self.move(displayIndex, -1); });
        var down = document.createElement("button");
        down.type = "button"; down.textContent = "▼ Move down"; down.disabled = displayIndex === self.pages.length - 1;
        down.addEventListener("click", function () { self.move(displayIndex, 1); });
        ctrls.appendChild(up); ctrls.appendChild(down);
      }

      if (mode === "rotate") {
        var rot = document.createElement("button");
        rot.type = "button"; rot.textContent = "⟳ Rotate 90°";
        rot.addEventListener("click", function () {
          p.rotation = (p.rotation + 90) % 360;
          self.render();
        });
        ctrls.appendChild(rot);
      }

      if (ctrls.childNodes.length) card.appendChild(ctrls);
      self.container.appendChild(card);
    });
  };

  PageManager.prototype.move = function (index, delta) {
    var target = index + delta;
    if (target < 0 || target >= this.pages.length) return;
    var tmp = this.pages[index];
    this.pages[index] = this.pages[target];
    this.pages[target] = tmp;
    this.render();
  };

  PageManager.prototype.selectAll = function (state) {
    this.pages.forEach(function (p) { p.selected = state; });
    this.render();
  };

  PageManager.prototype.getSelectedOriginalIndices = function () {
    return this.pages.filter(function (p) { return p.selected; }).map(function (p) { return p.originalIndex; });
  };

  PageManager.prototype.getUnselectedOriginalIndices = function () {
    return this.pages.filter(function (p) { return !p.selected; }).map(function (p) { return p.originalIndex; });
  };

  PageManager.prototype.getOrderOriginalIndices = function () {
    return this.pages.map(function (p) { return p.originalIndex; });
  };

  PageManager.prototype.getRotationsByOriginalIndex = function () {
    var map = {};
    this.pages.forEach(function (p) { map[p.originalIndex] = p.rotation; });
    return map;
  };

  window.PDFPageManager = PageManager;

// ============================================================
// TOOL DATA
// ============================================================
var TOOL_META = {"image-to-pdf": {"h1": "Convert Images to PDF", "lede": "Turn one or more JPG, PNG, or WebP photos into a single, properly ordered PDF document \u2014 entirely on your device.", "formats": "JPG, JPEG, PNG, WebP \u2192 PDF", "maxsize": "20 MB per image (browser memory dependent)", "ploc": "100% in your browser", "glyph": "\ud83d\uddbc\ufe0f", "cat": "Convert"}, "pdf-to-jpg": {"h1": "Convert PDF to JPG", "lede": "Export each page of a PDF as a high-quality JPG image, rendered locally and packaged into a ZIP you can download.", "formats": "PDF \u2192 JPG (ZIP for multi-page files)", "maxsize": "50 MB", "ploc": "100% in your browser", "glyph": "\ud83d\udcf8", "cat": "Convert"}, "pdf-to-png": {"h1": "Convert PDF to PNG", "lede": "Export PDF pages as crisp, lossless PNG images \u2014 a good choice for diagrams, line art, and text where JPG artifacts aren't welcome.", "formats": "PDF \u2192 PNG (ZIP for multi-page files)", "maxsize": "50 MB", "ploc": "100% in your browser", "glyph": "\ud83d\udda8\ufe0f", "cat": "Convert"}, "merge-pdf": {"h1": "Merge PDF Files Online", "lede": "Combine multiple PDF files into one document, in the order you choose \u2014 no upload, no watermark, no account.", "formats": "PDF (multiple files) \u2192 single PDF", "maxsize": "50 MB per file, combined 200 MB", "ploc": "100% in your browser", "glyph": "\ud83d\udd17", "cat": "Organize"}, "split-pdf": {"h1": "Split a PDF File", "lede": "Break a PDF into separate files \u2014 by custom page ranges, or into one file per page \u2014 and download everything as a ZIP.", "formats": "PDF \u2192 multiple PDFs (ZIP)", "maxsize": "50 MB", "ploc": "100% in your browser", "glyph": "\u2702\ufe0f", "cat": "Organize"}, "compress-pdf": {"h1": "Compress PDF File Size", "lede": "Reduce PDF file size before emailing or uploading it elsewhere \u2014 choose a light mode that preserves selectable text, or a stronger mode for image-heavy files.", "formats": "PDF \u2192 smaller PDF", "maxsize": "50 MB", "ploc": "100% in your browser", "glyph": "\ud83d\udddc\ufe0f", "cat": "Optimize"}, "delete-pdf-pages": {"h1": "Delete Pages from a PDF", "lede": "See every page as a thumbnail, mark the ones you want gone, and download a new PDF with those pages removed.", "formats": "PDF \u2192 PDF (pages removed)", "maxsize": "50 MB", "ploc": "100% in your browser", "glyph": "\ud83d\uddd1\ufe0f", "cat": "Organize"}, "rearrange-pdf-pages": {"h1": "Rearrange PDF Pages", "lede": "Change the order of pages in a PDF using simple move-up and move-down controls \u2014 built for touchscreens, no fiddly drag-and-drop required.", "formats": "PDF \u2192 PDF (reordered)", "maxsize": "50 MB", "ploc": "100% in your browser", "glyph": "\ud83d\udd00", "cat": "Organize"}, "rotate-pdf-pages": {"h1": "Rotate PDF Pages", "lede": "Fix pages that scanned in sideways or upside down \u2014 rotate each page independently and download the corrected PDF.", "formats": "PDF \u2192 PDF (pages rotated)", "maxsize": "50 MB", "ploc": "100% in your browser", "glyph": "\ud83d\udd04", "cat": "Organize"}, "pdf-watermark": {"h1": "Add a Watermark to a PDF", "lede": "Stamp text like \"DRAFT\" or \"CONFIDENTIAL\" across every page of your PDF, with full control over size, angle, color, and opacity.", "formats": "PDF \u2192 PDF (with watermark)", "maxsize": "50 MB", "ploc": "100% in your browser", "glyph": "\ud83d\udca7", "cat": "Edit"}, "protect-pdf": {"h1": "Password Protect a PDF", "lede": "Encrypt a PDF with a password so it can only be opened by someone who knows it \u2014 processing runs locally using a WebAssembly build of qpdf.", "formats": "PDF \u2192 password-protected PDF", "maxsize": "30 MB", "ploc": "100% in your browser (WebAssembly)", "glyph": "\ud83d\udd10", "cat": "Secure"}, "remove-pdf-password": {"h1": "Remove a Password from a PDF", "lede": "If you know a PDF's password and just want it to stop prompting for it, this tool decrypts the file locally and gives you back an unlocked copy.", "formats": "Encrypted PDF \u2192 unlocked PDF", "maxsize": "30 MB", "ploc": "100% in your browser (WebAssembly)", "glyph": "\ud83d\udd13", "cat": "Secure"}, "pdf-page-numbering": {"h1": "Add Page Numbers to a PDF", "lede": "Insert page numbers into every page of a PDF, choosing position, starting number, and format like \"Page 3 of 12\".", "formats": "PDF \u2192 PDF (numbered)", "maxsize": "50 MB", "ploc": "100% in your browser", "glyph": "\ud83d\udd22", "cat": "Edit"}, "extract-pdf-pages": {"h1": "Extract Pages from a PDF", "lede": "Select just the pages you need from a larger PDF and save them as a standalone document.", "formats": "PDF \u2192 PDF (selected pages only)", "maxsize": "50 MB", "ploc": "100% in your browser", "glyph": "\ud83d\udce4", "cat": "Organize"}, "pdf-to-text": {"h1": "Convert PDF to Text", "lede": "Pull the text out of a PDF into a plain .txt file you can search, edit, or paste elsewhere \u2014 no upload required.", "formats": "PDF \u2192 TXT", "maxsize": "50 MB", "ploc": "100% in your browser", "glyph": "\ud83d\udcdd", "cat": "Convert"}, "text-to-pdf": {"h1": "Convert Text to PDF", "lede": "Paste text or upload a .txt file and turn it into a clean, paginated PDF document.", "formats": "TXT / pasted text \u2192 PDF", "maxsize": "5 MB of text", "ploc": "100% in your browser", "glyph": "\ud83d\udcc4", "cat": "Convert"}, "pdf-metadata-remover": {"h1": "Remove PDF Metadata", "lede": "See what's hiding in a PDF's document properties \u2014 title, author, creation software \u2014 and clear it before you share the file.", "formats": "PDF \u2192 PDF (metadata cleared)", "maxsize": "50 MB", "ploc": "100% in your browser", "glyph": "\ud83d\udd75\ufe0f", "cat": "Secure"}};
var TOOL_WORKSPACES = {"image-to-pdf": "<div class=\"pdft-dropzone\" id=\"dz\">\n      <div class=\"icon\">\ud83d\uddbc\ufe0f</div>\n      <p class=\"pdft-dropzone-title\">Drop images here or tap to choose</p>\n      <p class=\"pdft-dropzone-sub\">JPG, PNG, WebP \u2014 select multiple at once</p>\n      <input type=\"file\" id=\"fileInput\" accept=\".jpg,.jpeg,.png,.webp\" multiple>\n    </div>\n    <ul class=\"pdft-filelist\" id=\"fileList\"></ul>\n    <div class=\"pdft-options\" id=\"optionsBox\" hidden>\n      <div class=\"pdft-field\">\n        <label for=\"pageSize\">Page size</label>\n        <select id=\"pageSize\">\n          <option value=\"a4\">A4</option>\n          <option value=\"letter\">Letter</option>\n          <option value=\"fit\">Fit to image</option>\n        </select>\n      </div>\n      <div class=\"pdft-field\">\n        <label for=\"orientation\">Orientation</label>\n        <select id=\"orientation\">\n          <option value=\"auto\">Auto (match image)</option>\n          <option value=\"portrait\">Portrait</option>\n          <option value=\"landscape\">Landscape</option>\n        </select>\n      </div>\n      <div class=\"pdft-field\">\n        <label for=\"margin\">Margin</label>\n        <select id=\"margin\">\n          <option value=\"0\">None</option>\n          <option value=\"20\" selected>Small</option>\n          <option value=\"50\">Large</option>\n        </select>\n      </div>\n    </div>\n    <p class=\"pdft-body\" id=\"reorderHint\" hidden style=\"font-size:.82rem;margin-top:10px;\">Tip: use the file list above to remove items; images are added to the PDF in the order shown.</p>\n    <div class=\"pdft-toolbar\">\n      <button class=\"pdft-btn pdft-btn-primary\" id=\"runBtn\" disabled>Convert to PDF</button>\n      <button class=\"pdft-btn pdft-btn-ghost\" id=\"clearBtn\" hidden>Clear all</button>\n    </div>\n    <div class=\"pdft-progress\" id=\"progress\">\n      <div class=\"pdft-progress-track\"><div class=\"pdft-progress-fill\" id=\"progressFill\"></div></div>\n      <div class=\"pdft-progress-label\" id=\"progressLabel\"></div>\n    </div>\n    <div class=\"pdft-msg\" id=\"msg\"></div>\n    <div class=\"pdft-result\" id=\"result\">\n      <div class=\"info\"><strong id=\"resultName\"></strong><br><span id=\"resultMeta\"></span></div>\n      <button class=\"pdft-btn pdft-btn-primary\" id=\"downloadBtn\">Download PDF</button>\n    </div>", "pdf-to-jpg": "<div class=\"pdft-dropzone\" id=\"dz\">\n      <div class=\"icon\">\ud83d\udcc4</div>\n      <p class=\"pdft-dropzone-title\">Drop a PDF here or tap to choose</p>\n      <p class=\"pdft-dropzone-sub\">One PDF file, up to 50 MB</p>\n      <input type=\"file\" id=\"fileInput\" accept=\".pdf\">\n    </div>\n    <ul class=\"pdft-filelist\" id=\"fileList\"></ul>\n    <div class=\"pdft-options\" id=\"optionsBox\" hidden>\n      <div class=\"pdft-field\">\n        <label for=\"quality\">JPG quality: <span id=\"qualityVal\">85%</span></label>\n        <input type=\"range\" id=\"quality\" min=\"40\" max=\"100\" value=\"85\">\n      </div>\n      <div class=\"pdft-field\">\n        <label for=\"scale\">Resolution</label>\n        <select id=\"scale\">\n          <option value=\"1\">Standard (72 DPI)</option>\n          <option value=\"2\" selected>High (144 DPI)</option>\n          <option value=\"3\">Very high (216 DPI)</option>\n        </select>\n      </div>\n    </div>\n    <div class=\"pdft-toolbar\">\n      <button class=\"pdft-btn pdft-btn-primary\" id=\"runBtn\" disabled>Convert to JPG</button>\n      <button class=\"pdft-btn pdft-btn-ghost\" id=\"clearBtn\" hidden>Clear</button>\n    </div>\n    <div class=\"pdft-progress\" id=\"progress\">\n      <div class=\"pdft-progress-track\"><div class=\"pdft-progress-fill\" id=\"progressFill\"></div></div>\n      <div class=\"pdft-progress-label\" id=\"progressLabel\"></div>\n    </div>\n    <div class=\"pdft-msg\" id=\"msg\"></div>\n    <div class=\"pdft-result\" id=\"result\">\n      <div class=\"info\"><strong id=\"resultName\"></strong><br><span id=\"resultMeta\"></span></div>\n      <button class=\"pdft-btn pdft-btn-primary\" id=\"downloadBtn\">Download</button>\n    </div>", "pdf-to-png": "<div class=\"pdft-dropzone\" id=\"dz\">\n      <div class=\"icon\">\ud83d\udcc4</div>\n      <p class=\"pdft-dropzone-title\">Drop a PDF here or tap to choose</p>\n      <p class=\"pdft-dropzone-sub\">One PDF file, up to 50 MB</p>\n      <input type=\"file\" id=\"fileInput\" accept=\".pdf\">\n    </div>\n    <ul class=\"pdft-filelist\" id=\"fileList\"></ul>\n    <div class=\"pdft-options\" id=\"optionsBox\" hidden>\n      <div class=\"pdft-field\">\n        <label for=\"scale\">Resolution</label>\n        <select id=\"scale\">\n          <option value=\"1\">Standard (72 DPI)</option>\n          <option value=\"2\" selected>High (144 DPI)</option>\n          <option value=\"3\">Very high (216 DPI)</option>\n        </select>\n      </div>\n    </div>\n    <div class=\"pdft-toolbar\">\n      <button class=\"pdft-btn pdft-btn-primary\" id=\"runBtn\" disabled>Convert to PNG</button>\n      <button class=\"pdft-btn pdft-btn-ghost\" id=\"clearBtn\" hidden>Clear</button>\n    </div>\n    <div class=\"pdft-progress\" id=\"progress\">\n      <div class=\"pdft-progress-track\"><div class=\"pdft-progress-fill\" id=\"progressFill\"></div></div>\n      <div class=\"pdft-progress-label\" id=\"progressLabel\"></div>\n    </div>\n    <div class=\"pdft-msg\" id=\"msg\"></div>\n    <div class=\"pdft-result\" id=\"result\">\n      <div class=\"info\"><strong id=\"resultName\"></strong><br><span id=\"resultMeta\"></span></div>\n      <button class=\"pdft-btn pdft-btn-primary\" id=\"downloadBtn\">Download</button>\n    </div>", "merge-pdf": "<div class=\"pdft-dropzone\" id=\"dz\">\n      <div class=\"icon\">\ud83d\udcd1</div>\n      <p class=\"pdft-dropzone-title\">Drop PDFs here or tap to choose</p>\n      <p class=\"pdft-dropzone-sub\">Select two or more PDF files</p>\n      <input type=\"file\" id=\"fileInput\" accept=\".pdf\" multiple>\n    </div>\n    <ul class=\"pdft-filelist\" id=\"fileList\"></ul>\n    <p class=\"pdft-body\" style=\"font-size:.82rem;margin-top:8px;\">Files are merged in the order shown above \u2014 remove and re-add files to change the order.</p>\n    <div class=\"pdft-toolbar\">\n      <button class=\"pdft-btn pdft-btn-primary\" id=\"runBtn\" disabled>Merge PDFs</button>\n      <button class=\"pdft-btn pdft-btn-ghost\" id=\"clearBtn\" hidden>Clear all</button>\n    </div>\n    <div class=\"pdft-progress\" id=\"progress\">\n      <div class=\"pdft-progress-track\"><div class=\"pdft-progress-fill\" id=\"progressFill\"></div></div>\n      <div class=\"pdft-progress-label\" id=\"progressLabel\"></div>\n    </div>\n    <div class=\"pdft-msg\" id=\"msg\"></div>\n    <div class=\"pdft-result\" id=\"result\">\n      <div class=\"info\"><strong id=\"resultName\"></strong><br><span id=\"resultMeta\"></span></div>\n      <button class=\"pdft-btn pdft-btn-primary\" id=\"downloadBtn\">Download merged PDF</button>\n    </div>", "split-pdf": "<div class=\"pdft-dropzone\" id=\"dz\">\n      <div class=\"icon\">\u2702\ufe0f</div>\n      <p class=\"pdft-dropzone-title\">Drop a PDF here or tap to choose</p>\n      <p class=\"pdft-dropzone-sub\">One PDF file</p>\n      <input type=\"file\" id=\"fileInput\" accept=\".pdf\">\n    </div>\n    <ul class=\"pdft-filelist\" id=\"fileList\"></ul>\n    <div class=\"pdft-options\" id=\"optionsBox\" hidden>\n      <div class=\"pdft-field\">\n        <label for=\"splitMode\">Split method</label>\n        <select id=\"splitMode\">\n          <option value=\"each\">Every page as its own file</option>\n          <option value=\"ranges\">Custom page ranges</option>\n          <option value=\"every\">Split every N pages</option>\n        </select>\n      </div>\n      <div class=\"pdft-field\" id=\"rangesField\" hidden>\n        <label for=\"ranges\">Page ranges</label>\n        <input type=\"text\" id=\"ranges\" placeholder=\"e.g. 1-3, 4-6, 9\">\n        <p class=\"hint\">Comma-separated ranges. Total pages shown after upload.</p>\n      </div>\n      <div class=\"pdft-field\" id=\"everyField\" hidden>\n        <label for=\"everyN\">Pages per file</label>\n        <input type=\"number\" id=\"everyN\" min=\"1\" value=\"1\">\n      </div>\n    </div>\n    <div class=\"pdft-toolbar\">\n      <button class=\"pdft-btn pdft-btn-primary\" id=\"runBtn\" disabled>Split PDF</button>\n      <button class=\"pdft-btn pdft-btn-ghost\" id=\"clearBtn\" hidden>Clear</button>\n    </div>\n    <div class=\"pdft-progress\" id=\"progress\">\n      <div class=\"pdft-progress-track\"><div class=\"pdft-progress-fill\" id=\"progressFill\"></div></div>\n      <div class=\"pdft-progress-label\" id=\"progressLabel\"></div>\n    </div>\n    <div class=\"pdft-msg\" id=\"msg\"></div>\n    <div class=\"pdft-result\" id=\"result\">\n      <div class=\"info\"><strong id=\"resultName\"></strong><br><span id=\"resultMeta\"></span></div>\n      <button class=\"pdft-btn pdft-btn-primary\" id=\"downloadBtn\">Download ZIP</button>\n    </div>", "compress-pdf": "<div class=\"pdft-dropzone\" id=\"dz\">\n      <div class=\"icon\">\ud83d\udddc\ufe0f</div>\n      <p class=\"pdft-dropzone-title\">Drop a PDF here or tap to choose</p>\n      <p class=\"pdft-dropzone-sub\">One PDF file</p>\n      <input type=\"file\" id=\"fileInput\" accept=\".pdf\">\n    </div>\n    <ul class=\"pdft-filelist\" id=\"fileList\"></ul>\n    <div class=\"pdft-options\" id=\"optionsBox\" hidden>\n      <div class=\"pdft-field\">\n        <label for=\"mode\">Compression mode</label>\n        <select id=\"mode\">\n          <option value=\"light\">Light \u2014 keep text selectable</option>\n          <option value=\"strong\">Strong \u2014 best for scanned/image PDFs</option>\n        </select>\n      </div>\n      <div class=\"pdft-field\" id=\"qualityField\" hidden>\n        <label for=\"quality\">Image quality: <span id=\"qualityVal\">70%</span></label>\n        <input type=\"range\" id=\"quality\" min=\"30\" max=\"95\" value=\"70\">\n      </div>\n    </div>\n    <p class=\"pdft-body\" id=\"modeNote\" style=\"font-size:.82rem;margin-top:8px;\"></p>\n    <div class=\"pdft-toolbar\">\n      <button class=\"pdft-btn pdft-btn-primary\" id=\"runBtn\" disabled>Compress PDF</button>\n      <button class=\"pdft-btn pdft-btn-ghost\" id=\"clearBtn\" hidden>Clear</button>\n    </div>\n    <div class=\"pdft-progress\" id=\"progress\">\n      <div class=\"pdft-progress-track\"><div class=\"pdft-progress-fill\" id=\"progressFill\"></div></div>\n      <div class=\"pdft-progress-label\" id=\"progressLabel\"></div>\n    </div>\n    <div class=\"pdft-msg\" id=\"msg\"></div>\n    <div class=\"pdft-result\" id=\"result\">\n      <div class=\"info\"><strong id=\"resultName\"></strong><br><span id=\"resultMeta\"></span></div>\n      <button class=\"pdft-btn pdft-btn-primary\" id=\"downloadBtn\">Download</button>\n    </div>", "delete-pdf-pages": "<div class=\"pdft-dropzone\" id=\"dz\">\n      <div class=\"icon\">\ud83d\uddd1\ufe0f</div>\n      <p class=\"pdft-dropzone-title\">Drop a PDF here or tap to choose</p>\n      <p class=\"pdft-dropzone-sub\">One PDF file</p>\n      <input type=\"file\" id=\"fileInput\" accept=\".pdf\">\n    </div>\n    <ul class=\"pdft-filelist\" id=\"fileList\"></ul>\n    \n    <div class=\"pdft-pagegrid\" id=\"pageGrid\"></div>\n    <div class=\"pdft-toolbar\" id=\"pageToolbar\" hidden>\n      <button class=\"pdft-btn pdft-btn-ghost pdft-btn-sm\" id=\"selectAllBtn\">Select all</button><button class=\"pdft-btn pdft-btn-ghost pdft-btn-sm\" id=\"selectNoneBtn\">Select none</button>\n      <button class=\"pdft-btn pdft-btn-primary\" id=\"runBtn\">Delete selected pages</button>\n      <button class=\"pdft-btn pdft-btn-ghost\" id=\"clearBtn\">Clear</button>\n    </div>\n    <div class=\"pdft-progress\" id=\"progress\">\n      <div class=\"pdft-progress-track\"><div class=\"pdft-progress-fill\" id=\"progressFill\"></div></div>\n      <div class=\"pdft-progress-label\" id=\"progressLabel\"></div>\n    </div>\n    <div class=\"pdft-msg\" id=\"msg\"></div>\n    <div class=\"pdft-result\" id=\"result\">\n      <div class=\"info\"><strong id=\"resultName\"></strong><br><span id=\"resultMeta\"></span></div>\n      <button class=\"pdft-btn pdft-btn-primary\" id=\"downloadBtn\">Download</button>\n    </div>", "rearrange-pdf-pages": "<div class=\"pdft-dropzone\" id=\"dz\">\n      <div class=\"icon\">\ud83d\udd00</div>\n      <p class=\"pdft-dropzone-title\">Drop a PDF here or tap to choose</p>\n      <p class=\"pdft-dropzone-sub\">One PDF file</p>\n      <input type=\"file\" id=\"fileInput\" accept=\".pdf\">\n    </div>\n    <ul class=\"pdft-filelist\" id=\"fileList\"></ul>\n    \n    <div class=\"pdft-pagegrid\" id=\"pageGrid\"></div>\n    <div class=\"pdft-toolbar\" id=\"pageToolbar\" hidden>\n      \n      <button class=\"pdft-btn pdft-btn-primary\" id=\"runBtn\">Save new order</button>\n      <button class=\"pdft-btn pdft-btn-ghost\" id=\"clearBtn\">Clear</button>\n    </div>\n    <div class=\"pdft-progress\" id=\"progress\">\n      <div class=\"pdft-progress-track\"><div class=\"pdft-progress-fill\" id=\"progressFill\"></div></div>\n      <div class=\"pdft-progress-label\" id=\"progressLabel\"></div>\n    </div>\n    <div class=\"pdft-msg\" id=\"msg\"></div>\n    <div class=\"pdft-result\" id=\"result\">\n      <div class=\"info\"><strong id=\"resultName\"></strong><br><span id=\"resultMeta\"></span></div>\n      <button class=\"pdft-btn pdft-btn-primary\" id=\"downloadBtn\">Download</button>\n    </div>", "rotate-pdf-pages": "<div class=\"pdft-dropzone\" id=\"dz\">\n      <div class=\"icon\">\ud83d\udd04</div>\n      <p class=\"pdft-dropzone-title\">Drop a PDF here or tap to choose</p>\n      <p class=\"pdft-dropzone-sub\">One PDF file</p>\n      <input type=\"file\" id=\"fileInput\" accept=\".pdf\">\n    </div>\n    <ul class=\"pdft-filelist\" id=\"fileList\"></ul>\n    \n    <div class=\"pdft-pagegrid\" id=\"pageGrid\"></div>\n    <div class=\"pdft-toolbar\" id=\"pageToolbar\" hidden>\n      <button class=\"pdft-btn pdft-btn-ghost pdft-btn-sm\" id=\"rotateAllBtn\">Rotate all 90\u00b0</button>\n      <button class=\"pdft-btn pdft-btn-primary\" id=\"runBtn\">Apply rotation</button>\n      <button class=\"pdft-btn pdft-btn-ghost\" id=\"clearBtn\">Clear</button>\n    </div>\n    <div class=\"pdft-progress\" id=\"progress\">\n      <div class=\"pdft-progress-track\"><div class=\"pdft-progress-fill\" id=\"progressFill\"></div></div>\n      <div class=\"pdft-progress-label\" id=\"progressLabel\"></div>\n    </div>\n    <div class=\"pdft-msg\" id=\"msg\"></div>\n    <div class=\"pdft-result\" id=\"result\">\n      <div class=\"info\"><strong id=\"resultName\"></strong><br><span id=\"resultMeta\"></span></div>\n      <button class=\"pdft-btn pdft-btn-primary\" id=\"downloadBtn\">Download</button>\n    </div>", "pdf-watermark": "<div class=\"pdft-dropzone\" id=\"dz\">\n      <div class=\"icon\">\ud83d\udca7</div>\n      <p class=\"pdft-dropzone-title\">Drop a PDF here or tap to choose</p>\n      <p class=\"pdft-dropzone-sub\">One PDF file</p>\n      <input type=\"file\" id=\"fileInput\" accept=\".pdf\">\n    </div>\n    <ul class=\"pdft-filelist\" id=\"fileList\"></ul>\n    <div class=\"pdft-options\" id=\"optionsBox\" hidden>\n      <div class=\"pdft-field\">\n        <label for=\"wmText\">Watermark text</label>\n        <input type=\"text\" id=\"wmText\" value=\"CONFIDENTIAL\" maxlength=\"60\">\n      </div>\n      <div class=\"pdft-field\">\n        <label for=\"wmSize\">Font size: <span id=\"wmSizeVal\">48</span>pt</label>\n        <input type=\"range\" id=\"wmSize\" min=\"12\" max=\"120\" value=\"48\">\n      </div>\n      <div class=\"pdft-field\">\n        <label for=\"wmOpacity\">Opacity: <span id=\"wmOpacityVal\">30%</span></label>\n        <input type=\"range\" id=\"wmOpacity\" min=\"5\" max=\"100\" value=\"30\">\n      </div>\n      <div class=\"pdft-field\">\n        <label for=\"wmAngle\">Angle: <span id=\"wmAngleVal\">45</span>\u00b0</label>\n        <input type=\"range\" id=\"wmAngle\" min=\"0\" max=\"90\" value=\"45\">\n      </div>\n      <div class=\"pdft-field\">\n        <label for=\"wmColor\">Color</label>\n        <select id=\"wmColor\">\n          <option value=\"gray\">Gray</option>\n          <option value=\"red\">Red</option>\n          <option value=\"blue\">Blue</option>\n          <option value=\"black\">Black</option>\n        </select>\n      </div>\n      <div class=\"pdft-field\">\n        <label for=\"wmPosition\">Position</label>\n        <select id=\"wmPosition\">\n          <option value=\"center\">Centered, single stamp</option>\n          <option value=\"tile\">Tiled across page</option>\n        </select>\n      </div>\n    </div>\n    <div class=\"pdft-toolbar\">\n      <button class=\"pdft-btn pdft-btn-primary\" id=\"runBtn\" disabled>Add Watermark</button>\n      <button class=\"pdft-btn pdft-btn-ghost\" id=\"clearBtn\" hidden>Clear</button>\n    </div>\n    <div class=\"pdft-progress\" id=\"progress\">\n      <div class=\"pdft-progress-track\"><div class=\"pdft-progress-fill\" id=\"progressFill\"></div></div>\n      <div class=\"pdft-progress-label\" id=\"progressLabel\"></div>\n    </div>\n    <div class=\"pdft-msg\" id=\"msg\"></div>\n    <div class=\"pdft-result\" id=\"result\">\n      <div class=\"info\"><strong id=\"resultName\"></strong><br><span id=\"resultMeta\"></span></div>\n      <button class=\"pdft-btn pdft-btn-primary\" id=\"downloadBtn\">Download</button>\n    </div>", "protect-pdf": "<div class=\"pdft-dropzone\" id=\"dz\">\n      <div class=\"icon\">\ud83d\udd10</div>\n      <p class=\"pdft-dropzone-title\">Drop a PDF here or tap to choose</p>\n      <p class=\"pdft-dropzone-sub\">One PDF file, not already encrypted</p>\n      <input type=\"file\" id=\"fileInput\" accept=\".pdf\">\n    </div>\n    <ul class=\"pdft-filelist\" id=\"fileList\"></ul>\n    <div class=\"pdft-options\" id=\"optionsBox\" hidden>\n      <div class=\"pdft-field\">\n        <label for=\"userPw\">Password to open the file</label>\n        <input type=\"password\" id=\"userPw\" autocomplete=\"new-password\">\n      </div>\n      <div class=\"pdft-field\">\n        <label for=\"confirmPw\">Confirm password</label>\n        <input type=\"password\" id=\"confirmPw\" autocomplete=\"new-password\">\n      </div>\n    </div>\n    <div class=\"pdft-toolbar\">\n      <button class=\"pdft-btn pdft-btn-primary\" id=\"runBtn\" disabled>Protect PDF</button>\n      <button class=\"pdft-btn pdft-btn-ghost\" id=\"clearBtn\" hidden>Clear</button>\n    </div>\n    <div class=\"pdft-progress\" id=\"progress\">\n      <div class=\"pdft-progress-track\"><div class=\"pdft-progress-fill\" id=\"progressFill\"></div></div>\n      <div class=\"pdft-progress-label\" id=\"progressLabel\"></div>\n    </div>\n    <div class=\"pdft-msg\" id=\"msg\"></div>\n    <div class=\"pdft-result\" id=\"result\">\n      <div class=\"info\"><strong id=\"resultName\"></strong><br><span id=\"resultMeta\"></span></div>\n      <button class=\"pdft-btn pdft-btn-primary\" id=\"downloadBtn\">Download</button>\n    </div>", "remove-pdf-password": "<div class=\"pdft-dropzone\" id=\"dz\">\n      <div class=\"icon\">\ud83d\udd13</div>\n      <p class=\"pdft-dropzone-title\">Drop a password-protected PDF here or tap to choose</p>\n      <p class=\"pdft-dropzone-sub\">One PDF file</p>\n      <input type=\"file\" id=\"fileInput\" accept=\".pdf\">\n    </div>\n    <ul class=\"pdft-filelist\" id=\"fileList\"></ul>\n    <div class=\"pdft-options\" id=\"optionsBox\" hidden>\n      <div class=\"pdft-field\">\n        <label for=\"currentPw\">Current password</label>\n        <input type=\"password\" id=\"currentPw\" autocomplete=\"current-password\">\n      </div>\n    </div>\n    <div class=\"pdft-toolbar\">\n      <button class=\"pdft-btn pdft-btn-primary\" id=\"runBtn\" disabled>Remove Password</button>\n      <button class=\"pdft-btn pdft-btn-ghost\" id=\"clearBtn\" hidden>Clear</button>\n    </div>\n    <div class=\"pdft-progress\" id=\"progress\">\n      <div class=\"pdft-progress-track\"><div class=\"pdft-progress-fill\" id=\"progressFill\"></div></div>\n      <div class=\"pdft-progress-label\" id=\"progressLabel\"></div>\n    </div>\n    <div class=\"pdft-msg\" id=\"msg\"></div>\n    <div class=\"pdft-result\" id=\"result\">\n      <div class=\"info\"><strong id=\"resultName\"></strong><br><span id=\"resultMeta\"></span></div>\n      <button class=\"pdft-btn pdft-btn-primary\" id=\"downloadBtn\">Download</button>\n    </div>", "pdf-page-numbering": "<div class=\"pdft-dropzone\" id=\"dz\">\n      <div class=\"icon\">\ud83d\udd22</div>\n      <p class=\"pdft-dropzone-title\">Drop a PDF here or tap to choose</p>\n      <p class=\"pdft-dropzone-sub\">One PDF file</p>\n      <input type=\"file\" id=\"fileInput\" accept=\".pdf\">\n    </div>\n    <ul class=\"pdft-filelist\" id=\"fileList\"></ul>\n    <div class=\"pdft-options\" id=\"optionsBox\" hidden>\n      <div class=\"pdft-field\">\n        <label for=\"position\">Position</label>\n        <select id=\"position\">\n          <option value=\"bottom-center\">Bottom center</option>\n          <option value=\"bottom-right\">Bottom right</option>\n          <option value=\"bottom-left\">Bottom left</option>\n          <option value=\"top-center\">Top center</option>\n          <option value=\"top-right\">Top right</option>\n          <option value=\"top-left\">Top left</option>\n        </select>\n      </div>\n      <div class=\"pdft-field\">\n        <label for=\"format\">Format</label>\n        <select id=\"format\">\n          <option value=\"n\">1, 2, 3\u2026</option>\n          <option value=\"page_n\">Page 1, Page 2\u2026</option>\n          <option value=\"n_of_total\">1 of 12, 2 of 12\u2026</option>\n        </select>\n      </div>\n      <div class=\"pdft-field\">\n        <label for=\"startNum\">Start at</label>\n        <input type=\"number\" id=\"startNum\" value=\"1\" min=\"0\">\n      </div>\n      <div class=\"pdft-field\">\n        <label for=\"fontSize\">Font size</label>\n        <input type=\"number\" id=\"fontSize\" value=\"11\" min=\"6\" max=\"36\">\n      </div>\n    </div>\n    <div class=\"pdft-toolbar\">\n      <button class=\"pdft-btn pdft-btn-primary\" id=\"runBtn\" disabled>Add Page Numbers</button>\n      <button class=\"pdft-btn pdft-btn-ghost\" id=\"clearBtn\" hidden>Clear</button>\n    </div>\n    <div class=\"pdft-progress\" id=\"progress\">\n      <div class=\"pdft-progress-track\"><div class=\"pdft-progress-fill\" id=\"progressFill\"></div></div>\n      <div class=\"pdft-progress-label\" id=\"progressLabel\"></div>\n    </div>\n    <div class=\"pdft-msg\" id=\"msg\"></div>\n    <div class=\"pdft-result\" id=\"result\">\n      <div class=\"info\"><strong id=\"resultName\"></strong><br><span id=\"resultMeta\"></span></div>\n      <button class=\"pdft-btn pdft-btn-primary\" id=\"downloadBtn\">Download</button>\n    </div>", "extract-pdf-pages": "<div class=\"pdft-dropzone\" id=\"dz\">\n      <div class=\"icon\">\ud83d\udce4</div>\n      <p class=\"pdft-dropzone-title\">Drop a PDF here or tap to choose</p>\n      <p class=\"pdft-dropzone-sub\">One PDF file</p>\n      <input type=\"file\" id=\"fileInput\" accept=\".pdf\">\n    </div>\n    <ul class=\"pdft-filelist\" id=\"fileList\"></ul>\n    \n    <div class=\"pdft-pagegrid\" id=\"pageGrid\"></div>\n    <div class=\"pdft-toolbar\" id=\"pageToolbar\" hidden>\n      <button class=\"pdft-btn pdft-btn-ghost pdft-btn-sm\" id=\"selectAllBtn\">Select all</button><button class=\"pdft-btn pdft-btn-ghost pdft-btn-sm\" id=\"selectNoneBtn\">Select none</button>\n      <button class=\"pdft-btn pdft-btn-primary\" id=\"runBtn\">Extract selected pages</button>\n      <button class=\"pdft-btn pdft-btn-ghost\" id=\"clearBtn\">Clear</button>\n    </div>\n    <div class=\"pdft-progress\" id=\"progress\">\n      <div class=\"pdft-progress-track\"><div class=\"pdft-progress-fill\" id=\"progressFill\"></div></div>\n      <div class=\"pdft-progress-label\" id=\"progressLabel\"></div>\n    </div>\n    <div class=\"pdft-msg\" id=\"msg\"></div>\n    <div class=\"pdft-result\" id=\"result\">\n      <div class=\"info\"><strong id=\"resultName\"></strong><br><span id=\"resultMeta\"></span></div>\n      <button class=\"pdft-btn pdft-btn-primary\" id=\"downloadBtn\">Download</button>\n    </div>", "pdf-to-text": "<div class=\"pdft-dropzone\" id=\"dz\">\n      <div class=\"icon\">\ud83d\udcdd</div>\n      <p class=\"pdft-dropzone-title\">Drop a PDF here or tap to choose</p>\n      <p class=\"pdft-dropzone-sub\">One PDF file with selectable text</p>\n      <input type=\"file\" id=\"fileInput\" accept=\".pdf\">\n    </div>\n    <ul class=\"pdft-filelist\" id=\"fileList\"></ul>\n    <div class=\"pdft-toolbar\">\n      <button class=\"pdft-btn pdft-btn-primary\" id=\"runBtn\" disabled>Extract Text</button>\n      <button class=\"pdft-btn pdft-btn-ghost\" id=\"clearBtn\" hidden>Clear</button>\n    </div>\n    <div class=\"pdft-progress\" id=\"progress\">\n      <div class=\"pdft-progress-track\"><div class=\"pdft-progress-fill\" id=\"progressFill\"></div></div>\n      <div class=\"pdft-progress-label\" id=\"progressLabel\"></div>\n    </div>\n    <div class=\"pdft-msg\" id=\"msg\"></div>\n    <div class=\"pdft-field\" id=\"previewField\" hidden style=\"margin-top:14px;\">\n      <label for=\"preview\">Preview</label>\n      <textarea id=\"preview\" readonly style=\"min-height:220px;\"></textarea>\n    </div>\n    <div class=\"pdft-result\" id=\"result\">\n      <div class=\"info\"><strong id=\"resultName\"></strong><br><span id=\"resultMeta\"></span></div>\n      <button class=\"pdft-btn pdft-btn-primary\" id=\"downloadBtn\">Download .txt</button>\n    </div>", "text-to-pdf": "<div class=\"pdft-options\" id=\"optionsBox\">\n      <div class=\"pdft-field\" style=\"grid-column:1/-1;\">\n        <label for=\"textInput\">Text content</label>\n        <textarea id=\"textInput\" placeholder=\"Paste or type your text here\u2026\"></textarea>\n        <p class=\"hint\">Or <button type=\"button\" class=\"pdft-btn pdft-btn-ghost pdft-btn-sm\" id=\"uploadTxtBtn\">upload a .txt file</button> instead. <input type=\"file\" id=\"txtFileInput\" accept=\".txt\" hidden></p>\n      </div>\n      <div class=\"pdft-field\">\n        <label for=\"pageSize\">Page size</label>\n        <select id=\"pageSize\"><option value=\"a4\">A4</option><option value=\"letter\">Letter</option></select>\n      </div>\n      <div class=\"pdft-field\">\n        <label for=\"fontSize\">Font size</label>\n        <input type=\"number\" id=\"fontSize\" value=\"12\" min=\"8\" max=\"24\">\n      </div>\n      <div class=\"pdft-field\">\n        <label for=\"lineSpacing\">Line spacing</label>\n        <select id=\"lineSpacing\"><option value=\"1.15\">Normal</option><option value=\"1.5\">1.5\u00d7</option><option value=\"2\">Double</option></select>\n      </div>\n    </div>\n    <div class=\"pdft-toolbar\">\n      <button class=\"pdft-btn pdft-btn-primary\" id=\"runBtn\" disabled>Convert to PDF</button>\n      <button class=\"pdft-btn pdft-btn-ghost\" id=\"clearBtn\">Clear</button>\n    </div>\n    <div class=\"pdft-progress\" id=\"progress\">\n      <div class=\"pdft-progress-track\"><div class=\"pdft-progress-fill\" id=\"progressFill\"></div></div>\n      <div class=\"pdft-progress-label\" id=\"progressLabel\"></div>\n    </div>\n    <div class=\"pdft-msg\" id=\"msg\"></div>\n    <div class=\"pdft-result\" id=\"result\">\n      <div class=\"info\"><strong id=\"resultName\"></strong><br><span id=\"resultMeta\"></span></div>\n      <button class=\"pdft-btn pdft-btn-primary\" id=\"downloadBtn\">Download PDF</button>\n    </div>", "pdf-metadata-remover": "<div class=\"pdft-dropzone\" id=\"dz\">\n      <div class=\"icon\">\ud83d\udd75\ufe0f</div>\n      <p class=\"pdft-dropzone-title\">Drop a PDF here or tap to choose</p>\n      <p class=\"pdft-dropzone-sub\">One PDF file</p>\n      <input type=\"file\" id=\"fileInput\" accept=\".pdf\">\n    </div>\n    <ul class=\"pdft-filelist\" id=\"fileList\"></ul>\n    <table class=\"pdft-metatable\" id=\"metaTable\" hidden></table>\n    <div class=\"pdft-toolbar\">\n      <button class=\"pdft-btn pdft-btn-primary\" id=\"runBtn\" disabled>Remove Metadata</button>\n      <button class=\"pdft-btn pdft-btn-ghost\" id=\"clearBtn\" hidden>Clear</button>\n    </div>\n    <div class=\"pdft-progress\" id=\"progress\">\n      <div class=\"pdft-progress-track\"><div class=\"pdft-progress-fill\" id=\"progressFill\"></div></div>\n      <div class=\"pdft-progress-label\" id=\"progressLabel\"></div>\n    </div>\n    <div class=\"pdft-msg\" id=\"msg\"></div>\n    <div class=\"pdft-result\" id=\"result\">\n      <div class=\"info\"><strong id=\"resultName\"></strong><br><span id=\"resultMeta\"></span></div>\n      <button class=\"pdft-btn pdft-btn-primary\" id=\"downloadBtn\">Download</button>\n    </div>"};

// ============================================================
// TOOL LOGIC (one mount function per tool, formerly per-page tool.js)
// ============================================================
function mount_image_to_pdf(root) {
  "use strict";
var C = window.PDFToolsCommon;
  var dz = document.getElementById("dz"), input = document.getElementById("fileInput");
  var fileList = document.getElementById("fileList"), optionsBox = document.getElementById("optionsBox");
  var reorderHint = document.getElementById("reorderHint");
  var runBtn = document.getElementById("runBtn"), clearBtn = document.getElementById("clearBtn");
  var progress = document.getElementById("progress"), fill = document.getElementById("progressFill"), label = document.getElementById("progressLabel");
  var msg = document.getElementById("msg"), result = document.getElementById("result");
  var resultName = document.getElementById("resultName"), resultMeta = document.getElementById("resultMeta"), downloadBtn = document.getElementById("downloadBtn");

  var items = []; // {id, file}
  var outputBlob = null, outputName = "";

  function refreshList() {
    C.renderFileList(fileList, items.map(function (it) { return { id: it.id, name: it.file.name, size: it.file.size }; }), removeItem);
    var has = items.length > 0;
    runBtn.disabled = !has;
    clearBtn.hidden = !has;
    optionsBox.hidden = !has;
    reorderHint.hidden = !has;
  }
  function removeItem(id) {
    items = items.filter(function (it) { return it.id !== id; });
    refreshList();
  }
  function onFiles(fileListObj) {
    C.hideMsg(msg);
    var errors = [];
    Array.prototype.forEach.call(fileListObj, function (file) {
      var v = C.validateFile(file, { accept: [".jpg", ".jpeg", ".png", ".webp"], maxSizeMB: 20 });
      if (!v.ok) { errors.push(v.error); return; }
      items.push({ id: C.uid(), file: file });
    });
    if (errors.length) C.showMsg(msg, errors.join(" "), "error");
    refreshList();
  }
  C.initDropzone(dz, input, { onFiles: onFiles });
  clearBtn.addEventListener("click", function () { items = []; result.classList.remove("show"); refreshList(); });

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () { resolve({ img: img, url: url }); };
      img.onerror = function () { reject(new Error("Could not read image: " + file.name)); };
      img.src = url;
    });
  }

  runBtn.addEventListener("click", async function () {
    if (!items.length) return;
    runBtn.disabled = true;
    C.hideMsg(msg); result.classList.remove("show");
    try {
      await C.loadScript("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js");
      var jsPDFCtor = window.jspdf.jsPDF;
      var pageSize = document.getElementById("pageSize").value;
      var orientation = document.getElementById("orientation").value;
      var margin = parseInt(document.getElementById("margin").value, 10);

      var doc = null;
      C.setProgress(progress, fill, label, 5, "Starting…");

      for (var i = 0; i < items.length; i++) {
        var file = items[i].file;
        C.setProgress(progress, fill, label, 5 + (i / items.length) * 85, "Adding image " + (i + 1) + " of " + items.length);
        var loaded = await loadImage(file);
        var img = loaded.img;
        var imgRatio = img.width / img.height;
        var orient = orientation === "auto" ? (imgRatio > 1 ? "landscape" : "portrait") : orientation;

        var format = pageSize === "fit" ? [img.width, img.height] : pageSize;
        var unit = pageSize === "fit" ? "px" : "pt";

        if (!doc) {
          doc = new jsPDFCtor({ orientation: orient === "landscape" ? "l" : "p", unit: unit, format: format });
        } else {
          doc.addPage(format, orient === "landscape" ? "l" : "p");
        }
        var pw = doc.internal.pageSize.getWidth();
        var ph = doc.internal.pageSize.getHeight();
        var availW = pw - margin * 2, availH = ph - margin * 2;
        var scale = Math.min(availW / img.width, availH / img.height);
        var drawW = img.width * scale, drawH = img.height * scale;
        var x = (pw - drawW) / 2, y = (ph - drawH) / 2;

        var fmt = /\.png$/i.test(file.name) ? "PNG" : "JPEG";
        doc.addImage(img, fmt, x, y, drawW, drawH, undefined, "FAST");
        URL.revokeObjectURL(loaded.url);
      }

      C.setProgress(progress, fill, label, 95, "Finalizing PDF…");
      outputBlob = doc.output("blob");
      outputName = (items.length === 1 ? C.baseName(items[0].file.name) : "images") + ".pdf";
      C.setProgress(progress, fill, label, 100, "Done");
      resultName.textContent = outputName;
      resultMeta.textContent = items.length + " image" + (items.length > 1 ? "s" : "") + " · " + C.formatBytes(outputBlob.size);
      result.classList.add("show");
      C.showMsg(msg, "PDF created successfully.", "success");
    } catch (err) {
      console.error(err);
      C.showMsg(msg, "Something went wrong converting your images: " + err.message, "error");
    } finally {
      runBtn.disabled = false;
      C.resetProgress(progress, fill);
    }
  });

  downloadBtn.addEventListener("click", function () {
    if (outputBlob) C.downloadBlob(outputBlob, outputName);
  });

}

function mount_pdf_to_jpg(root) {
  "use strict";
var C = window.PDFToolsCommon;
  var dz = document.getElementById("dz"), input = document.getElementById("fileInput");
  var fileList = document.getElementById("fileList"), optionsBox = document.getElementById("optionsBox");
  var runBtn = document.getElementById("runBtn"), clearBtn = document.getElementById("clearBtn");
  var progress = document.getElementById("progress"), fill = document.getElementById("progressFill"), label = document.getElementById("progressLabel");
  var msg = document.getElementById("msg"), result = document.getElementById("result");
  var resultName = document.getElementById("resultName"), resultMeta = document.getElementById("resultMeta"), downloadBtn = document.getElementById("downloadBtn");
  var qualityInput = document.getElementById("quality"), qualityVal = document.getElementById("qualityVal");
  var scaleSelect = document.getElementById("scale");

  qualityInput.addEventListener("input", function () { qualityVal.textContent = qualityInput.value + "%"; });

  var currentFile = null, outputBlob = null, outputName = "";

  function setFile(file) {
    C.hideMsg(msg);
    var v = C.validateFile(file, { accept: [".pdf"], mime: ["application/pdf"], maxSizeMB: 50 });
    if (!v.ok) { C.showMsg(msg, v.error, "error"); return; }
    currentFile = file;
    C.renderFileList(fileList, [{ id: "f", name: file.name, size: file.size }], function () {
      currentFile = null; refreshUI();
    });
    refreshUI();
  }
  function refreshUI() {
    var has = !!currentFile;
    runBtn.disabled = !has;
    clearBtn.hidden = !has;
    optionsBox.hidden = !has;
    if (!has) fileList.innerHTML = "";
  }
  C.initDropzone(dz, input, { onFiles: function (files) { setFile(files[0]); } });
  clearBtn.addEventListener("click", function () { currentFile = null; result.classList.remove("show"); refreshUI(); });

  async function ensurePdfJs() {
    await C.loadScript("https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js");
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  }

  runBtn.addEventListener("click", async function () {
    if (!currentFile) return;
    runBtn.disabled = true;
    C.hideMsg(msg); result.classList.remove("show");
    try {
      await ensurePdfJs();
      await C.loadScript("https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js");

      var quality = parseInt(qualityInput.value, 10) / 100;
      var scale = parseFloat(scaleSelect.value);
      var buf = await C.readFileAsArrayBuffer(currentFile);
      var pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
      var count = pdf.numPages;
      var blobs = [];

      for (var i = 1; i <= count; i++) {
        C.setProgress(progress, fill, label, (i / count) * 90, "Rendering page " + i + " of " + count);
        var page = await pdf.getPage(i);
        var viewport = page.getViewport({ scale: scale });
        var canvas = document.createElement("canvas");
        canvas.width = viewport.width; canvas.height = viewport.height;
        var ctx = canvas.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;
        var blob = await new Promise(function (res) { canvas.toBlob(res, "image/jpeg", quality); });
        blobs.push(blob);
      }

      var base = C.baseName(currentFile.name);
      if (count === 1) {
        outputBlob = blobs[0];
        outputName = base + ".jpg";
      } else {
        C.setProgress(progress, fill, label, 95, "Packaging ZIP…");
        var zip = new window.JSZip();
        blobs.forEach(function (b, idx) {
          zip.file(base + "-page-" + String(idx + 1).padStart(2, "0") + ".jpg", b);
        });
        outputBlob = await zip.generateAsync({ type: "blob" });
        outputName = base + "-jpg.zip";
      }

      C.setProgress(progress, fill, label, 100, "Done");
      resultName.textContent = outputName;
      resultMeta.textContent = count + " page" + (count > 1 ? "s" : "") + " · " + C.formatBytes(outputBlob.size);
      result.classList.add("show");
      C.showMsg(msg, "Converted successfully.", "success");
    } catch (err) {
      console.error(err);
      C.showMsg(msg, "Couldn't convert this PDF: " + err.message, "error");
    } finally {
      runBtn.disabled = false;
      C.resetProgress(progress, fill);
    }
  });

  downloadBtn.addEventListener("click", function () { if (outputBlob) C.downloadBlob(outputBlob, outputName); });

}

function mount_pdf_to_png(root) {
  "use strict";
var C = window.PDFToolsCommon;
  var dz = document.getElementById("dz"), input = document.getElementById("fileInput");
  var fileList = document.getElementById("fileList"), optionsBox = document.getElementById("optionsBox");
  var runBtn = document.getElementById("runBtn"), clearBtn = document.getElementById("clearBtn");
  var progress = document.getElementById("progress"), fill = document.getElementById("progressFill"), label = document.getElementById("progressLabel");
  var msg = document.getElementById("msg"), result = document.getElementById("result");
  var resultName = document.getElementById("resultName"), resultMeta = document.getElementById("resultMeta"), downloadBtn = document.getElementById("downloadBtn");
  var scaleSelect = document.getElementById("scale");

  var currentFile = null, outputBlob = null, outputName = "";

  function setFile(file) {
    C.hideMsg(msg);
    var v = C.validateFile(file, { accept: [".pdf"], mime: ["application/pdf"], maxSizeMB: 50 });
    if (!v.ok) { C.showMsg(msg, v.error, "error"); return; }
    currentFile = file;
    C.renderFileList(fileList, [{ id: "f", name: file.name, size: file.size }], function () { currentFile = null; refreshUI(); });
    refreshUI();
  }
  function refreshUI() {
    var has = !!currentFile;
    runBtn.disabled = !has; clearBtn.hidden = !has; optionsBox.hidden = !has;
    if (!has) fileList.innerHTML = "";
  }
  C.initDropzone(dz, input, { onFiles: function (files) { setFile(files[0]); } });
  clearBtn.addEventListener("click", function () { currentFile = null; result.classList.remove("show"); refreshUI(); });

  async function ensurePdfJs() {
    await C.loadScript("https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js");
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  }

  runBtn.addEventListener("click", async function () {
    if (!currentFile) return;
    runBtn.disabled = true;
    C.hideMsg(msg); result.classList.remove("show");
    try {
      await ensurePdfJs();
      await C.loadScript("https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js");
      var scale = parseFloat(scaleSelect.value);
      var buf = await C.readFileAsArrayBuffer(currentFile);
      var pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
      var count = pdf.numPages;
      var blobs = [];
      for (var i = 1; i <= count; i++) {
        C.setProgress(progress, fill, label, (i / count) * 90, "Rendering page " + i + " of " + count);
        var page = await pdf.getPage(i);
        var viewport = page.getViewport({ scale: scale });
        var canvas = document.createElement("canvas");
        canvas.width = viewport.width; canvas.height = viewport.height;
        var ctx = canvas.getContext("2d");
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;
        var blob = await new Promise(function (res) { canvas.toBlob(res, "image/png"); });
        blobs.push(blob);
      }
      var base = C.baseName(currentFile.name);
      if (count === 1) {
        outputBlob = blobs[0]; outputName = base + ".png";
      } else {
        C.setProgress(progress, fill, label, 95, "Packaging ZIP…");
        var zip = new window.JSZip();
        blobs.forEach(function (b, idx) { zip.file(base + "-page-" + String(idx + 1).padStart(2, "0") + ".png", b); });
        outputBlob = await zip.generateAsync({ type: "blob" });
        outputName = base + "-png.zip";
      }
      C.setProgress(progress, fill, label, 100, "Done");
      resultName.textContent = outputName;
      resultMeta.textContent = count + " page" + (count > 1 ? "s" : "") + " · " + C.formatBytes(outputBlob.size);
      result.classList.add("show");
      C.showMsg(msg, "Converted successfully.", "success");
    } catch (err) {
      console.error(err);
      C.showMsg(msg, "Couldn't convert this PDF: " + err.message, "error");
    } finally {
      runBtn.disabled = false;
      C.resetProgress(progress, fill);
    }
  });

  downloadBtn.addEventListener("click", function () { if (outputBlob) C.downloadBlob(outputBlob, outputName); });

}

function mount_merge_pdf(root) {
  "use strict";
var C = window.PDFToolsCommon;
  var dz = document.getElementById("dz"), input = document.getElementById("fileInput");
  var fileList = document.getElementById("fileList");
  var runBtn = document.getElementById("runBtn"), clearBtn = document.getElementById("clearBtn");
  var progress = document.getElementById("progress"), fill = document.getElementById("progressFill"), label = document.getElementById("progressLabel");
  var msg = document.getElementById("msg"), result = document.getElementById("result");
  var resultName = document.getElementById("resultName"), resultMeta = document.getElementById("resultMeta"), downloadBtn = document.getElementById("downloadBtn");

  var items = [], outputBlob = null, outputName = "merged.pdf";

  function refresh() {
    C.renderFileList(fileList, items.map(function (it) { return { id: it.id, name: it.file.name, size: it.file.size }; }), removeItem);
    runBtn.disabled = items.length < 2;
    clearBtn.hidden = items.length === 0;
  }
  function removeItem(id) { items = items.filter(function (it) { return it.id !== id; }); refresh(); }
  function onFiles(fl) {
    C.hideMsg(msg);
    var errors = [];
    Array.prototype.forEach.call(fl, function (file) {
      var v = C.validateFile(file, { accept: [".pdf"], mime: ["application/pdf"], maxSizeMB: 50 });
      if (!v.ok) { errors.push(v.error); return; }
      items.push({ id: C.uid(), file: file });
    });
    if (errors.length) C.showMsg(msg, errors.join(" "), "error");
    refresh();
  }
  C.initDropzone(dz, input, { onFiles: onFiles });
  clearBtn.addEventListener("click", function () { items = []; result.classList.remove("show"); refresh(); });

  runBtn.addEventListener("click", async function () {
    if (items.length < 2) { C.showMsg(msg, "Add at least two PDF files to merge.", "error"); return; }
    runBtn.disabled = true;
    C.hideMsg(msg); result.classList.remove("show");
    try {
      await C.loadScript("https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js");
      var PDFLib = window.PDFLib;
      var merged = await PDFLib.PDFDocument.create();
      for (var i = 0; i < items.length; i++) {
        C.setProgress(progress, fill, label, (i / items.length) * 90, "Adding " + items[i].file.name);
        var buf = await C.readFileAsArrayBuffer(items[i].file);
        var src = await PDFLib.PDFDocument.load(buf, { ignoreEncryption: true });
        if (src.isEncrypted) throw new Error(items[i].file.name + " is password-protected — remove its password first.");
        var pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach(function (p) { merged.addPage(p); });
      }
      C.setProgress(progress, fill, label, 95, "Saving merged PDF…");
      var bytes = await merged.save();
      outputBlob = new Blob([bytes], { type: "application/pdf" });
      outputName = "merged-" + items.length + "-files.pdf";
      C.setProgress(progress, fill, label, 100, "Done");
      resultName.textContent = outputName;
      resultMeta.textContent = items.length + " files merged · " + merged.getPageCount() + " pages · " + C.formatBytes(outputBlob.size);
      result.classList.add("show");
      C.showMsg(msg, "Merged successfully.", "success");
    } catch (err) {
      console.error(err);
      C.showMsg(msg, "Couldn't merge these files: " + err.message, "error");
    } finally {
      runBtn.disabled = false;
      C.resetProgress(progress, fill);
    }
  });

  downloadBtn.addEventListener("click", function () { if (outputBlob) C.downloadBlob(outputBlob, outputName); });

}

function mount_split_pdf(root) {
  "use strict";
var C = window.PDFToolsCommon;
  var dz = document.getElementById("dz"), input = document.getElementById("fileInput");
  var fileList = document.getElementById("fileList"), optionsBox = document.getElementById("optionsBox");
  var splitMode = document.getElementById("splitMode"), rangesField = document.getElementById("rangesField"),
      everyField = document.getElementById("everyField"), rangesInput = document.getElementById("ranges"), everyN = document.getElementById("everyN");
  var runBtn = document.getElementById("runBtn"), clearBtn = document.getElementById("clearBtn");
  var progress = document.getElementById("progress"), fill = document.getElementById("progressFill"), label = document.getElementById("progressLabel");
  var msg = document.getElementById("msg"), result = document.getElementById("result");
  var resultName = document.getElementById("resultName"), resultMeta = document.getElementById("resultMeta"), downloadBtn = document.getElementById("downloadBtn");

  var currentFile = null, pageCount = null, outputBlob = null, outputName = "";

  function refreshUI() {
    var has = !!currentFile;
    runBtn.disabled = !has; clearBtn.hidden = !has; optionsBox.hidden = !has;
    if (!has) fileList.innerHTML = "";
  }
  function updateModeFields() {
    rangesField.hidden = splitMode.value !== "ranges";
    everyField.hidden = splitMode.value !== "every";
  }
  splitMode.addEventListener("change", updateModeFields);
  updateModeFields();

  function setFile(file) {
    C.hideMsg(msg);
    var v = C.validateFile(file, { accept: [".pdf"], mime: ["application/pdf"], maxSizeMB: 50 });
    if (!v.ok) { C.showMsg(msg, v.error, "error"); return; }
    currentFile = file;
    pageCount = null;
    C.renderFileList(fileList, [{ id: "f", name: file.name, size: file.size }], function () { currentFile = null; refreshUI(); });
    refreshUI();
    C.loadScript("https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js").then(function () {
      return C.readFileAsArrayBuffer(file);
    }).then(function (buf) {
      return window.PDFLib.PDFDocument.load(buf, { ignoreEncryption: true });
    }).then(function (doc) {
      pageCount = doc.getPageCount();
      rangesInput.parentElement.querySelector(".hint").textContent =
        "Comma-separated ranges, e.g. 1-3, 4-6. This file has " + pageCount + " page" + (pageCount > 1 ? "s" : "") + ".";
      everyN.max = pageCount;
    }).catch(function () { /* page count is a convenience hint only */ });
  }
  C.initDropzone(dz, input, { onFiles: function (files) { setFile(files[0]); } });
  clearBtn.addEventListener("click", function () { currentFile = null; result.classList.remove("show"); refreshUI(); });

  function parseRanges(str, total) {
    var parts = str.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    var out = [];
    parts.forEach(function (p) {
      var m = /^(\d+)\s*-\s*(\d+)$/.exec(p);
      if (m) {
        var a = parseInt(m[1], 10), b = parseInt(m[2], 10);
        if (a < 1) a = 1; if (b > total) b = total;
        var idx = [];
        for (var i = a; i <= b; i++) idx.push(i - 1);
        out.push(idx);
      } else if (/^\d+$/.test(p)) {
        var n = parseInt(p, 10);
        if (n >= 1 && n <= total) out.push([n - 1]);
      }
    });
    return out;
  }

  runBtn.addEventListener("click", async function () {
    if (!currentFile) return;
    runBtn.disabled = true;
    C.hideMsg(msg); result.classList.remove("show");
    try {
      await C.loadScript("https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js");
      await C.loadScript("https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js");
      var PDFLib = window.PDFLib;
      var buf = await C.readFileAsArrayBuffer(currentFile);
      var src = await PDFLib.PDFDocument.load(buf, { ignoreEncryption: true });
      if (src.isEncrypted) throw new Error("This PDF is password-protected — remove its password first.");
      var total = src.getPageCount();
      var groups = [];

      if (splitMode.value === "each") {
        for (var i = 0; i < total; i++) groups.push([i]);
      } else if (splitMode.value === "every") {
        var n = Math.max(1, parseInt(everyN.value, 10) || 1);
        for (var i = 0; i < total; i += n) {
          var g = [];
          for (var j = i; j < Math.min(i + n, total); j++) g.push(j);
          groups.push(g);
        }
      } else {
        groups = parseRanges(rangesInput.value, total);
        if (!groups.length) throw new Error("Enter at least one valid page range, e.g. 1-3, 4-6.");
      }

      var base = C.baseName(currentFile.name);
      var zip = new window.JSZip();
      for (var gi = 0; gi < groups.length; gi++) {
        C.setProgress(progress, fill, label, (gi / groups.length) * 90, "Building file " + (gi + 1) + " of " + groups.length);
        var doc = await PDFLib.PDFDocument.create();
        var pages = await doc.copyPages(src, groups[gi]);
        pages.forEach(function (p) { doc.addPage(p); });
        var bytes = await doc.save();
        zip.file(base + "-part-" + String(gi + 1).padStart(2, "0") + ".pdf", bytes);
      }
      C.setProgress(progress, fill, label, 95, "Packaging ZIP…");
      outputBlob = await zip.generateAsync({ type: "blob" });
      outputName = base + "-split.zip";
      C.setProgress(progress, fill, label, 100, "Done");
      resultName.textContent = outputName;
      resultMeta.textContent = groups.length + " file" + (groups.length > 1 ? "s" : "") + " · " + C.formatBytes(outputBlob.size);
      result.classList.add("show");
      C.showMsg(msg, "Split successfully.", "success");
    } catch (err) {
      console.error(err);
      C.showMsg(msg, "Couldn't split this PDF: " + err.message, "error");
    } finally {
      runBtn.disabled = false;
      C.resetProgress(progress, fill);
    }
  });

  downloadBtn.addEventListener("click", function () { if (outputBlob) C.downloadBlob(outputBlob, outputName); });

}

function mount_compress_pdf(root) {
  "use strict";
var C = window.PDFToolsCommon;
  var dz = document.getElementById("dz"), input = document.getElementById("fileInput");
  var fileList = document.getElementById("fileList"), optionsBox = document.getElementById("optionsBox");
  var modeSelect = document.getElementById("mode"), qualityField = document.getElementById("qualityField"),
      qualityInput = document.getElementById("quality"), qualityVal = document.getElementById("qualityVal"), modeNote = document.getElementById("modeNote");
  var runBtn = document.getElementById("runBtn"), clearBtn = document.getElementById("clearBtn");
  var progress = document.getElementById("progress"), fill = document.getElementById("progressFill"), label = document.getElementById("progressLabel");
  var msg = document.getElementById("msg"), result = document.getElementById("result");
  var resultName = document.getElementById("resultName"), resultMeta = document.getElementById("resultMeta"), downloadBtn = document.getElementById("downloadBtn");

  var currentFile = null, outputBlob = null, outputName = "";

  function updateModeUI() {
    var strong = modeSelect.value === "strong";
    qualityField.hidden = !strong;
    modeNote.textContent = strong
      ? "Strong mode rasterizes each page as a compressed image — great for scanned PDFs, but text will no longer be selectable."
      : "Light mode re-saves the PDF more efficiently without touching page content — text stays selectable.";
  }
  modeSelect.addEventListener("change", updateModeUI);
  qualityInput.addEventListener("input", function () { qualityVal.textContent = qualityInput.value + "%"; });
  updateModeUI();

  function refreshUI() {
    var has = !!currentFile;
    runBtn.disabled = !has; clearBtn.hidden = !has; optionsBox.hidden = !has;
    if (!has) fileList.innerHTML = "";
  }
  function setFile(file) {
    C.hideMsg(msg);
    var v = C.validateFile(file, { accept: [".pdf"], mime: ["application/pdf"], maxSizeMB: 50 });
    if (!v.ok) { C.showMsg(msg, v.error, "error"); return; }
    currentFile = file;
    C.renderFileList(fileList, [{ id: "f", name: file.name, size: file.size }], function () { currentFile = null; refreshUI(); });
    refreshUI();
  }
  C.initDropzone(dz, input, { onFiles: function (files) { setFile(files[0]); } });
  clearBtn.addEventListener("click", function () { currentFile = null; result.classList.remove("show"); refreshUI(); });

  async function ensurePdfJs() {
    await C.loadScript("https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js");
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  }

  async function compressLight(buf) {
    var PDFLib = window.PDFLib;
    var doc = await PDFLib.PDFDocument.load(buf, { ignoreEncryption: true });
    if (doc.isEncrypted) throw new Error("This PDF is password-protected — remove its password first.");
    var bytes = await doc.save({ useObjectStreams: true, addDefaultPage: false });
    return new Blob([bytes], { type: "application/pdf" });
  }

  async function compressStrong(buf, quality) {
    await ensurePdfJs();
    await C.loadScript("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js");
    var pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
    var count = pdf.numPages;
    var jsPDFCtor = window.jspdf.jsPDF;
    var doc = null;
    for (var i = 1; i <= count; i++) {
      C.setProgress(progress, fill, label, (i / count) * 90, "Compressing page " + i + " of " + count);
      var page = await pdf.getPage(i);
      var viewport = page.getViewport({ scale: 1.5 });
      var canvas = document.createElement("canvas");
      canvas.width = viewport.width; canvas.height = viewport.height;
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;
      var dataUrl = canvas.toDataURL("image/jpeg", quality);
      var wpt = viewport.width * 0.75, hpt = viewport.height * 0.75;
      var orient = wpt > hpt ? "l" : "p";
      if (!doc) doc = new jsPDFCtor({ orientation: orient, unit: "pt", format: [wpt, hpt] });
      else doc.addPage([wpt, hpt], orient);
      doc.addImage(dataUrl, "JPEG", 0, 0, wpt, hpt, undefined, "FAST");
    }
    return doc.output("blob");
  }

  runBtn.addEventListener("click", async function () {
    if (!currentFile) return;
    runBtn.disabled = true;
    C.hideMsg(msg); result.classList.remove("show");
    try {
      var originalSize = currentFile.size;
      var buf = await C.readFileAsArrayBuffer(currentFile);
      var blob;
      if (modeSelect.value === "light") {
        await C.loadScript("https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js");
        C.setProgress(progress, fill, label, 40, "Re-saving PDF…");
        blob = await compressLight(buf);
      } else {
        blob = await compressStrong(buf, parseInt(qualityInput.value, 10) / 100);
      }
      outputBlob = blob;
      outputName = C.baseName(currentFile.name) + "-compressed.pdf";
      var pct = originalSize > 0 ? Math.round((1 - blob.size / originalSize) * 100) : 0;
      C.setProgress(progress, fill, label, 100, "Done");
      resultName.textContent = outputName;
      resultMeta.textContent = C.formatBytes(originalSize) + " → " + C.formatBytes(blob.size) +
        (pct > 0 ? " (" + pct + "% smaller)" : pct < 0 ? " (" + Math.abs(pct) + "% larger — try Strong mode)" : "");
      result.classList.add("show");
      C.showMsg(msg, "Compressed successfully.", "success");
    } catch (err) {
      console.error(err);
      C.showMsg(msg, "Couldn't compress this PDF: " + err.message, "error");
    } finally {
      runBtn.disabled = false;
      C.resetProgress(progress, fill);
    }
  });

  downloadBtn.addEventListener("click", function () { if (outputBlob) C.downloadBlob(outputBlob, outputName); });

}

function mount_delete_pdf_pages(root) {
  "use strict";
var C = window.PDFToolsCommon;
  var dz = document.getElementById("dz"), input = document.getElementById("fileInput");
  var fileList = document.getElementById("fileList"), pageGrid = document.getElementById("pageGrid");
  var pageToolbar = document.getElementById("pageToolbar");
  var selectAllBtn = document.getElementById("selectAllBtn"), selectNoneBtn = document.getElementById("selectNoneBtn");
  var runBtn = document.getElementById("runBtn"), clearBtn = document.getElementById("clearBtn");
  var progress = document.getElementById("progress"), fill = document.getElementById("progressFill"), label = document.getElementById("progressLabel");
  var msg = document.getElementById("msg"), result = document.getElementById("result");
  var resultName = document.getElementById("resultName"), resultMeta = document.getElementById("resultMeta"), downloadBtn = document.getElementById("downloadBtn");

  var currentFile = null, currentBuf = null, outputBlob = null, outputName = "";
  var mgr = new window.PDFPageManager(pageGrid, { mode: "select", selectLabel: "Delete" });

  async function ensurePdfJs() {
    await C.loadScript("https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js");
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  }

  function reset() {
    currentFile = null; currentBuf = null;
    pageGrid.innerHTML = ""; pageToolbar.hidden = true; fileList.innerHTML = "";
    result.classList.remove("show");
  }

  async function setFile(file) {
    C.hideMsg(msg);
    var v = C.validateFile(file, { accept: [".pdf"], mime: ["application/pdf"], maxSizeMB: 50 });
    if (!v.ok) { C.showMsg(msg, v.error, "error"); return; }
    reset();
    currentFile = file;
    C.renderFileList(fileList, [{ id: "f", name: file.name, size: file.size }], function () { reset(); });
    try {
      await ensurePdfJs();
      currentBuf = await C.readFileAsArrayBuffer(file);
      C.setProgress(progress, fill, label, 10, "Rendering pages…");
      var count = await mgr.load(currentBuf.slice(0), function (i, total) {
        C.setProgress(progress, fill, label, 10 + (i / total) * 80, "Rendering page " + i + " of " + total);
      });
      C.resetProgress(progress, fill);
      pageToolbar.hidden = false;
      if (count <= 1) C.showMsg(msg, "This PDF only has one page, so it can't be reduced further by deleting.", "info");
    } catch (err) {
      console.error(err);
      C.showMsg(msg, "Couldn't read this PDF: " + err.message, "error");
    }
  }
  C.initDropzone(dz, input, { onFiles: function (files) { setFile(files[0]); } });
  clearBtn.addEventListener("click", reset);
  selectAllBtn.addEventListener("click", function () { mgr.selectAll(true); });
  selectNoneBtn.addEventListener("click", function () { mgr.selectAll(false); });

  runBtn.addEventListener("click", async function () {
    if (!currentFile) return;
    var toDelete = mgr.getSelectedOriginalIndices();
    if (!toDelete.length) { C.showMsg(msg, "Select at least one page to delete.", "error"); return; }
    if (toDelete.length >= mgr.pages.length) { C.showMsg(msg, "You can't delete every page — at least one must remain.", "error"); return; }
    runBtn.disabled = true;
    C.hideMsg(msg); result.classList.remove("show");
    try {
      await C.loadScript("https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js");
      var PDFLib = window.PDFLib;
      C.setProgress(progress, fill, label, 30, "Removing pages…");
      var doc = await PDFLib.PDFDocument.load(currentBuf, { ignoreEncryption: true });
      toDelete.sort(function (a, b) { return b - a; }).forEach(function (idx) { doc.removePage(idx); });
      C.setProgress(progress, fill, label, 80, "Saving…");
      var bytes = await doc.save();
      outputBlob = new Blob([bytes], { type: "application/pdf" });
      outputName = C.baseName(currentFile.name) + "-edited.pdf";
      C.setProgress(progress, fill, label, 100, "Done");
      resultName.textContent = outputName;
      resultMeta.textContent = "Removed " + toDelete.length + " page" + (toDelete.length > 1 ? "s" : "") + " · " + C.formatBytes(outputBlob.size);
      result.classList.add("show");
      C.showMsg(msg, "Pages deleted successfully.", "success");
    } catch (err) {
      console.error(err);
      C.showMsg(msg, "Couldn't process this PDF: " + err.message, "error");
    } finally {
      runBtn.disabled = false;
      C.resetProgress(progress, fill);
    }
  });

  downloadBtn.addEventListener("click", function () { if (outputBlob) C.downloadBlob(outputBlob, outputName); });

}

function mount_rearrange_pdf_pages(root) {
  "use strict";
var C = window.PDFToolsCommon;
  var dz = document.getElementById("dz"), input = document.getElementById("fileInput");
  var fileList = document.getElementById("fileList"), pageGrid = document.getElementById("pageGrid");
  var pageToolbar = document.getElementById("pageToolbar");
  var runBtn = document.getElementById("runBtn"), clearBtn = document.getElementById("clearBtn");
  var progress = document.getElementById("progress"), fill = document.getElementById("progressFill"), label = document.getElementById("progressLabel");
  var msg = document.getElementById("msg"), result = document.getElementById("result");
  var resultName = document.getElementById("resultName"), resultMeta = document.getElementById("resultMeta"), downloadBtn = document.getElementById("downloadBtn");

  var currentFile = null, currentBuf = null, outputBlob = null, outputName = "";
  var mgr = new window.PDFPageManager(pageGrid, { mode: "reorder" });

  async function ensurePdfJs() {
    await C.loadScript("https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js");
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  }
  function reset() {
    currentFile = null; currentBuf = null;
    pageGrid.innerHTML = ""; pageToolbar.hidden = true; fileList.innerHTML = "";
    result.classList.remove("show");
  }
  async function setFile(file) {
    C.hideMsg(msg);
    var v = C.validateFile(file, { accept: [".pdf"], mime: ["application/pdf"], maxSizeMB: 50 });
    if (!v.ok) { C.showMsg(msg, v.error, "error"); return; }
    reset();
    currentFile = file;
    C.renderFileList(fileList, [{ id: "f", name: file.name, size: file.size }], function () { reset(); });
    try {
      await ensurePdfJs();
      currentBuf = await C.readFileAsArrayBuffer(file);
      C.setProgress(progress, fill, label, 10, "Rendering pages…");
      var count = await mgr.load(currentBuf.slice(0), function (i, total) {
        C.setProgress(progress, fill, label, 10 + (i / total) * 80, "Rendering page " + i + " of " + total);
      });
      C.resetProgress(progress, fill);
      pageToolbar.hidden = false;
      if (count <= 1) C.showMsg(msg, "This PDF only has one page, so there's nothing to reorder.", "info");
    } catch (err) {
      console.error(err);
      C.showMsg(msg, "Couldn't read this PDF: " + err.message, "error");
    }
  }
  C.initDropzone(dz, input, { onFiles: function (files) { setFile(files[0]); } });
  clearBtn.addEventListener("click", reset);

  runBtn.addEventListener("click", async function () {
    if (!currentFile) return;
    runBtn.disabled = true;
    C.hideMsg(msg); result.classList.remove("show");
    try {
      await C.loadScript("https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js");
      var PDFLib = window.PDFLib;
      var order = mgr.getOrderOriginalIndices();
      C.setProgress(progress, fill, label, 30, "Reordering pages…");
      var src = await PDFLib.PDFDocument.load(currentBuf, { ignoreEncryption: true });
      var doc = await PDFLib.PDFDocument.create();
      var pages = await doc.copyPages(src, order);
      pages.forEach(function (p) { doc.addPage(p); });
      C.setProgress(progress, fill, label, 85, "Saving…");
      var bytes = await doc.save();
      outputBlob = new Blob([bytes], { type: "application/pdf" });
      outputName = C.baseName(currentFile.name) + "-reordered.pdf";
      C.setProgress(progress, fill, label, 100, "Done");
      resultName.textContent = outputName;
      resultMeta.textContent = order.length + " pages · " + C.formatBytes(outputBlob.size);
      result.classList.add("show");
      C.showMsg(msg, "New page order saved.", "success");
    } catch (err) {
      console.error(err);
      C.showMsg(msg, "Couldn't process this PDF: " + err.message, "error");
    } finally {
      runBtn.disabled = false;
      C.resetProgress(progress, fill);
    }
  });

  downloadBtn.addEventListener("click", function () { if (outputBlob) C.downloadBlob(outputBlob, outputName); });

}

function mount_rotate_pdf_pages(root) {
  "use strict";
var C = window.PDFToolsCommon;
  var dz = document.getElementById("dz"), input = document.getElementById("fileInput");
  var fileList = document.getElementById("fileList"), pageGrid = document.getElementById("pageGrid");
  var pageToolbar = document.getElementById("pageToolbar");
  var rotateAllBtn = document.getElementById("rotateAllBtn");
  var runBtn = document.getElementById("runBtn"), clearBtn = document.getElementById("clearBtn");
  var progress = document.getElementById("progress"), fill = document.getElementById("progressFill"), label = document.getElementById("progressLabel");
  var msg = document.getElementById("msg"), result = document.getElementById("result");
  var resultName = document.getElementById("resultName"), resultMeta = document.getElementById("resultMeta"), downloadBtn = document.getElementById("downloadBtn");

  var currentFile = null, currentBuf = null, outputBlob = null, outputName = "";
  var mgr = new window.PDFPageManager(pageGrid, { mode: "rotate" });

  async function ensurePdfJs() {
    await C.loadScript("https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js");
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  }
  function reset() {
    currentFile = null; currentBuf = null;
    pageGrid.innerHTML = ""; pageToolbar.hidden = true; fileList.innerHTML = "";
    result.classList.remove("show");
  }
  async function setFile(file) {
    C.hideMsg(msg);
    var v = C.validateFile(file, { accept: [".pdf"], mime: ["application/pdf"], maxSizeMB: 50 });
    if (!v.ok) { C.showMsg(msg, v.error, "error"); return; }
    reset();
    currentFile = file;
    C.renderFileList(fileList, [{ id: "f", name: file.name, size: file.size }], function () { reset(); });
    try {
      await ensurePdfJs();
      currentBuf = await C.readFileAsArrayBuffer(file);
      C.setProgress(progress, fill, label, 10, "Rendering pages…");
      await mgr.load(currentBuf.slice(0), function (i, total) {
        C.setProgress(progress, fill, label, 10 + (i / total) * 80, "Rendering page " + i + " of " + total);
      });
      C.resetProgress(progress, fill);
      pageToolbar.hidden = false;
    } catch (err) {
      console.error(err);
      C.showMsg(msg, "Couldn't read this PDF: " + err.message, "error");
    }
  }
  C.initDropzone(dz, input, { onFiles: function (files) { setFile(files[0]); } });
  clearBtn.addEventListener("click", reset);
  rotateAllBtn.addEventListener("click", function () {
    mgr.pages.forEach(function (p) { p.rotation = (p.rotation + 90) % 360; });
    mgr.render();
  });

  runBtn.addEventListener("click", async function () {
    if (!currentFile) return;
    var rotations = mgr.getRotationsByOriginalIndex();
    var anyRotated = Object.keys(rotations).some(function (k) { return rotations[k] !== 0; });
    if (!anyRotated) { C.showMsg(msg, "Rotate at least one page before applying.", "error"); return; }
    runBtn.disabled = true;
    C.hideMsg(msg); result.classList.remove("show");
    try {
      await C.loadScript("https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js");
      var PDFLib = window.PDFLib;
      C.setProgress(progress, fill, label, 30, "Applying rotation…");
      var doc = await PDFLib.PDFDocument.load(currentBuf, { ignoreEncryption: true });
      var pages = doc.getPages();
      pages.forEach(function (page, idx) {
        var add = rotations[idx] || 0;
        if (add) {
          var current = page.getRotation().angle;
          page.setRotation(PDFLib.degrees((current + add) % 360));
        }
      });
      C.setProgress(progress, fill, label, 85, "Saving…");
      var bytes = await doc.save();
      outputBlob = new Blob([bytes], { type: "application/pdf" });
      outputName = C.baseName(currentFile.name) + "-rotated.pdf";
      C.setProgress(progress, fill, label, 100, "Done");
      resultName.textContent = outputName;
      resultMeta.textContent = pages.length + " pages · " + C.formatBytes(outputBlob.size);
      result.classList.add("show");
      C.showMsg(msg, "Rotation applied successfully.", "success");
    } catch (err) {
      console.error(err);
      C.showMsg(msg, "Couldn't process this PDF: " + err.message, "error");
    } finally {
      runBtn.disabled = false;
      C.resetProgress(progress, fill);
    }
  });

  downloadBtn.addEventListener("click", function () { if (outputBlob) C.downloadBlob(outputBlob, outputName); });

}

function mount_pdf_watermark(root) {
  "use strict";
var C = window.PDFToolsCommon;
  var dz = document.getElementById("dz"), input = document.getElementById("fileInput");
  var fileList = document.getElementById("fileList"), optionsBox = document.getElementById("optionsBox");
  var wmText = document.getElementById("wmText"), wmSize = document.getElementById("wmSize"), wmSizeVal = document.getElementById("wmSizeVal");
  var wmOpacity = document.getElementById("wmOpacity"), wmOpacityVal = document.getElementById("wmOpacityVal");
  var wmAngle = document.getElementById("wmAngle"), wmAngleVal = document.getElementById("wmAngleVal");
  var wmColor = document.getElementById("wmColor"), wmPosition = document.getElementById("wmPosition");
  var runBtn = document.getElementById("runBtn"), clearBtn = document.getElementById("clearBtn");
  var progress = document.getElementById("progress"), fill = document.getElementById("progressFill"), label = document.getElementById("progressLabel");
  var msg = document.getElementById("msg"), result = document.getElementById("result");
  var resultName = document.getElementById("resultName"), resultMeta = document.getElementById("resultMeta"), downloadBtn = document.getElementById("downloadBtn");

  wmSize.addEventListener("input", function () { wmSizeVal.textContent = wmSize.value; });
  wmOpacity.addEventListener("input", function () { wmOpacityVal.textContent = wmOpacity.value + "%"; });
  wmAngle.addEventListener("input", function () { wmAngleVal.textContent = wmAngle.value; });

  var currentFile = null, outputBlob = null, outputName = "";
  var COLORS = { gray: [0.5, 0.5, 0.5], red: [0.8, 0.15, 0.15], blue: [0.15, 0.3, 0.8], black: [0.05, 0.05, 0.05] };

  function refreshUI() {
    var has = !!currentFile;
    runBtn.disabled = !has; clearBtn.hidden = !has; optionsBox.hidden = !has;
    if (!has) fileList.innerHTML = "";
  }
  function setFile(file) {
    C.hideMsg(msg);
    var v = C.validateFile(file, { accept: [".pdf"], mime: ["application/pdf"], maxSizeMB: 50 });
    if (!v.ok) { C.showMsg(msg, v.error, "error"); return; }
    currentFile = file;
    C.renderFileList(fileList, [{ id: "f", name: file.name, size: file.size }], function () { currentFile = null; refreshUI(); });
    refreshUI();
  }
  C.initDropzone(dz, input, { onFiles: function (files) { setFile(files[0]); } });
  clearBtn.addEventListener("click", function () { currentFile = null; result.classList.remove("show"); refreshUI(); });

  runBtn.addEventListener("click", async function () {
    if (!currentFile) return;
    var text = wmText.value.trim();
    if (!text) { C.showMsg(msg, "Enter watermark text.", "error"); return; }
    runBtn.disabled = true;
    C.hideMsg(msg); result.classList.remove("show");
    try {
      await C.loadScript("https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js");
      var PDFLib = window.PDFLib;
      var buf = await C.readFileAsArrayBuffer(currentFile);
      var doc = await PDFLib.PDFDocument.load(buf, { ignoreEncryption: true });
      if (doc.isEncrypted) throw new Error("This PDF is password-protected — remove its password first.");
      var font = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
      var size = parseInt(wmSize.value, 10);
      var opacity = parseInt(wmOpacity.value, 10) / 100;
      var angle = parseInt(wmAngle.value, 10);
      var color = COLORS[wmColor.value];
      var tiled = wmPosition.value === "tile";
      var pages = doc.getPages();

      pages.forEach(function (page, idx) {
        C.setProgress(progress, fill, label, (idx / pages.length) * 90, "Watermarking page " + (idx + 1) + " of " + pages.length);
        var w2 = page.getWidth(), h2 = page.getHeight();
        var textWidth = font.widthOfTextAtSize(text, size);

        if (!tiled) {
          page.drawText(text, {
            x: w2 / 2 - (textWidth / 2) * Math.cos(angle * Math.PI / 180),
            y: h2 / 2,
            size: size, font: font,
            color: PDFLib.rgb(color[0], color[1], color[2]),
            opacity: opacity, rotate: PDFLib.degrees(angle)
          });
        } else {
          var stepX = textWidth + size * 3;
          var stepY = size * 4;
          for (var y = -h2; y < h2 * 2; y += stepY) {
            for (var x = -w2; x < w2 * 2; x += stepX) {
              page.drawText(text, {
                x: x, y: y, size: size, font: font,
                color: PDFLib.rgb(color[0], color[1], color[2]),
                opacity: opacity, rotate: PDFLib.degrees(angle)
              });
            }
          }
        }
      });

      C.setProgress(progress, fill, label, 95, "Saving…");
      var bytes = await doc.save();
      outputBlob = new Blob([bytes], { type: "application/pdf" });
      outputName = C.baseName(currentFile.name) + "-watermarked.pdf";
      C.setProgress(progress, fill, label, 100, "Done");
      resultName.textContent = outputName;
      resultMeta.textContent = pages.length + " pages watermarked · " + C.formatBytes(outputBlob.size);
      result.classList.add("show");
      C.showMsg(msg, "Watermark added successfully.", "success");
    } catch (err) {
      console.error(err);
      C.showMsg(msg, "Couldn't add the watermark: " + err.message, "error");
    } finally {
      runBtn.disabled = false;
      C.resetProgress(progress, fill);
    }
  });

  downloadBtn.addEventListener("click", function () { if (outputBlob) C.downloadBlob(outputBlob, outputName); });

}

async function mount_protect_pdf(root) {
  "use strict";
  var createQpdfModule = (await import('https://cdn.jsdelivr.net/npm/@neslinesli93/qpdf-wasm@0.3.0/dist/qpdf.js')).default;
var C = window.PDFToolsCommon;
  var dz = document.getElementById("dz"), input = document.getElementById("fileInput");
  var fileList = document.getElementById("fileList"), optionsBox = document.getElementById("optionsBox");
  var userPw = document.getElementById("userPw"), confirmPw = document.getElementById("confirmPw");
  var runBtn = document.getElementById("runBtn"), clearBtn = document.getElementById("clearBtn");
  var progress = document.getElementById("progress"), fill = document.getElementById("progressFill"), label = document.getElementById("progressLabel");
  var msg = document.getElementById("msg"), result = document.getElementById("result");
  var resultName = document.getElementById("resultName"), resultMeta = document.getElementById("resultMeta"), downloadBtn = document.getElementById("downloadBtn");

  var currentFile = null, outputBlob = null, outputName = "";

  function refreshUI() {
    var has = !!currentFile;
    runBtn.disabled = !has; clearBtn.hidden = !has; optionsBox.hidden = !has;
    if (!has) fileList.innerHTML = "";
  }
  function setFile(file) {
    C.hideMsg(msg);
    var v = C.validateFile(file, { accept: [".pdf"], mime: ["application/pdf"], maxSizeMB: 30 });
    if (!v.ok) { C.showMsg(msg, v.error, "error"); return; }
    currentFile = file;
    C.renderFileList(fileList, [{ id: "f", name: file.name, size: file.size }], function () { currentFile = null; refreshUI(); });
    refreshUI();
  }
  C.initDropzone(dz, input, { onFiles: function (files) { setFile(files[0]); } });
  clearBtn.addEventListener("click", function () { currentFile = null; result.classList.remove("show"); refreshUI(); });

  runBtn.addEventListener("click", async function () {
    if (!currentFile) return;
    var pw = userPw.value;
    if (!pw) { C.showMsg(msg, "Enter a password.", "error"); return; }
    if (pw !== confirmPw.value) { C.showMsg(msg, "Passwords don't match.", "error"); return; }
    runBtn.disabled = true;
    C.hideMsg(msg); result.classList.remove("show");
    try {
      C.setProgress(progress, fill, label, 15, "Loading encryption module…");
      var qpdf = await createQpdfModule({
        locateFile: function () { return "https://cdn.jsdelivr.net/npm/@neslinesli93/qpdf-wasm@0.3.0/dist/qpdf.wasm"; },
        noInitialRun: true,
      });
      C.setProgress(progress, fill, label, 45, "Reading file…");
      var buf = await C.readFileAsArrayBuffer(currentFile);
      qpdf.FS.writeFile("/input.pdf", new Uint8Array(buf));

      C.setProgress(progress, fill, label, 65, "Encrypting…");
      qpdf.callMain(["--encrypt", pw, pw, "256", "--", "/input.pdf", "/output.pdf"]);

      var outBytes;
      try {
        outBytes = qpdf.FS.readFile("/output.pdf");
      } catch (e) {
        throw new Error("Encryption failed — the file may already be encrypted or use an unsupported PDF structure.");
      }

      outputBlob = new Blob([outBytes], { type: "application/pdf" });
      outputName = C.baseName(currentFile.name) + "-protected.pdf";
      C.setProgress(progress, fill, label, 100, "Done");
      resultName.textContent = outputName;
      resultMeta.textContent = "Password-protected · " + C.formatBytes(outputBlob.size);
      result.classList.add("show");
      C.showMsg(msg, "PDF protected successfully. Keep the password somewhere safe — it can't be recovered.", "success");
    } catch (err) {
      console.error(err);
      C.showMsg(msg, "Couldn't protect this PDF: " + err.message + " If this keeps happening, the encryption module may not have loaded correctly on this network/browser.", "error");
    } finally {
      runBtn.disabled = false;
      C.resetProgress(progress, fill);
    }
  });

  downloadBtn.addEventListener("click", function () { if (outputBlob) C.downloadBlob(outputBlob, outputName); });

}

async function mount_remove_pdf_password(root) {
  "use strict";
  var createQpdfModule = (await import('https://cdn.jsdelivr.net/npm/@neslinesli93/qpdf-wasm@0.3.0/dist/qpdf.js')).default;
var C = window.PDFToolsCommon;
  var dz = document.getElementById("dz"), input = document.getElementById("fileInput");
  var fileList = document.getElementById("fileList"), optionsBox = document.getElementById("optionsBox");
  var currentPw = document.getElementById("currentPw");
  var runBtn = document.getElementById("runBtn"), clearBtn = document.getElementById("clearBtn");
  var progress = document.getElementById("progress"), fill = document.getElementById("progressFill"), label = document.getElementById("progressLabel");
  var msg = document.getElementById("msg"), result = document.getElementById("result");
  var resultName = document.getElementById("resultName"), resultMeta = document.getElementById("resultMeta"), downloadBtn = document.getElementById("downloadBtn");

  var currentFile = null, outputBlob = null, outputName = "";

  function refreshUI() {
    var has = !!currentFile;
    runBtn.disabled = !has; clearBtn.hidden = !has; optionsBox.hidden = !has;
    if (!has) fileList.innerHTML = "";
  }
  function setFile(file) {
    C.hideMsg(msg);
    var v = C.validateFile(file, { accept: [".pdf"], mime: ["application/pdf"], maxSizeMB: 30 });
    if (!v.ok) { C.showMsg(msg, v.error, "error"); return; }
    currentFile = file;
    C.renderFileList(fileList, [{ id: "f", name: file.name, size: file.size }], function () { currentFile = null; refreshUI(); });
    refreshUI();
  }
  C.initDropzone(dz, input, { onFiles: function (files) { setFile(files[0]); } });
  clearBtn.addEventListener("click", function () { currentFile = null; result.classList.remove("show"); refreshUI(); });

  runBtn.addEventListener("click", async function () {
    if (!currentFile) return;
    var pw = currentPw.value;
    if (!pw) { C.showMsg(msg, "Enter the file's current password.", "error"); return; }
    runBtn.disabled = true;
    C.hideMsg(msg); result.classList.remove("show");
    try {
      C.setProgress(progress, fill, label, 15, "Loading decryption module…");
      var qpdf = await createQpdfModule({
        locateFile: function () { return "https://cdn.jsdelivr.net/npm/@neslinesli93/qpdf-wasm@0.3.0/dist/qpdf.wasm"; },
        noInitialRun: true,
      });
      C.setProgress(progress, fill, label, 45, "Reading file…");
      var buf = await C.readFileAsArrayBuffer(currentFile);
      qpdf.FS.writeFile("/input.pdf", new Uint8Array(buf));

      C.setProgress(progress, fill, label, 65, "Removing password…");
      qpdf.callMain(["--password=" + pw, "--decrypt", "/input.pdf", "/output.pdf"]);

      var outBytes;
      try {
        outBytes = qpdf.FS.readFile("/output.pdf");
      } catch (e) {
        throw new Error("Couldn't unlock this file — double-check the password, or the PDF may not be encrypted.");
      }

      outputBlob = new Blob([outBytes], { type: "application/pdf" });
      outputName = C.baseName(currentFile.name) + "-unlocked.pdf";
      C.setProgress(progress, fill, label, 100, "Done");
      resultName.textContent = outputName;
      resultMeta.textContent = "Password removed · " + C.formatBytes(outputBlob.size);
      result.classList.add("show");
      C.showMsg(msg, "Password removed successfully.", "success");
    } catch (err) {
      console.error(err);
      C.showMsg(msg, "Couldn't remove the password: " + err.message, "error");
    } finally {
      runBtn.disabled = false;
      C.resetProgress(progress, fill);
    }
  });

  downloadBtn.addEventListener("click", function () { if (outputBlob) C.downloadBlob(outputBlob, outputName); });

}

function mount_pdf_page_numbering(root) {
  "use strict";
var C = window.PDFToolsCommon;
  var dz = document.getElementById("dz"), input = document.getElementById("fileInput");
  var fileList = document.getElementById("fileList"), optionsBox = document.getElementById("optionsBox");
  var positionSel = document.getElementById("position"), formatSel = document.getElementById("format");
  var startNum = document.getElementById("startNum"), fontSizeInput = document.getElementById("fontSize");
  var runBtn = document.getElementById("runBtn"), clearBtn = document.getElementById("clearBtn");
  var progress = document.getElementById("progress"), fill = document.getElementById("progressFill"), label = document.getElementById("progressLabel");
  var msg = document.getElementById("msg"), result = document.getElementById("result");
  var resultName = document.getElementById("resultName"), resultMeta = document.getElementById("resultMeta"), downloadBtn = document.getElementById("downloadBtn");

  var currentFile = null, outputBlob = null, outputName = "";

  function refreshUI() {
    var has = !!currentFile;
    runBtn.disabled = !has; clearBtn.hidden = !has; optionsBox.hidden = !has;
    if (!has) fileList.innerHTML = "";
  }
  function setFile(file) {
    C.hideMsg(msg);
    var v = C.validateFile(file, { accept: [".pdf"], mime: ["application/pdf"], maxSizeMB: 50 });
    if (!v.ok) { C.showMsg(msg, v.error, "error"); return; }
    currentFile = file;
    C.renderFileList(fileList, [{ id: "f", name: file.name, size: file.size }], function () { currentFile = null; refreshUI(); });
    refreshUI();
  }
  C.initDropzone(dz, input, { onFiles: function (files) { setFile(files[0]); } });
  clearBtn.addEventListener("click", function () { currentFile = null; result.classList.remove("show"); refreshUI(); });

  function labelFor(format, n, total) {
    if (format === "page_n") return "Page " + n;
    if (format === "n_of_total") return n + " of " + total;
    return String(n);
  }

  runBtn.addEventListener("click", async function () {
    if (!currentFile) return;
    runBtn.disabled = true;
    C.hideMsg(msg); result.classList.remove("show");
    try {
      await C.loadScript("https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js");
      var PDFLib = window.PDFLib;
      var buf = await C.readFileAsArrayBuffer(currentFile);
      var doc = await PDFLib.PDFDocument.load(buf, { ignoreEncryption: true });
      if (doc.isEncrypted) throw new Error("This PDF is password-protected — remove its password first.");
      var font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
      var pages = doc.getPages();
      var start = parseInt(startNum.value, 10) || 0;
      var fontSize = parseInt(fontSizeInput.value, 10) || 11;
      var pos = positionSel.value;
      var format = formatSel.value;
      var margin = 24;
      var totalLabel = start + pages.length - 1;

      pages.forEach(function (page, idx) {
        C.setProgress(progress, fill, label, (idx / pages.length) * 90, "Numbering page " + (idx + 1) + " of " + pages.length);
        var n = start + idx;
        var txt = labelFor(format, n, totalLabel);
        var w2 = page.getWidth(), h2 = page.getHeight();
        var textWidth = font.widthOfTextAtSize(txt, fontSize);
        var x, y;
        if (pos.indexOf("left") !== -1) x = margin;
        else if (pos.indexOf("right") !== -1) x = w2 - margin - textWidth;
        else x = w2 / 2 - textWidth / 2;
        y = pos.indexOf("top") !== -1 ? h2 - margin : margin - fontSize * 0.3;
        page.drawText(txt, { x: x, y: y, size: fontSize, font: font, color: PDFLib.rgb(0.15, 0.15, 0.15) });
      });

      C.setProgress(progress, fill, label, 95, "Saving…");
      var bytes = await doc.save();
      outputBlob = new Blob([bytes], { type: "application/pdf" });
      outputName = C.baseName(currentFile.name) + "-numbered.pdf";
      C.setProgress(progress, fill, label, 100, "Done");
      resultName.textContent = outputName;
      resultMeta.textContent = pages.length + " pages numbered · " + C.formatBytes(outputBlob.size);
      result.classList.add("show");
      C.showMsg(msg, "Page numbers added successfully.", "success");
    } catch (err) {
      console.error(err);
      C.showMsg(msg, "Couldn't add page numbers: " + err.message, "error");
    } finally {
      runBtn.disabled = false;
      C.resetProgress(progress, fill);
    }
  });

  downloadBtn.addEventListener("click", function () { if (outputBlob) C.downloadBlob(outputBlob, outputName); });

}

function mount_extract_pdf_pages(root) {
  "use strict";
var C = window.PDFToolsCommon;
  var dz = document.getElementById("dz"), input = document.getElementById("fileInput");
  var fileList = document.getElementById("fileList"), pageGrid = document.getElementById("pageGrid");
  var pageToolbar = document.getElementById("pageToolbar");
  var selectAllBtn = document.getElementById("selectAllBtn"), selectNoneBtn = document.getElementById("selectNoneBtn");
  var runBtn = document.getElementById("runBtn"), clearBtn = document.getElementById("clearBtn");
  var progress = document.getElementById("progress"), fill = document.getElementById("progressFill"), label = document.getElementById("progressLabel");
  var msg = document.getElementById("msg"), result = document.getElementById("result");
  var resultName = document.getElementById("resultName"), resultMeta = document.getElementById("resultMeta"), downloadBtn = document.getElementById("downloadBtn");

  var currentFile = null, currentBuf = null, outputBlob = null, outputName = "";
  var mgr = new window.PDFPageManager(pageGrid, { mode: "select", selectLabel: "Keep" });

  async function ensurePdfJs() {
    await C.loadScript("https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js");
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  }
  function reset() {
    currentFile = null; currentBuf = null;
    pageGrid.innerHTML = ""; pageToolbar.hidden = true; fileList.innerHTML = "";
    result.classList.remove("show");
  }
  async function setFile(file) {
    C.hideMsg(msg);
    var v = C.validateFile(file, { accept: [".pdf"], mime: ["application/pdf"], maxSizeMB: 50 });
    if (!v.ok) { C.showMsg(msg, v.error, "error"); return; }
    reset();
    currentFile = file;
    C.renderFileList(fileList, [{ id: "f", name: file.name, size: file.size }], function () { reset(); });
    try {
      await ensurePdfJs();
      currentBuf = await C.readFileAsArrayBuffer(file);
      C.setProgress(progress, fill, label, 10, "Rendering pages…");
      await mgr.load(currentBuf.slice(0), function (i, total) {
        C.setProgress(progress, fill, label, 10 + (i / total) * 80, "Rendering page " + i + " of " + total);
      });
      C.resetProgress(progress, fill);
      pageToolbar.hidden = false;
    } catch (err) {
      console.error(err);
      C.showMsg(msg, "Couldn't read this PDF: " + err.message, "error");
    }
  }
  C.initDropzone(dz, input, { onFiles: function (files) { setFile(files[0]); } });
  clearBtn.addEventListener("click", reset);
  selectAllBtn.addEventListener("click", function () { mgr.selectAll(true); });
  selectNoneBtn.addEventListener("click", function () { mgr.selectAll(false); });

  runBtn.addEventListener("click", async function () {
    if (!currentFile) return;
    var keep = mgr.getSelectedOriginalIndices().sort(function (a, b) { return a - b; });
    if (!keep.length) { C.showMsg(msg, "Select at least one page to extract.", "error"); return; }
    runBtn.disabled = true;
    C.hideMsg(msg); result.classList.remove("show");
    try {
      await C.loadScript("https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js");
      var PDFLib = window.PDFLib;
      C.setProgress(progress, fill, label, 30, "Extracting pages…");
      var src = await PDFLib.PDFDocument.load(currentBuf, { ignoreEncryption: true });
      var doc = await PDFLib.PDFDocument.create();
      var pages = await doc.copyPages(src, keep);
      pages.forEach(function (p) { doc.addPage(p); });
      C.setProgress(progress, fill, label, 85, "Saving…");
      var bytes = await doc.save();
      outputBlob = new Blob([bytes], { type: "application/pdf" });
      outputName = C.baseName(currentFile.name) + "-extracted.pdf";
      C.setProgress(progress, fill, label, 100, "Done");
      resultName.textContent = outputName;
      resultMeta.textContent = keep.length + " page" + (keep.length > 1 ? "s" : "") + " extracted · " + C.formatBytes(outputBlob.size);
      result.classList.add("show");
      C.showMsg(msg, "Pages extracted successfully.", "success");
    } catch (err) {
      console.error(err);
      C.showMsg(msg, "Couldn't process this PDF: " + err.message, "error");
    } finally {
      runBtn.disabled = false;
      C.resetProgress(progress, fill);
    }
  });

  downloadBtn.addEventListener("click", function () { if (outputBlob) C.downloadBlob(outputBlob, outputName); });

}

function mount_pdf_to_text(root) {
  "use strict";
var C = window.PDFToolsCommon;
  var dz = document.getElementById("dz"), input = document.getElementById("fileInput");
  var fileList = document.getElementById("fileList");
  var runBtn = document.getElementById("runBtn"), clearBtn = document.getElementById("clearBtn");
  var progress = document.getElementById("progress"), fill = document.getElementById("progressFill"), label = document.getElementById("progressLabel");
  var msg = document.getElementById("msg"), result = document.getElementById("result");
  var resultName = document.getElementById("resultName"), resultMeta = document.getElementById("resultMeta"), downloadBtn = document.getElementById("downloadBtn");
  var previewField = document.getElementById("previewField"), preview = document.getElementById("preview");

  var currentFile = null, outputBlob = null, outputName = "";

  function refreshUI() {
    var has = !!currentFile;
    runBtn.disabled = !has; clearBtn.hidden = !has;
    if (!has) fileList.innerHTML = "";
  }
  function setFile(file) {
    C.hideMsg(msg);
    var v = C.validateFile(file, { accept: [".pdf"], mime: ["application/pdf"], maxSizeMB: 50 });
    if (!v.ok) { C.showMsg(msg, v.error, "error"); return; }
    currentFile = file;
    C.renderFileList(fileList, [{ id: "f", name: file.name, size: file.size }], function () { currentFile = null; refreshUI(); });
    refreshUI();
  }
  C.initDropzone(dz, input, { onFiles: function (files) { setFile(files[0]); } });
  clearBtn.addEventListener("click", function () { currentFile = null; result.classList.remove("show"); previewField.hidden = true; refreshUI(); });

  async function ensurePdfJs() {
    await C.loadScript("https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js");
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  }

  runBtn.addEventListener("click", async function () {
    if (!currentFile) return;
    runBtn.disabled = true;
    C.hideMsg(msg); result.classList.remove("show");
    try {
      await ensurePdfJs();
      var buf = await C.readFileAsArrayBuffer(currentFile);
      var pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
      var count = pdf.numPages;
      var out = [];
      var hadAnyText = false;
      for (var i = 1; i <= count; i++) {
        C.setProgress(progress, fill, label, (i / count) * 95, "Extracting page " + i + " of " + count);
        var page = await pdf.getPage(i);
        var content = await page.getTextContent();
        var pageText = content.items.map(function (it) { return it.str; }).join(" ").trim();
        if (pageText) hadAnyText = true;
        out.push("----- Page " + i + " -----\n" + pageText);
      }
      var fullText = out.join("\n\n");
      if (!hadAnyText) {
        C.showMsg(msg, "No selectable text was found — this PDF may be a scanned image with no text layer.", "info");
      }
      outputBlob = new Blob([fullText], { type: "text/plain;charset=utf-8" });
      outputName = C.baseName(currentFile.name) + ".txt";
      preview.value = fullText;
      previewField.hidden = false;
      C.setProgress(progress, fill, label, 100, "Done");
      resultName.textContent = outputName;
      resultMeta.textContent = count + " page" + (count > 1 ? "s" : "") + " · " + C.formatBytes(outputBlob.size);
      result.classList.add("show");
      if (hadAnyText) C.showMsg(msg, "Text extracted successfully.", "success");
    } catch (err) {
      console.error(err);
      C.showMsg(msg, "Couldn't extract text: " + err.message, "error");
    } finally {
      runBtn.disabled = false;
      C.resetProgress(progress, fill);
    }
  });

  downloadBtn.addEventListener("click", function () { if (outputBlob) C.downloadBlob(outputBlob, outputName); });

}

function mount_text_to_pdf(root) {
  "use strict";
var C = window.PDFToolsCommon;
  var textInput = document.getElementById("textInput");
  var uploadTxtBtn = document.getElementById("uploadTxtBtn"), txtFileInput = document.getElementById("txtFileInput");
  var pageSize = document.getElementById("pageSize"), fontSizeInput = document.getElementById("fontSize"), lineSpacing = document.getElementById("lineSpacing");
  var runBtn = document.getElementById("runBtn"), clearBtn = document.getElementById("clearBtn");
  var progress = document.getElementById("progress"), fill = document.getElementById("progressFill"), label = document.getElementById("progressLabel");
  var msg = document.getElementById("msg"), result = document.getElementById("result");
  var resultName = document.getElementById("resultName"), resultMeta = document.getElementById("resultMeta"), downloadBtn = document.getElementById("downloadBtn");

  var outputBlob = null, outputName = "document.pdf";

  function refreshUI() { runBtn.disabled = !textInput.value.trim(); }
  textInput.addEventListener("input", refreshUI);
  uploadTxtBtn.addEventListener("click", function () { txtFileInput.click(); });
  txtFileInput.addEventListener("change", function () {
    var file = txtFileInput.files[0];
    if (!file) return;
    var v = C.validateFile(file, { accept: [".txt"], maxSizeMB: 5 });
    if (!v.ok) { C.showMsg(msg, v.error, "error"); return; }
    var reader = new FileReader();
    reader.onload = function () { textInput.value = reader.result; refreshUI(); };
    reader.readAsText(file);
  });
  clearBtn.addEventListener("click", function () { textInput.value = ""; result.classList.remove("show"); refreshUI(); });

  runBtn.addEventListener("click", async function () {
    var text = textInput.value;
    if (!text.trim()) return;
    runBtn.disabled = true;
    C.hideMsg(msg); result.classList.remove("show");
    try {
      await C.loadScript("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js");
      C.setProgress(progress, fill, label, 20, "Laying out pages…");
      var jsPDFCtor = window.jspdf.jsPDF;
      var doc = new jsPDFCtor({ unit: "pt", format: pageSize.value });
      var fontSize = parseInt(fontSizeInput.value, 10) || 12;
      var spacing = parseFloat(lineSpacing.value) || 1.15;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(fontSize);

      var margin = 48;
      var pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
      var maxWidth = pw - margin * 2;
      var lineHeight = fontSize * spacing;
      var y = margin;

      var paragraphs = text.split(/\r?\n/);
      paragraphs.forEach(function (para) {
        var lines = para.length ? doc.splitTextToSize(para, maxWidth) : [""];
        lines.forEach(function (line) {
          if (y + lineHeight > ph - margin) { doc.addPage(); y = margin; }
          doc.text(line, margin, y);
          y += lineHeight;
        });
      });

      C.setProgress(progress, fill, label, 90, "Finalizing…");
      outputBlob = doc.output("blob");
      outputName = "text-document.pdf";
      C.setProgress(progress, fill, label, 100, "Done");
      resultName.textContent = outputName;
      resultMeta.textContent = doc.internal.getNumberOfPages() + " page" + (doc.internal.getNumberOfPages() > 1 ? "s" : "") + " · " + C.formatBytes(outputBlob.size);
      result.classList.add("show");
      C.showMsg(msg, "PDF created successfully.", "success");
    } catch (err) {
      console.error(err);
      C.showMsg(msg, "Couldn't create the PDF: " + err.message, "error");
    } finally {
      runBtn.disabled = false;
      C.resetProgress(progress, fill);
    }
  });

  downloadBtn.addEventListener("click", function () { if (outputBlob) C.downloadBlob(outputBlob, outputName); });
  refreshUI();

}

function mount_pdf_metadata_remover(root) {
  "use strict";
var C = window.PDFToolsCommon;
  var dz = document.getElementById("dz"), input = document.getElementById("fileInput");
  var fileList = document.getElementById("fileList"), metaTable = document.getElementById("metaTable");
  var runBtn = document.getElementById("runBtn"), clearBtn = document.getElementById("clearBtn");
  var progress = document.getElementById("progress"), fill = document.getElementById("progressFill"), label = document.getElementById("progressLabel");
  var msg = document.getElementById("msg"), result = document.getElementById("result");
  var resultName = document.getElementById("resultName"), resultMeta = document.getElementById("resultMeta"), downloadBtn = document.getElementById("downloadBtn");

  var currentFile = null, outputBlob = null, outputName = "";

  function refreshUI() {
    var has = !!currentFile;
    runBtn.disabled = !has; clearBtn.hidden = !has;
    if (!has) { fileList.innerHTML = ""; metaTable.hidden = true; metaTable.innerHTML = ""; }
  }
  async function setFile(file) {
    C.hideMsg(msg);
    var v = C.validateFile(file, { accept: [".pdf"], mime: ["application/pdf"], maxSizeMB: 50 });
    if (!v.ok) { C.showMsg(msg, v.error, "error"); return; }
    currentFile = file;
    C.renderFileList(fileList, [{ id: "f", name: file.name, size: file.size }], function () { currentFile = null; refreshUI(); });
    refreshUI();
    try {
      await C.loadScript("https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js");
      var buf = await C.readFileAsArrayBuffer(file);
      var doc = await window.PDFLib.PDFDocument.load(buf, { ignoreEncryption: true });
      var rows = [
        ["Title", doc.getTitle()], ["Author", doc.getAuthor()], ["Subject", doc.getSubject()],
        ["Keywords", (doc.getKeywords() || "")], ["Creator", doc.getCreator()], ["Producer", doc.getProducer()],
      ];
      metaTable.innerHTML = rows.map(function (r) {
        return "<tr><td>" + r[0] + "</td><td>" + (r[1] ? escapeHtml(r[1]) : "<em>Not set</em>") + "</td></tr>";
      }).join("");
      metaTable.hidden = false;
    } catch (err) {
      console.error(err);
      C.showMsg(msg, "Couldn't read this PDF's metadata: " + err.message, "error");
    }
  }
  function escapeHtml(s) {
    var d = document.createElement("div"); d.textContent = s; return d.innerHTML;
  }
  C.initDropzone(dz, input, { onFiles: function (files) { setFile(files[0]); } });
  clearBtn.addEventListener("click", function () { currentFile = null; result.classList.remove("show"); refreshUI(); });

  runBtn.addEventListener("click", async function () {
    if (!currentFile) return;
    runBtn.disabled = true;
    C.hideMsg(msg); result.classList.remove("show");
    try {
      await C.loadScript("https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js");
      var buf = await C.readFileAsArrayBuffer(currentFile);
      C.setProgress(progress, fill, label, 40, "Clearing metadata…");
      var doc = await window.PDFLib.PDFDocument.load(buf, { ignoreEncryption: true });
      if (doc.isEncrypted) throw new Error("This PDF is password-protected — remove its password first.");
      doc.setTitle(""); doc.setAuthor(""); doc.setSubject(""); doc.setKeywords([]);
      doc.setCreator(""); doc.setProducer("");
      try { doc.setCreationDate(new Date(0)); doc.setModificationDate(new Date(0)); } catch (e) { /* optional */ }
      C.setProgress(progress, fill, label, 85, "Saving…");
      var bytes = await doc.save();
      outputBlob = new Blob([bytes], { type: "application/pdf" });
      outputName = C.baseName(currentFile.name) + "-cleaned.pdf";
      C.setProgress(progress, fill, label, 100, "Done");
      resultName.textContent = outputName;
      resultMeta.textContent = "Standard metadata fields cleared · " + C.formatBytes(outputBlob.size);
      result.classList.add("show");
      C.showMsg(msg, "Metadata removed successfully.", "success");
    } catch (err) {
      console.error(err);
      C.showMsg(msg, "Couldn't clear metadata: " + err.message, "error");
    } finally {
      runBtn.disabled = false;
      C.resetProgress(progress, fill);
    }
  });

  downloadBtn.addEventListener("click", function () { if (outputBlob) C.downloadBlob(outputBlob, outputName); });

}

var TOOL_HANDLERS = {
  'image-to-pdf': { name: 'Convert Images to PDF', mount: mount_image_to_pdf, isAsync: false },
  'pdf-to-jpg': { name: 'Convert PDF to JPG', mount: mount_pdf_to_jpg, isAsync: false },
  'pdf-to-png': { name: 'Convert PDF to PNG', mount: mount_pdf_to_png, isAsync: false },
  'merge-pdf': { name: 'Merge PDF Files Online', mount: mount_merge_pdf, isAsync: false },
  'split-pdf': { name: 'Split a PDF File', mount: mount_split_pdf, isAsync: false },
  'compress-pdf': { name: 'Compress PDF File Size', mount: mount_compress_pdf, isAsync: false },
  'delete-pdf-pages': { name: 'Delete Pages from a PDF', mount: mount_delete_pdf_pages, isAsync: false },
  'rearrange-pdf-pages': { name: 'Rearrange PDF Pages', mount: mount_rearrange_pdf_pages, isAsync: false },
  'rotate-pdf-pages': { name: 'Rotate PDF Pages', mount: mount_rotate_pdf_pages, isAsync: false },
  'pdf-watermark': { name: 'Add a Watermark to a PDF', mount: mount_pdf_watermark, isAsync: false },
  'protect-pdf': { name: 'Password Protect a PDF', mount: mount_protect_pdf, isAsync: true },
  'remove-pdf-password': { name: 'Remove a Password from a PDF', mount: mount_remove_pdf_password, isAsync: true },
  'pdf-page-numbering': { name: 'Add Page Numbers to a PDF', mount: mount_pdf_page_numbering, isAsync: false },
  'extract-pdf-pages': { name: 'Extract Pages from a PDF', mount: mount_extract_pdf_pages, isAsync: false },
  'pdf-to-text': { name: 'Convert PDF to Text', mount: mount_pdf_to_text, isAsync: false },
  'text-to-pdf': { name: 'Convert Text to PDF', mount: mount_text_to_pdf, isAsync: false },
  'pdf-metadata-remover': { name: 'Remove PDF Metadata', mount: mount_pdf_metadata_remover, isAsync: false }
};

// ============================================================
// ROUTER + VIEWS
// ============================================================
var appEl, yearEl;

function toolPageHTML(slug) {
  var m = TOOL_META[slug];
  return [
    '<section class="pdft-hero">',
    '  <div class="pdft-container">',
    '    <a href="#/" class="pdft-back">&larr; All PDF Tools</a>',
    '    <span class="pdft-eyebrow">' + m.cat + '</span>',
    '    <h1 class="pdft-h1">' + m.h1 + '</h1>',
    '    <p class="pdft-lede">' + m.lede + '</p>',
    '  </div>',
    '</section>',
    '<section class="pdft-container">',
    '  <div class="pdft-panel" id="toolPanel">',
         TOOL_WORKSPACES[slug],
    '  </div>',
    '  <div class="pdft-privacy">',
    '    <span class="glyph">🔒</span>',
    '    <p><strong>Your files are processed locally in your browser whenever possible.</strong> Processing: ' + m.ploc + '.</p>',
    '  </div>',
    '  <table class="pdft-metatable">',
    '    <tr><td>Supported formats</td><td>' + m.formats + '</td></tr>',
    '    <tr><td>Recommended max file size</td><td>' + m.maxsize + '</td></tr>',
    '  </table>',
    '</section>'
  ].join('\n');
}

function homeHTML(filter) {
  filter = (filter || '').toLowerCase();
  var cards = Object.keys(TOOL_META).map(function (slug) {
    var m = TOOL_META[slug];
    var hide = filter && m.h1.toLowerCase().indexOf(filter) === -1 && m.cat.toLowerCase().indexOf(filter) === -1;
    return '<a class="pdft-toolcard" href="#/' + slug + '"' + (hide ? ' hidden' : '') + '>' +
      '<div class="glyph">' + m.glyph + '</div>' +
      '<span class="cat">' + m.cat + '</span>' +
      '<h3>' + m.h1 + '</h3>' +
      '<p>' + m.lede.slice(0, 78) + (m.lede.length > 78 ? '…' : '') + '</p>' +
    '</a>';
  }).join('\n');

  return [
    '<section class="pdft-hero">',
    '  <div class="pdft-container">',
    '    <span class="pdft-eyebrow">17 free tools · No sign-up</span>',
    '    <h1 class="pdft-h1">Free Online PDF Tools</h1>',
    '    <p class="pdft-lede">Merge, split, compress, convert, and secure PDF files &mdash; every tool runs in your browser, so your documents are never uploaded to a server whenever technically possible.</p>',
    '    <div class="pdft-search">',
    '      <input type="search" id="toolSearch" placeholder="Search PDF tools&hellip; e.g. merge, compress, watermark" aria-label="Search PDF tools" value="' + filter + '">',
    '    </div>',
    '  </div>',
    '</section>',
    '<section class="pdft-container" style="padding:20px 0 40px;">',
    '  <div class="pdft-toolsgrid" id="toolsGrid">',
        cards,
    '  </div>',
    '</section>'
  ].join('\n');
}

function bindHomeSearch() {
  var input = document.getElementById('toolSearch');
  if (!input) return;
  input.addEventListener('input', function () {
    var q = input.value.trim().toLowerCase();
    document.querySelectorAll('.pdft-toolcard').forEach(function (c) {
      var text = (c.querySelector('h3').textContent + ' ' + c.querySelector('.cat').textContent).toLowerCase();
      c.hidden = !!q && text.indexOf(q) === -1;
    });
  });
  input.focus({ preventScroll: true });
}

async function render() {
  var hash = location.hash.replace(/^#\/?/, '');
  window.scrollTo(0, 0);
  if (!hash || hash === '') {
    appEl.innerHTML = homeHTML('');
    document.title = 'Free Online PDF Tools \u2014 Merge, Split, Compress & More';
    bindHomeSearch();
    return;
  }
  var handler = TOOL_HANDLERS[hash];
  if (!handler) {
    appEl.innerHTML = '<section class="pdft-container" style="padding:60px 0;text-align:center;">' +
      '<h1 class="pdft-h1">Tool not found</h1>' +
      '<p class="pdft-lede">That tool doesn\'t exist. <a href="#/">Go back to all PDF tools</a>.</p></section>';
    document.title = 'Not found \u2014 PDF Tools';
    return;
  }
  appEl.innerHTML = toolPageHTML(hash);
  document.title = handler.name + ' \u2014 PDF Tools';
  try {
    if (handler.isAsync) {
      await handler.mount(appEl);
    } else {
      handler.mount(appEl);
    }
  } catch (err) {
    console.error('Error mounting tool ' + hash, err);
  }
}

document.addEventListener('DOMContentLoaded', function () {
  appEl = document.getElementById('app');
  yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  var navToggle = document.querySelector('.pdft-nav-toggle');
  var navLinks = document.querySelector('.pdft-nav-links');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      var open = navLinks.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  window.addEventListener('hashchange', render);
  render();
});

})();