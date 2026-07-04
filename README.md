# Arabic DrillForge

Rapid Arabic vocabulary and conjugation drill for **MSA** (DLPT) and **Levantine** (Palestinian/Lebanese). Static single-page app — no build step, no backend.

## Quick Start (Local)

```bash
# Any simple HTTP server works. Examples:
python -m http.server 8080
# or: npx serve .
```

Open `http://localhost:8080` — do **not** open `index.html` directly (`file://` blocks JSON loading).

## Daily Usage

1. **Pick register** — MSA or Levantine (top toggle). Progress is tracked separately per register.
2. **Verbs / Nouns / Conjugation** — secondary tabs switch content.
3. **Browse** — search by English, Arabic, translit, or root. Filter by Known / Needs Work.
4. **Start Drill** — choose Flashcard, Multiple Choice, or Typing. Sessions prioritize weak items.
5. **After each answer** — see the other register (MSA ↔ Lev mapping).
6. **Conjugation tab** — full past/present tables + drill mode for random pronoun/tense.
7. **Stats panel** — today's count, accuracy, streak, mastery bars. Export progress as JSON.

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Space | Flip flashcard / continue after answer |
| Enter | Submit typing answer |
| 1–4 | Multiple choice options |

## Deploy to GitHub Pages

1. Create a new repo on GitHub (e.g. `arabic-drillforge`).
2. Upload all files (keep this structure):

```
arabic-drillforge/
├── index.html
├── styles.css
├── script.js
├── data/
│   ├── vocab.json
│   └── conjugations.json
└── README.md
```

3. **Settings → Pages → Source**: Deploy from branch `main`, folder `/ (root)`.
4. Wait ~1 min. Site URL: `https://<username>.github.io/arabic-drillforge/`

No build step required — push and it works.

## Editing Vocabulary

Edit `data/vocab.json`. Each item:

```json
{
  "id": "v001",
  "type": "verb",
  "english": "to go",
  "msa": {
    "form": "ذَهَبَ / يَذْهَبُ",
    "translit": "dhahaba / yadhhabu",
    "root": "ذ ه ب",
    "example": "ذهبت إلى السوق."
  },
  "lev": {
    "form": "راح / بروح",
    "translit": "raa7 / baroo7",
    "notes": "راح past, بروح present.",
    "example": "راح عالسوق."
  },
  "tags": ["motion", "daily"],
  "frequency_rank": 1
}
```

- `id` must be unique (`v###` verbs, `n###` nouns).
- `frequency_rank`: lower = higher frequency (used for display order).
- `_meta` block at top is documentation only — safe to edit.

After editing, commit and push. GitHub Pages redeploys automatically.

### Regenerating from script (optional)

`data/generate_vocab.py` built the starter set. To rebuild:

```bash
cd data && python generate_vocab.py
```

Then hand-edit `vocab.json` for accuracy — always verify Levantine forms.

## Adding Conjugations

Edit `data/conjugations.json`. Key tables by vocab `id` (e.g. `"v001"`). Each table needs `msa` and `lev` objects with `past` and `present` maps for pronouns: `ana`, `enta`, `enti`, `huwa`, `hiya`, `nihna`, `intu`, `hum`.

## Progress Backup

**Export Progress** (stats panel) saves `progress`, `stats`, and `settings` to JSON. Import on another device/browser via **Import Progress**.

**Hard Reset** wipes all localStorage data.

## Adding Audio Later

The TTS button uses browser `speechSynthesis`. For real audio:

1. Add MP3s under `assets/audio/` (e.g. `v001-msa.mp3`).
2. Add optional `"audio": { "msa": "assets/audio/v001-msa.mp3" }` to vocab entries.
3. Update `speakArabic()` in `script.js` to play files when present.

Levantine TTS quality varies by browser — recorded audio is better for production.

## Tech

- HTML5 + Tailwind CDN + vanilla JS
- Noto Sans Arabic (Google Fonts)
- localStorage for all state
- ~215 starter items (115 verbs, 100 nouns), 10 full conjugation tables

## License

Personal study use. Verify dialect forms with native speakers for mission-critical prep.