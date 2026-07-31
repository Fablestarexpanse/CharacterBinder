# CharacterBinder

> Create, embed, share — a local-first tool for building and exporting AI roleplay character cards in the Tavern Card PNG format. Runs entirely in your browser.

![CharacterBinder — Main Editor](docs/preview-v1.6.0.png)

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org) v18 or later — that's the whole list

### Install & Run — no terminal needed

Download or clone the repo, then:

- **Windows** — double-click **`start.bat`**
- **macOS / Linux** — run **`./start.sh`**

The script checks that Node.js is present and new enough, installs dependencies
on first run, starts the server, and opens your browser. If CharacterBinder is
already running it just opens the tab instead of starting a second copy. If
Node.js is missing it tells you where to get it rather than showing a stack
trace.

Keep the window open while you work; closing it stops the app.

### Install & Run — from a terminal

```bash
git clone https://github.com/Fablestarexpanse/CharacterBinder.git
cd CharacterBinder
npm install
npm start
```

Opens at **[http://localhost:3737](http://localhost:3737)** in your browser.

(`npm start` opens the browser for you; `npm run dev` is the same thing without that.)

### Production Build

```bash
npm run build
```

Outputs a static site to `dist/`. It has no server component, so it can be
opened from any static host — GitHub Pages, Netlify, or a folder behind nginx.

### Deploying to GitHub Pages

A workflow is included at `.github/workflows/deploy.yml`. It runs the tests,
builds with the right subpath, and publishes.

It is **manual only** — nothing deploys until you ask it to:

1. In the repo, go to **Settings → Pages** and set *Source* to **GitHub Actions**
2. Go to **Actions → Deploy to GitHub Pages → Run workflow**

Hosting under a subpath is handled by the `BASE_PATH` environment variable, which
the workflow sets to `/<repo-name>/`. Local builds leave it unset and stay at `/`.

### Running the tests

```bash
npm test
```

---

## What Is CharacterBinder?

CharacterBinder lets you build character cards compatible with **SillyTavern**, **JanitorAI**, **Chub.ai**, **Agnai**, **Venus AI**, **Backyard AI**, **RisuAI**, and generic platforms — all from a clean, focused editor.

Character data is embedded directly into a PNG image as hidden metadata (Base64-encoded JSON in a `tEXt` chunk). The resulting file looks like a normal image but carries the full character definition inside it, ready to be dropped into any compatible platform.

**Everything runs locally. No accounts. No cloud. No data leaves your machine.**

*Two asterisks, both opt-in and both off by default: the Quick Import AI sorter
downloads a model file from Hugging Face the first time you use it (your text is
not sent — the model comes to you), and you can deliberately point that sorter at
a remote API instead, which does send your text and warns you before it will.*

---

## Features

The sidebar splits into three groups — **Card Types** to make things, **Collection**
to keep them, and **Tools** for everything else. Each section is covered below.

---

### Character Editor

![Character Editor](docs/section-character.png)

The main editor. Every Tavern Card v2 field is here — description, personality,
scenario, first message, example dialogs, and the advanced block (system prompt,
post-history instructions, alternate greetings, lorebook).

**Quick Import** sits at the top — paste an unsorted card and it fills the fields
for you (see below).

The right rail stays live as you type: card preview, embedded data size, a token
counter with per-field breakdown, and validation. Pick a target platform and it
tells you which of your fields that platform will drop or rename *before* you
export. **JSON View** and **Raw Preview** tabs show exactly what will be written.

---

### Lorebook Editor

![Lorebook Editor](docs/section-lorebook.png)

Builds SillyTavern-compatible world info books. Entries live in a list on the
left; each one gets trigger keys, content, and an internal note.

Per-entry controls cover **enabled**, **constant** (always inject), **selective**
(require a second key), and **case sensitive**, plus position, insertion order,
and priority. Existing SillyTavern lorebook JSON can be dragged straight in.

---

### Script Card Editor

![Script Card Editor](docs/section-script.png)

Packages JavaScript snippets or system prompts as portable cards. The code
editor has line numbers, syntax colouring, and Tab support.

Exports as JSON, or embeds into a PNG using the `script` chunk so a script can
be shared as a single image like any other card.

---

### Scenario Card Editor

![Scenario Card Editor](docs/section-scenario.png)

A standalone situation that can be dropped into any conversation, independent of
which character you're talking to. Scenario text, an opening message, an optional
scene image, and the usual creator/version/notes fields.

---

### Persona Card Editor

![Persona Card Editor](docs/section-persona.png)

Defines who *you* are in the conversation — the `{{user}}` identity. Name,
description, personality, appearance, background, and an avatar.

Above the fields sits **Quick Import**, which is the fastest way to fill this in.

---

### Quick Import — paste anything, get sorted fields

![Quick Import splitting a pasted persona into fields](docs/preview-quick-import-v1.5.0.png)

Available in both the **Character** and **Persona** editors.

Cards collected from JanitorAI and elsewhere rarely arrive neatly split into
fields. Quick Import takes one blob of text in whatever shape you have it and
proposes a field-by-field split, which you review and adjust before anything is
applied.

It targets whichever card you're editing: a persona gets appearance and
background, a character card gets scenario, first message, and example dialogue
instead — and any appearance or backstory it finds gets folded into the
character's description with its heading kept, rather than dropped.

It picks its own approach based on what you paste:

| Your text | What happens |
|-----------|--------------|
| Section headings — `Appearance:`, `## Personality`, or a bare `Background` line | Split on those headings, instantly, **word-for-word** |
| A JSON card export (including Tavern V2 `data` nesting) | Mapped by key |
| W++ — `Personality("aloof" + "witty")` | Parsed as an attribute list |
| Shapeless prose with no structure at all | Read by a local AI model that can split one sentence across three fields |

**Nothing is ever lost.** Sections it doesn't recognise — `Age`, `Gender`,
`Likes` — are kept in Description with their labels intact. Several sections
that belong to one field (`Habits`, `Interests`, `Strengths`, `Flaws` all being
personality) are merged with their original labels preserved, so the result
stays readable.

Before applying you get a checkbox per field to drop anything it got wrong, and
a Replace / Keep-and-append choice for fields you've already filled in.

#### The AI sorter

Only used when your text has no structure to work from, because for structured
text the parser is both faster and more faithful.

The model runs **in your browser on your GPU via WebGPU** — your persona text is
never sent anywhere. It downloads once from Hugging Face (Llama 3.2 3B by
default, about 2.2 GB) and is cached, so it works offline afterwards. A typical
sort takes ~2 seconds once loaded. Output is constrained to a JSON schema during
decoding, so the model cannot return malformed or off-schema results.

The `AI` light next to **Ready** in the sidebar shows whether the model is
currently loaded, and clicking it loads or frees it — worth knowing, since a
resident model holds a couple of GB of VRAM. Under the gear icon you can pick a
smaller model (down to 376 MB), or point the sorter at any OpenAI-compatible
server instead — Ollama, LM Studio, KoboldCpp, TabbyAPI. Non-local addresses
require an explicit acknowledgement first, since that is the one path where your
text leaves the machine.

---

### Library

![Library](docs/section-library.png)

Everything you save lives here, in your browser's IndexedDB — no files to manage.
Cards are grouped by type and tagged with their version.

Search by name, type, or tag; sort by modified, created, or name; click any tag
on a card to filter by it. Multi-select supports bulk delete and bulk export, and
**Archive All** drops your whole collection into a single `.zip` with a
`manifest.json` — the easiest way to back up or move to another machine.

**Version control:** change a card's version number before saving and you get a
*new* library entry instead of overwriting the old one, so previous versions stay
side by side. Works across all five card types.

---

### Templates

![Templates](docs/section-templates.png)

Start from a built-in character instead of a blank editor. Anything you build can
be saved here too, via **Save as Template** in the character export panel.

---

### Import PNG

![Import PNG](docs/section-import-png.png)

Drop in any card PNG and it opens in the right editor automatically. It detects
all five card types by their metadata chunk, so a lorebook PNG lands in the
Lorebook editor and a persona lands in the Persona editor without being told.

---

### Decode PNG

![Decode PNG](docs/section-decode-png.png)

The inspector. Shows every `tEXt` chunk in a card PNG and the decoded JSON behind
it — useful for checking what a card you downloaded actually contains, or for
confirming your own export came out right.

---

### Settings

![Settings](docs/section-settings.png)

App preferences: validate before exporting, pretty-print JSON, and whether to
preserve unknown PNG chunks when re-encoding an existing image.

---

### Help / About

![Help / About](docs/section-help.png)

A short primer on what Tavern Card PNGs are and how the embedding works, plus the
current version.

---

## Supported Platforms

**PNG and JSON export are always available for every platform.** The table below
is about what each *site* can import, not about what CharacterBinder will let you
save — if a platform can't read PNG cards, you still get the PNG, along with a
warning telling you to upload the JSON to that particular site.

| Platform | Reads PNG cards | Reads JSON | Metadata Key |
|----------|-----------------|------------|--------------|
| SillyTavern | ✅ | ✅ | `chara` |
| JanitorAI | ❌ JSON only | ✅ | `chara` |
| Chub.ai | ✅ | ✅ | `chara` |
| Agnai | ❌ JSON only | ✅ | `chara` |
| Venus AI | ✅ | ✅ | `chara` |
| Backyard AI | ❌ JSON only | ✅ | `chara` |
| RisuAI | ✅ | ✅ | `chara` |
| Generic | ✅ | ✅ | `character` |

A PNG exported while targeting a JSON-only platform is still a complete, valid
card — the data is embedded in a `chara` chunk exactly as it would be anywhere
else, so it imports fine into SillyTavern, Chub, RisuAI, or back into
CharacterBinder. It's a convenient way to archive or share the card as a single
image even when the destination site needs the JSON.

Field compatibility is shown live in the editor when you switch target platforms.

---

## PNG Metadata Keys

Each card type uses a dedicated `tEXt` chunk keyword so apps can identify the content:

| Card Type | Metadata Key |
|-----------|-------------|
| Character Card | `chara` |
| Lorebook | `lorebook` |
| Script Card | `script` |
| Scenario Card | `scenario` |
| Persona | `persona` |

Character cards exported with the **Generic / Other** platform selected use
`character` instead of `chara`. On import, CharacterBinder reads `chara`,
`character`, `tavern`, and `tavern_card_v2` for character cards, so files from
other tools are picked up regardless of which of those they used.

---

## How PNG Embedding Works

1. Your card data is serialized as a JSON object
2. The JSON string is Base64-encoded (Unicode-safe)
3. A PNG `tEXt` chunk is inserted into the image with the appropriate keyword
4. The resulting PNG is visually identical to the original but carries the full card data invisibly

```
PNG Signature (8 bytes)
→ IHDR chunk
→ tEXt chunk: "chara" = Base64(JSON)   ← card data lives here
→ IDAT chunks (pixel data)
→ IEND chunk
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | The browser — no server, no native shell |
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS |
| Build tool | Vite |
| Local storage | IndexedDB via [idb](https://github.com/jakearchibald/idb) |
| ZIP export | [JSZip](https://stuk.github.io/jszip/) |
| PNG encoding | Pure JavaScript (no native deps) |
| Token counting | [gpt-tokenizer](https://github.com/niieani/gpt-tokenizer) (cl100k) |
| In-browser AI | [WebLLM](https://github.com/mlc-ai/web-llm) on WebGPU (lazy-loaded, optional) |

---

## Project Structure

```
CharacterBinder/
├── src/
│   ├── components/          # UI components (editors, sidebar, library, modals)
│   ├── hooks/               # Shared React hooks (status messages, AI engine state)
│   ├── lib/
│   │   ├── pngMetadata/     # PNG tEXt chunk encoder/decoder
│   │   ├── platforms/       # Platform definitions + format converters
│   │   ├── validators/      # Card validation logic
│   │   ├── library/         # IndexedDB card storage (idb)
│   │   ├── archive/         # ZIP export (jszip)
│   │   ├── tokenizer/       # Token counting (cl100k)
│   │   ├── personaParser/   # Quick Import: labelled / JSON / W++ / prose parsing
│   │   ├── personaLlm/      # Quick Import: in-browser AI sorter (WebLLM) + settings
│   │   ├── customTemplates/ # User-saved templates (localStorage)
│   │   ├── carrierImage.ts  # Cover art → PNG bytes for embedding
│   │   ├── download.ts      # Blob download helper (all export paths)
│   │   ├── settings.ts      # App settings + localStorage persistence
│   │   ├── tavernCard.ts    # Blank Tavern Card v2 factory
│   │   ├── minimalPng.ts    # 1×1 fallback carrier image
│   │   └── readImageFile.ts # Image file → data URL helper
│   ├── data/templates/      # Built-in character templates
│   ├── types/               # TypeScript type definitions
│   ├── index.css            # Tailwind layers + shared component classes
│   ├── vite-env.d.ts        # Vite + injected-constant type declarations
│   ├── main.tsx             # React entry point
│   └── App.tsx              # Root component and app state
├── public/                  # Static assets (logo, etc.)
├── docs/                    # Screenshots and documentation assets
└── start.bat / start.sh     # One-click launch
```

---

## Changelog

### v1.6.1
- **Quick Import now works in the Character editor**, not just Persona. It targets
  whichever card you're editing — a character gets scenario, first message, and
  example dialogue, and any appearance or backstory the parser finds is folded
  into description with its heading kept rather than dropped
- **Fixed: example dialogue was being shredded.** `{{char}}:` normalises to
  "char", which is a Name alias, so every line of an example exchange opened a new
  Name section. Dialogue speakers are now excluded from heading detection
- **Fixed: trigger keys and tags updated only on blur**, so the lorebook entry list
  showed "No keys" while you were still typing them. Tags now report on every
  keystroke, and a half-typed trailing comma still survives
- **Fixed: the favicon 404'd.** `index.html` still pointed at `/vite.svg` from the
  project scaffold; it now uses the actual logo, via a relative path so it also
  works when hosted under a subpath
- Import PNG and Decode PNG no longer omit personas from their list of detected
  card types
- **Added a test suite** — 23 cases covering the parser across all four input
  formats, the character mapping, and the regressions above. `npm test`
- **Added a GitHub Pages workflow** (manual trigger) plus `BASE_PATH` support for
  subpath hosting

### v1.6.0
- **Removed the Tauri desktop shell.** CharacterBinder is now browser-only. The
  shell had accumulated no purpose: the frontend imported no Tauri APIs, and the
  three Rust commands it exposed (`read_file_bytes`, `write_file_bytes`,
  `get_file_size`) were never called from the UI, as were the `dialog`, `fs`, and
  `shell` plugins. It produced a window around the same static site the browser
  already ran.
- **Rust is no longer a prerequisite for anything.** Node.js 18+ is the entire
  toolchain. `src-tauri/` and the four `@tauri-apps` packages are gone, along with
  the `tauri`, `tauri:dev`, and `tauri:build` scripts and the `start-desktop`
  launchers.
- Removing the shell also settles a compatibility question the in-browser AI
  sorter had raised: Tauri renders in the OS webview, where WebGPU is reliable on
  Windows but only lands on macOS 15+ and is largely unavailable on Linux. In a
  real browser it works consistently everywhere.

### v1.5.0

**Quick Import (Persona editor)**
- Paste one unsorted block of text and it is split into name, description, personality, appearance, background, and tags, with a reviewable preview before anything is applied
- Handles labelled sections (including bare headings and `⸻` dividers), markdown headings, W++ attribute lists, and JSON card exports; unrecognised sections are preserved in Description rather than dropped
- Added an **in-browser AI sorter** for text with no structure at all — runs on WebGPU via [WebLLM](https://github.com/mlc-ai/web-llm), so persona text never leaves the machine; schema-constrained decoding guarantees well-formed output
- Sorting picks its own engine: structured text goes through the parser (instant, wording preserved exactly), and only shapeless prose reaches the model
- Optional OpenAI-compatible endpoint (Ollama, LM Studio, KoboldCpp) as an alternative to the in-browser model, with an explicit warning before any non-local address is used
- A sidebar light shows whether the model is resident and toggles it, since it holds ~2 GB of VRAM

**Fixes**
- **Desktop app now launches** — `tauri.conf.json` pointed the webview at port 1420 while Vite serves 3737, so `npm run tauri dev` opened an empty window
- **PNG export is no longer blocked** for platforms that can't import PNG cards (JanitorAI, Agnai, Backyard AI) — the button always works and an inline warning explains that the site needs the JSON, instead of the export being greyed out
- Corrected the platform table: JanitorAI was documented as supporting PNG import, which it does not
- **JPEG/WebP cover art no longer breaks PNG export** in the Lorebook, Script, Scenario, and Persona editors — non-PNG images are re-encoded through a canvas first, and export errors now say what went wrong instead of a bare "PNG export failed"
- **Custom output filenames stick** — typing a filename then editing the card name no longer discards it
- **Removed the leftover native resize grip** on textareas; the purple drag handle added in v1.4.0 was sitting on top of it, and the two wrote conflicting heights. The handle is now keyboard-accessible (arrow keys) and works with touch and pen input
- **Status text is legible** — errors, warnings, and success messages were still using dark-theme colours on the light UI (warnings measured 1.4:1 contrast). All status colours now clear WCAG AA
- Platform compatibility warnings count only fields the card actually uses, instead of the platform's entire theoretical loss list
- Library deletes — single and bulk — now ask for confirmation
- ZIP archives disambiguate same-named cards instead of silently overwriting them
- Downloads attach their anchor to the document and revoke the object URL on a later tick, so large exports don't get cancelled mid-flight
- The "save as a new version" baseline now follows the card you have open, instead of keeping the previously-loaded card's version

**Performance**
- Token counts and card validation are memoized. Previously a single keystroke ran roughly seventeen full BPE encodes on the main thread

**Install & launch**
- Added one-click `start` / `start-desktop` scripts for Windows, macOS, and Linux that check prerequisites, install dependencies on first run, and detect an already-running server instead of failing on a port clash
- Added `npm start` (dev server + opens browser), plus `tauri:dev` / `tauri:build` scripts and a `node >=18` engines constraint
- Added `.gitattributes` pinning `*.sh` to LF — without it a Windows checkout produced CRLF shebangs that fail on macOS/Linux with `bad interpreter`
- The version shown in the sidebar and Help / About is now injected from `package.json` at build time instead of being hardcoded in two components, where it had already drifted a release behind

**Documentation**
- The README now walks through every section of the app — the five editors, Library, Templates, Import PNG, Decode PNG, Settings, and Help — each with a short description and a screenshot
- Refreshed the header screenshot; the previous one was named for v1.4.0 but had actually been captured at v1.3.0

**Cleanup**
- Removed `lib/exporters` and `lib/cardFormats` — both were superseded by `lib/platforms` and entirely unreachable, along with `detectCardFormat`, `autoParseCard`, `uint8ArrayToBase64`, `getCard`, `getCardCount`, and `getConversionLosses`
- Removed the **Default Export Format** and **Default Metadata Key** settings — nothing read either one; the target platform determines both
- `TextAreaField` now composes `ResizableTextArea` instead of duplicating its resize logic; blob downloads, the carrier-image conversion, the status banner, and the app defaults each live in one place now
- Dropped the unused `puppeteer` dev dependency

### v1.4.0
- Added **Persona Card Editor** — define a user persona (`{{user}}` identity) with name, description, personality, appearance, background, avatar image, and PNG/JSON export
- All card types now include **Creator / Author**, **Version**, and **Creator Notes** fields
- **Version-as-new-record** — changing a card's version and saving to library creates a new entry instead of overwriting, preserving all previous versions
- **Library version badges** — each card tile now shows its version number
- **Clickable tag search** — click any tag on a library card to filter by it instantly
- **Auto-filename sync** — output filename updates live as you type the card name across all editors
- **Import PNG** and **Decode PNG** now detect and load all card types (lorebook, script, scenario, persona)
- Removed sidebar token counts from Script and Lorebook editors (cleaner export panel)
- Starts blank by default — no pre-loaded example character

### v1.3.0
- Added **Lorebook Editor** — build SillyTavern-compatible world info books with keyword-triggered entries, priority/insertion order controls, and JSON export
- Added **Script Card Editor** — package system prompts and instruction sets as portable cards (JSON + optional PNG embed)
- Added **Scenario Card Editor** — create standalone scenario cards with optional scene image, opening message, and JSON + PNG export
- Multi-type support in Import PNG and Decode PNG
- Navigation sidebar reorganised into grouped sections: Card Types, Collection, Tools

### v1.2.0
- Added **Token Counter** — live per-field token counts (cl100k / GPT-4 standard) with a total budget bar and breakdown panel
- Added **Save as Template** — save any card as a reusable template from the export panel
- Added **Copy / Paste buttons** on every text field — paste inserts at cursor position
- Removed character limits on all text fields

### v1.1.0
- Added **Card Library** — save, browse, search, and manage your cards locally
- Added **ZIP Archive** — export selected or all cards as a portable `.zip` with manifest
- Multi-select bulk operations

### v1.0.0
- Initial release — character editor, multi-platform export, PNG encoding/decoding, templates

---

## License

MIT — free to use, modify, and distribute.

---

*CharacterBinder is an independent open-source project and is not affiliated with SillyTavern or any other platform.*
