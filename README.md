# PDF Tools — Single-File Build (README)

Same 17 tools as the multi-page version, packed into 3 files instead of 40+,
so upload on GitHub's mobile UI is just 3 taps.

## 1. What's in this zip

```
index.html   ← shell page + hash router mount point
style.css    ← all styling (navy/electric-blue glass theme)
script.js    ← everything else: utilities, page-thumbnail manager,
               all 17 tools' logic, and the router
```

## 2. How to deploy

1. Upload all three files into your repo — either at the repo root, or into
   a subfolder like `/pdf-tools/` if you want it alongside your other tool
   sections (Image Tools, Finance Tools, Business Tools). Either works, since
   everything is self-contained and uses relative paths (`style.css`,
   `script.js`) — no absolute domain to find-and-replace this time.
2. Add a link to it from your site's homepage nav, e.g.
   `<a href="/pdf-tools/">PDF Tools</a>` (adjust the path to wherever you put it).
3. That's it — no build step, no other files needed.

## 3. How it works

- `index.html` is a shell: a header, an empty `<main id="app">`, and a footer.
- `script.js` reads the URL hash (e.g. `#/merge-pdf`, `#/compress-pdf`) and
  swaps the right tool's HTML + JavaScript into `#app` — that's the whole
  "single page app" part. No React, no build tools, just `location.hash` and
  `innerHTML`.
- The PDF/image libraries (pdf-lib, pdf.js, jsPDF, JSZip, qpdf-wasm) still
  load from CDN, and still only when you actually open a tool that needs
  them — switching to Merge PDF doesn't load the compression library, etc.
- Going back to the home tile grid, or opening a different tool, just changes
  the hash — bookmarking or sharing a link like `yoursite.com/#/protect-pdf`
  will open that specific tool directly.

## 4. Testing checklist

Already verified before packaging (see the QA note in chat), but confirm
these yourself after upload since I can't reach your live GitHub Pages URL
from here:

- [ ] Home grid loads, search box filters tools live
- [ ] Each tool opens via its tile and via typing the hash directly
      (e.g. `#/merge-pdf`) — refreshing on a tool's hash should reopen that
      same tool, not the home grid
- [ ] **Test Protect PDF / Remove PDF Password first** — these depend on a
      smaller WASM library (qpdf-wasm) I confirmed exists on npm/jsDelivr but
      couldn't live-test in a real browser from this sandbox. If either
      throws an error on load, tell me exactly what the error message says
      and I'll adjust the CDN path or add a fallback.
- [ ] Merge, Split, Compress, Image↔PDF, PDF↔JPG/PNG with a real file each
- [ ] Delete/Rearrange/Rotate/Extract Pages — thumbnails render, buttons work
- [ ] Watermark, Page Numbering, Metadata Remover
- [ ] PDF↔Text, Text↔PDF

## 5. What was dropped vs. the multi-page version

Going from 18 separate pages to 1 file necessarily drops the things that only
make sense with separate URLs:

- Unique `<title>` / meta description per tool
- Per-tool canonical URLs, breadcrumbs, sitemap entries
- FAQ / HowTo / SoftwareApplication structured data per tool
- "Related tools" internal linking

None of that affects functionality — every tool still does exactly what it
did before. It just means this version can't individually rank in Google for
searches like "merge pdf online" or "compress pdf" the way 17 separate pages
could, because it's all one URL. If you want both — quick personal use *and*
SEO reach — keep this single-file version and the multi-page version from
earlier in the conversation side by side; they don't conflict.

## 6. Libraries used (unchanged from the multi-page version)

| Library | Used by |
|---|---|
| pdf-lib 1.17.1 | merge, split, page management, watermark, page numbering, metadata remover, compress (light) |
| pdf.js 3.11.174 | pdf→jpg/png, pdf→text, compress (strong), page thumbnails |
| jsPDF 2.5.1 | image→pdf, text→pdf, compress (strong) |
| JSZip 3.10.1 | zipping multi-file outputs |
| @neslinesli93/qpdf-wasm 0.3.0 | protect pdf, remove pdf password |

## 7. What to tell me next

Once you've tested it live, let me know if anything breaks — especially
Protect PDF / Remove Password — and I'll fix it directly.
