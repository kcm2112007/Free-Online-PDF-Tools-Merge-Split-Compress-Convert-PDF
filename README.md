# PDF Tools

A free, privacy-first PDF utility website with 20 tools — merge, split,
compress, convert, secure, and clean up PDF files, all running in your
browser. Built as a single-page app (one `index.html`, one `style.css`, one
`script.js`) so it deploys anywhere, including GitHub Pages, with zero build
step.

## Live structure

This is a **hash-routed single-page app**. There is one real URL
(`index.html`); every tool, plus the About and Contact pages, live at a hash
route: `#/merge-pdf`, `#/compress-pdf`, `#/about`, `#/contact`, and so on.
Bookmarking or sharing a link like `yoursite.com/#/protect-pdf` opens that
tool directly.

## Features

- 20 working PDF tools, all listed below
- Drag-and-drop and tap-to-browse file selection on every tool
- File validation (type, size, corruption checks) with clear error messages
- Progress indicators, success/error states, and a working reset ("Clear")
  on every tool
- Page-thumbnail previews with select / reorder / rotate controls for the
  four page-management tools
- Client-side processing for every tool — nothing is uploaded to a server
- Mobile-first responsive design, tested from 320px up
- Search box on the home screen to filter all 20 tools instantly
- About and Contact pages with real creator information

## All 20 tools

| # | Tool | What it does |
|---|---|---|
| 1 | Image to PDF | Combine JPG/PNG/WebP images into one PDF |
| 2 | PDF to JPG | Export PDF pages as JPG images (ZIP for multi-page) |
| 3 | PDF to PNG | Export PDF pages as lossless PNG images |
| 4 | Merge PDF | Combine multiple PDFs into one, in your chosen order |
| 5 | Split PDF | Split by page ranges, every N pages, or one file per page |
| 6 | Compress PDF | Light mode (keep text selectable) or Strong mode (rasterize for max savings) |
| 7 | Delete PDF Pages | Remove selected pages via visual thumbnails |
| 8 | Rearrange PDF Pages | Reorder pages with move up/down controls |
| 9 | Rotate PDF Pages | Rotate individual pages 90°/180°/270° |
| 10 | PDF to Word | Extract PDF text into a downloadable .docx |
| 11 | Word to PDF | Convert a .docx file into a PDF |
| 12 | Add Watermark to PDF | Text watermark with size, angle, color, opacity, tiling |
| 13 | Protect PDF with Password | Encrypt a PDF (WebAssembly qpdf) |
| 14 | Remove PDF Password | Decrypt a PDF you know the password for |
| 15 | PDF Page Numbering | Add page numbers in 6 positions, 3 formats |
| 16 | Extract PDF Pages | Save selected pages as a new PDF |
| 17 | PDF to Text | Extract selectable text to a .txt file |
| 18 | Text to PDF | Paste or upload text, get a paginated PDF |
| 19 | PDF OCR / Image to Text | On-device OCR for scanned PDFs or photos |
| 20 | PDF Metadata Remover | View and clear title/author/producer/etc. |

## Technology

- HTML, CSS, vanilla JavaScript — no React, no build step, no Node.js required
- Hash-based client-side routing (`location.hash` + `innerHTML`, no framework)
- All PDF/document/OCR libraries loaded from CDN, and only when a tool that
  needs them is opened

## Libraries used (via CDN, loaded on demand)

| Library | Version | Used by |
|---|---|---|
| [pdf-lib](https://pdf-lib.js.org/) | 1.17.1 | Merge, split, page management, watermark, page numbering, metadata remover, compress (light) |
| [pdf.js](https://mozilla.github.io/pdf.js/) | 3.11.174 | PDF→JPG/PNG, PDF→text, PDF→Word, compress (strong), page thumbnails, OCR page rendering |
| [jsPDF](https://github.com/parallax/jsPDF) | 2.5.1 | Image→PDF, text→PDF, compress (strong), Word→PDF |
| [JSZip](https://stuk.github.io/jszip/) | 3.10.1 | ZIP packaging, .docx file construction |
| [@neslinesli93/qpdf-wasm](https://github.com/neslinesli93/qpdf-wasm) | 0.3.0 | Protect PDF, Remove PDF Password |
| [mammoth.js](https://github.com/mwilliamson/mammoth.js) | 1.7.2 | Word→PDF (docx → HTML conversion) |
| [html2canvas](https://html2canvas.hertzen.com/) | 1.4.1 | Word→PDF (HTML → PDF rendering, used internally by jsPDF) |
| [Tesseract.js](https://tesseract.projectnaptha.com/) | 5.1.0 | PDF OCR / Image to Text |

## How the tools work (client-side processing explained)

Every tool runs in your browser tab using JavaScript and, for two tools,
WebAssembly:

- **Merge, split, delete/rotate/rearrange/extract pages, watermark, page
  numbering, metadata removal, compress (light)** — all use **pdf-lib**,
  which reads and rewrites the PDF's internal structure directly in memory.
- **PDF→JPG/PNG, PDF→text, page thumbnails, compress (strong)** — use
  **pdf.js**, the same engine Firefox uses to display PDFs, to render pages
  onto an HTML `<canvas>`.
- **Image→PDF, text→PDF** — use **jsPDF** to place images or laid-out text
  directly onto new PDF pages.
- **Protect PDF / Remove PDF Password** — use a **WebAssembly build of
  qpdf**, a real PDF encryption engine, compiled to run inside the browser.
  This is the most complex tool here and depends on a smaller, less
  widely-used WASM package; test it after deploying.
- **PDF to Word** — extracts text via pdf.js and writes it into a valid,
  minimal `.docx` file (built directly as a zip of OOXML XML using JSZip).
  **This is text extraction, not a layout-preserving conversion** — fonts,
  images, tables, and exact positioning from the original PDF are not
  preserved. The tool says this plainly after each conversion.
- **Word to PDF** — uses **mammoth.js** to convert the `.docx` into HTML,
  then **jsPDF + html2canvas** to render that HTML into a PDF. Headings,
  paragraphs, bold/italic, and lists convert well; complex tables, embedded
  objects, and pixel-precise layout may not match the original exactly.
- **PDF OCR / Image to Text** — renders each page (or the uploaded image) to
  a canvas, then runs **Tesseract.js**, a WebAssembly OCR engine, entirely
  on-device. English only in this build; accuracy depends on image clarity
  and can take 10–60+ seconds per page on a phone.

None of the above uploads your file anywhere. Object URLs created for
previews and downloads are revoked after use to free memory.

## Project structure

```
index.html   ← shell page, header/nav, footer, #app mount point
style.css    ← full design system (navy/electric-blue, glass surfaces)
script.js    ← shared utilities, page-thumbnail manager, all 20 tools'
               logic, the About/Contact views, and the hash router
```

Everything is self-contained in these three files — no build step, no
package.json, no node_modules.

## How to run locally

No server or build tools required. Either:
- Open `index.html` directly in a browser, or
- Serve the folder with any static server, e.g. `python3 -m http.server`
  then visit `http://localhost:8000/`

(A local static server avoids occasional `file://` restrictions some
browsers apply to `fetch`/dynamic `import`, so it's the more reliable option
for testing Protect PDF / Remove PDF Password, which use dynamic imports.)

## How to deploy on GitHub Pages

1. Upload `index.html`, `style.css`, and `script.js` to your repository (repo
   root, or a subfolder if you're combining this with other tool sections).
2. In repo Settings → Pages, set the source to the branch/folder containing
   these files.
3. That's it — no build step. Your site will be live at
   `https://<username>.github.io/<repo>/`.

## Browser compatibility

Tested against modern evergreen browsers: Chrome, Edge, Firefox, Safari, and
Android Chrome. Requires a browser with WebAssembly support (all of the
above) for Protect PDF, Remove PDF Password, and PDF OCR. Dynamic `import()`
is used for the two password tools and is supported in all current major
browsers.

## Known genuine limitations

Stated honestly, not hidden:

- **PDF to Word** produces a text-only `.docx` — no original layout, images,
  or tables.
- **Word to PDF** handles standard formatting well; complex tables, embedded
  objects, and exact pagination may not match the source document precisely,
  since this uses in-browser HTML rendering rather than a native Word engine.
- **PDF OCR** is English-only in this build, and speed/accuracy depend on
  your device and the clarity of the scanned image.
- **Compress PDF (Strong mode)** rasterizes pages to JPEG to shrink file
  size, which means the output PDF's text is no longer selectable. Light
  mode keeps text selectable but saves less space.
- **Protect PDF / Remove PDF Password** depend on a smaller WebAssembly
  library (`@neslinesli93/qpdf-wasm`); these are the tools most worth
  testing first after deployment.
- **PDF Metadata Remover** clears standard metadata fields but does not
  guarantee removal of an embedded XMP metadata packet some PDFs carry.
- This is a single-page app with one URL, so individual tools don't have
  separate SEO-indexable pages, canonical URLs, or per-tool structured data —
  the tradeoff made in exchange for a simple, easy-to-upload 3-file project.

## SEO implementation

Because this is intentionally a single-file app, SEO is implemented at the
level a one-URL site can support honestly:

- Unique `document.title` set per route (home, each tool, About, Contact) as
  the hash changes, so browser tab titles and browser history reflect the
  current view
- Descriptive `<meta name="description">` on the shell page
- `WebSite` JSON-LD on the shell page
- Semantic HTML (`<header>`, `<main>`, `<footer>`, one `<h1>` per view)
- Internal linking: home grid → every tool, footer → About/Contact/popular
  tools, tool pages → back to home

If you need per-tool search visibility (ranking separately for "merge pdf
online", "compress pdf", etc.), that requires separate URLs per tool, which
this single-file architecture trades away by design. A multi-page version
with full per-tool SEO (unique canonical URLs, breadcrumbs, FAQ/HowTo
structured data, sitemap) was built earlier in this project's history and
can be provided again if you want both versions side by side.

## Privacy

Every one of the 20 tools processes files on your device. The wording used
throughout the site — "Your files are processed locally in your browser
whenever possible" — is accurate for all 20 tools here, since even the two
WebAssembly-based tools (Protect PDF, Remove PDF Password) never transmit
your file or password anywhere. No uploaded documents are stored. Object
URLs are revoked after downloads to release memory.

## Credits

Created by **Kalicharan Murmu**.

- Instagram: [instagram.com/kcm_0_7](https://www.instagram.com/kcm_0_7)
- Facebook: [facebook.com/share/1HnbKXyqSZ](https://www.facebook.com/share/1HnbKXyqSZ/)
- Website: [kcm2112007.github.io/KalicharanMurmu-](https://kcm2112007.github.io/KalicharanMurmu-/)
