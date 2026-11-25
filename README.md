# Bunny Binder

A cozy, pink PDF library and annotator. Runs entirely in the browser (static files, no server code).

## What you can do

- Add PDFs (button or drag and drop), search, favorite, rename, tag, delete
- Highlight text in 5 colors and attach comments to highlights
- Sticky notes (draggable), typed text, freehand pen, eraser
- Notes and comments panel that jumps to each mark
- Zoom, page jump, and keyboard shortcuts: V select, H highlight, N note, T text, P pen, E eraser

Your PDFs and annotations are saved in your browser (IndexedDB), on that device and browser only.
Clearing site data deletes them, and they do not sync between devices.
Use the same address each time, because browser storage is tied to the site address.
Fonts load from Google Fonts. Offline, it falls back to system fonts.
Scanned PDFs without a text layer can't be highlighted by text. Use the pen or sticky notes there.

## How to run

1. Install Python: `python3 -m http.server 8000` inside this folder, then open http://localhost:8000
2. Or open the `index.html` file directly in a modern browser
3. Drag and drop PDFs onto the page, or use the "Add PDFs" button

## Color guide

Highlights and notes come in 5 soft color pairs:
- Light pink / Deep magenta
- Light yellow / Gold orange
- Light green / Dark green
- Light blue / Dark blue
- Light purple / Dark purple

Select a color using the color picker toolbar before marking up your PDF.

## Keyboard shortcuts

| Key | Tool |
|-----|------|
| V   | Select |
| H   | Highlight |
| N   | Sticky note |
| T   | Type text |
| P   | Pen / Freehand draw |
| E   | Eraser |
