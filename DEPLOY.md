# Deploy in ~10 minutes (free, no server)

Everything runs on GitHub: Actions runs the scraper daily, Pages hosts the tracker.

## One-time setup
1. Create a free account at github.com if you don't have one.
2. Click "+" (top right) → New repository → name it `deal-docket` → Public → Create.
3. On the empty repo page, click "uploading an existing file" and drag in ALL the
   files from this folder — including the `.github` folder (if drag-and-drop won't
   take the folder, use "Add file → Create new file", type
   `.github/workflows/scrape.yml` as the name, and paste that file's contents).
4. Settings → Pages → under "Branch" pick `main` and `/ (root)` → Save.
   In a minute your tracker is live at: https://YOURNAME.github.io/deal-docket/
5. Actions tab → click "Daily sheriff sale scrape" → "Run workflow" to do the
   first pull immediately. After it finishes, refresh the tracker — the header
   flips from "sample data" to "live data · updated <date>".

From then on it refreshes itself every morning at 6:30 a.m. ET. Nothing to run,
nothing to pay, no computer that needs to stay on.

## Adding for-sale listings
GitHub's servers can't log into Redfin for you, so refresh those manually when
you want them: draw your search area on redfin.com → scroll down → "Download All"
→ run locally:
    python sheriff_scraper.py --redfin ~/Downloads/redfin_export.csv
→ upload the new properties.json to the repo (or commit it).

## Running locally instead (no GitHub)
    pip install -r requirements.txt
    python sheriff_scraper.py
    python -m http.server 8000
Then open http://localhost:8000 — the page needs a local server (not
double-clicking index.html) or the browser blocks the JSON fetch.

## If a scrape comes back empty
Check the Actions log. A source returning 0 records usually means the county
changed their page layout — open the URL in your browser, compare, and adjust
the parser. Bid4Assets returning 0 likely means JS rendering; see README.md
for the Playwright fallback.
