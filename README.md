# CharacterBinder

> Create, embed, share — a local-first desktop tool for building and exporting AI roleplay character cards in the Tavern Card PNG format.

![CharacterBinder — Main Editor](docs/preview-v1.2.0.png)

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org) v18 or later
- [Rust](https://rustup.rs) — only needed for the Tauri desktop build

### Install & Run

```bash
git clone https://github.com/Fablestarexpanse/CharacterBinder.git
cd CharacterBinder
npm install
npm run dev
```

Opens at **[http://localhost:3737](http://localhost:3737)** in your browser. No Rust required for the web version.

### Desktop App (Tauri)

```bash
npm run tauri dev
```

### Production Build

```bash
# Web — outputs to dist/
npm run build

# Desktop installer
npm run tauri build
```

---

## What Is CharacterBinder?

CharacterBinder lets you build character cards compatible with **SillyTavern**, **JanitorAI**, **Chub.ai**, **Agnai**, **Venus AI**, **Backyard AI**, **RisuAI**, and generic platforms — all from a clean, focused editor.

Character data is embedded directly into a PNG image as hidden metadata (Base64-encoded JSON in a `tEXt` chunk). The resulting file looks like a normal image but carries the full character definition inside it, ready to be dropped into any compatible platform.

**Everything runs locally. No accounts. No cloud. No data leaves your machine.**

---

## Features

### Character Editor
- Fill in all Tavern Card v2 fields: name, description, personality, scenario, first message, example dialogs, system prompt, and more
- Live character image preview with drag-and-drop support
- Alternate greetings — add multiple opening messages
- Tags, creator fields, and character version support
- Copy / Paste buttons on every text field
- JSON View and Raw Preview tabs for direct inspection

### Token Counter *(v1.2)*
- Live per-field token counts using the **cl100k** tokenizer (GPT-4 standard — the most widely used reference)
- Total budget bar colour-coded: Lightweight / Moderate / Heavy / Very Large
- Expandable per-field breakdown in the export sidebar
- Warning shown when card exceeds 3,000 tokens

### Save as Template *(v1.2)*
- Save any card as a reusable template directly from the export panel
- Custom templates appear in the Templates page under "Your Templates"
- Delete custom templates anytime with the hover trash icon

### Card Library *(v1.1)*
- Save cards locally in your browser's IndexedDB — no files to manage
- Browse your collection in a thumbnail grid
- Search by name, platform, or tag
- Sort by last modified, created date, or name
- Click any card to reopen it in the editor
- Multi-select for bulk operations

### Archive & Export *(v1.1)*
- **Export ZIP** — download selected cards (or your entire library) as a single `.zip` file
- Each card exports as a `.png` (with embedded metadata) or `.json` (if no image)
- A `manifest.json` is included listing all cards, platforms, and timestamps
- Perfect for backing up your collection or moving it to another machine

### Multi-Platform Export
- Switch target platforms and see live field compatibility warnings before you export
- Automatic field mapping and renaming per platform
- PNG export or JSON export depending on platform support

### Tools
- **PNG Import** — load an existing Tavern Card PNG and edit it
- **PNG Decode** — inspect the raw embedded metadata of any Tavern Card PNG
- **Templates** — start from a pre-built character or a blank slate
- **Validate** — check your card against the Tavern Card v2 spec before exporting

---

## Supported Platforms

| Platform | PNG Export | JSON Export | Metadata Key |
|----------|-----------|-------------|--------------|
| SillyTavern | ✅ | ✅ | `chara` |
| JanitorAI | ✅ | ✅ | `chara` |
| Chub.ai | ✅ | ✅ | `chara` |
| Agnai | ❌ | ✅ | — |
| Venus AI | ✅ | ✅ | `chara` |
| Backyard AI | ❌ | ✅ | — |
| RisuAI | ✅ | ✅ | `chara` |
| Generic | ✅ | ✅ | `chara` |

Field compatibility is shown live in the editor when you switch target platforms.

---

## How PNG Embedding Works

1. Your character data is serialized as a JSON object following the **Tavern Card v2** spec
2. The JSON string is Base64-encoded (Unicode-safe)
3. A PNG `tEXt` chunk is inserted into the image with the keyword `chara` and the Base64 value
4. The resulting PNG is visually identical to the original but carries the character data invisibly

```
PNG Signature (8 bytes)
→ IHDR chunk
→ tEXt chunk: "chara" = Base64(JSON)   ← character data lives here
→ IDAT chunks (pixel data)
→ IEND chunk
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | [Tauri 2.x](https://tauri.app) (Rust) |
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS |
| Build tool | Vite |
| Local storage | IndexedDB via [idb](https://github.com/jakearchibald/idb) |
| ZIP export | [JSZip](https://stuk.github.io/jszip/) |
| PNG encoding | Pure JavaScript (no native deps) |
| Token counting | [gpt-tokenizer](https://github.com/niieani/gpt-tokenizer) (cl100k) |

---

## Project Structure

```
CharacterBinder/
├── src/
│   ├── components/       # UI components (editor, sidebar, library, modals)
│   ├── lib/
│   │   ├── pngMetadata/  # PNG tEXt chunk encoder/decoder
│   │   ├── platforms/    # Platform definitions + format converters
│   │   ├── validators/   # Card validation logic
│   │   ├── exporters/    # PNG/JSON download helpers
│   │   ├── library/      # IndexedDB card storage (idb)
│   │   ├── archive/      # ZIP export (jszip)
│   │   ├── tokenizer/    # Token counting (cl100k)
│   │   └── customTemplates/ # User-saved templates (localStorage)
│   ├── data/templates/   # Built-in character templates
│   ├── types/            # TypeScript type definitions
│   └── App.tsx           # Root component and app state
├── src-tauri/            # Tauri (Rust) desktop shell
├── public/               # Static assets (logo, etc.)
└── docs/                 # Screenshots and documentation assets
```

---

## Changelog

### v1.2.0
- Added **Token Counter** — live per-field token counts (cl100k / GPT-4 standard) with a total budget bar and breakdown panel
- Added **Save as Template** — save any card as a reusable template from the export panel
- Added **Copy / Paste buttons** on every text field — paste inserts at cursor position
- Removed character limits on all text fields

### v1.1.0
- Added **Card Library** — save, browse, search, and manage your characters locally
- Added **ZIP Archive** — export selected or all cards as a portable `.zip` with manifest
- White / light theme
- Wider sidebar with full logo display

### v1.0.0
- Initial release — character editor, multi-platform export, PNG encoding/decoding, templates

---

## License

MIT — free to use, modify, and distribute.

---

*CharacterBinder is an independent open-source project and is not affiliated with SillyTavern or any other platform.*
