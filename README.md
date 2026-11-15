# hunt. — iPhone deal scanner

Minimalistička desktop aplikacija za lov iPhone oglasa, procenu popravke i profit.

## Pokretanje (faza 0 — UI + mock podaci)

```bash
cd iphone-hunter
npm install
npm run dev
```

Otvori `http://localhost:5173`.

Prečice: `1`–`5`, `,` za navigaciju, `⌘K` / `Ctrl+K` za komandnu paletu, `j`/`k` u tabeli.

## Faze

- **0 (završeno)** — shell, dizajn, svi ekrani, mock podaci.
- **1** — KupujemProdajem adapter, SQLite + FTS5, sačuvane pretrage.
- **2** — Katalog popravki, kalkulator, tržišne medijane, max bid.
- **3** — pHash dedup po slikama, HaloOglasi + Limundo, tray + alerti.
- **4** — Export, backup, auto-update, lokalni LLM (Qwen3-4B).

## Desktop build (Tauri) — spremno

Rust toolchain + MSVC Build Tools su instalirani. Scaffold je u `src-tauri/`.

```powershell
npm run tauri dev      # dev mod: prozor + Vite + Rust
npm run tauri build    # release installer (.msi/.exe)
```

Backend moduli (scaffold, stubovi): `db` (SQLite + migracije), `profit` (sa testovima), `ipc` (Tauri komande). Sledeće: scraper adapteri (KP/Halo/Limundo), LLM ekstrakcija.
