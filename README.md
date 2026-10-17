# Stratagem Legend

A Helldivers 2 stratagem trainer in plain HTML, CSS and JavaScript — no build
step, no dependencies.

**Play:** https://gonzooo7.github.io/stratagemlegend/

## Pages

- **Game** (`index.html`): you get an arrow code; find its stratagem on the
  wheel. Click a folder to open it, the centre to go back, a stratagem to
  answer. A wrong pick greys out that branch and costs a miss; REVEAL outlines
  the way to the answer. Mouse wheel zooms, drag pans.
- **Viewer** (`tree.html`): the same wheel as a reference — hover for names and
  codes, click a stratagem to dive into it.
- **Gambling** (`gamble.html`): spin 1–16 random stratagems. Choose what is in
  the pool (the whole stratagem tree, down to single stratagems, plus elements
  and types like fire or explosives) and set limits such as "exactly one
  backpack".

## Run locally

The pages load their data with `fetch`, so they need a web server rather than
opening the files directly:

```sh
npm start        # = python3 -m http.server 8080
```

Then open http://localhost:8080.

## Data

All in `assets/data/`:

- `stratagemList.json`: every stratagem with its name and arrow code
- `stratagemTree.json`: the category tree the wheel and the gambling pool are
  built from
- `iconMap.json`: stratagem id → icon file
- `gambleRules.json`: the gambling page's limits, elements/types, and which
  stratagems are never dealt

Icons are 19×19 PNGs in `assets/icons/`: one per stratagem in `stratagems/`,
one per folder in `categories/` (named `<parent>_<folder>.png`).

## Credits

Helldivers 2 and its stratagems belong to Arrowhead Game Studios and Sony
Interactive Entertainment. This is an unofficial fan project.
