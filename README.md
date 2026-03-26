# ChessReviewMate

A Chrome extension that provides a structured chess game review sidebar on [Lichess Study](https://lichess.org/study) pages. Follow a step-by-step review flow, mark critical positions, categorize mistakes, write notes, and produce a game summary — all saved as PGN comments that export with your study.

## Features

- **5-step review flow**: Opening → Critical Position → Mistake Tagging → Notes → Summary
- **Mark critical positions**: Tag key moments with one click
- **Mistake categorization**: 9 types including Blunder, Tactical Miss, Calculation Error, etc.
- **Per-move notes**: Write free-form analysis for any position
- **Structured game summary**: Opening, Middlegame, Endgame, Biggest Mistake, Lesson Learned
- **PGN comment storage**: Review data is saved as structured comments in the Lichess Study — exports with the PGN
- **Collapsible sidebar**: Stays out of your way when you don't need it

## Prerequisites

- Node.js 18+
- npm

## Setup

```bash
npm install
```

## Build

```bash
npm run build
```

This bundles `src/content.ts` into `dist/content.js` (single IIFE) and copies `src/styles.css` to `dist/styles.css`.

## Install in Chrome

1. Run `npm run build`
2. Open `chrome://extensions/`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked**
5. Select the project root folder (the one containing `manifest.json`)
6. Navigate to any Lichess Study page (`https://lichess.org/study/...`) — the sidebar appears on the right

After code changes, run `npm run build` again and click the refresh icon on the extension card in `chrome://extensions/`.

## Tests

```bash
npm test
```

168 tests across 5 test files covering:
- ReviewSessionManager (pure data logic)
- PGN comment serialization/deserialization
- Lichess DOM interaction
- MoveObserver
- SidebarUI rendering

## Project Structure

```
├── manifest.json          # Chrome Manifest V3
├── src/
│   ├── types/index.ts     # TypeScript type definitions
│   ├── review-session.ts  # Pure data logic (create, tag, note, summary)
│   ├── pgn-comment-storage.ts  # CRM marker encode/decode + serialization
│   ├── lichess-dom.ts     # DOM read/write for Lichess Study comments
│   ├── move-observer.ts   # MutationObserver-based move detection
│   ├── sidebar-ui.ts      # Sidebar UI rendering
│   ├── styles.css         # Scoped sidebar styles
│   └── content.ts         # Content script controller (entry point)
├── tests/                 # Unit tests (Vitest + fast-check)
└── dist/                  # Build output (loaded by Chrome)
```

## How It Works

Review data is stored as `{CRM: <json>}` markers inside Lichess Study PGN comments. Per-move data (critical positions, mistakes, notes) goes on the corresponding move's comment. Session metadata and summary go on move 1. Non-CRM comments are preserved — the extension coexists with your own annotations.

## License

MIT
