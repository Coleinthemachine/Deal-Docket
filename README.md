# Brandywine Deal Docket — Scraper

Collects sheriff sale / foreclosure auction listings for **New Castle County, DE**
and **Chester County, PA**, plus for-sale listings via a Redfin CSV export, and
writes `properties.json` in the schema the tracker front-end reads.

## Setup

```bash
pip install -r requirements.txt
python sheriff_scraper.py                        # scrape both counties
python sheriff_scraper.py --redfin listings.csv  # merge for-sale listings
python sheriff_scraper.py --skip bid4assets      # skip a broken source
```

## Data sources (verified July 2026)

| Source | What it is | Notes |
|---|---|---|
| SalesWeb (CivilView) | NCC foreclosure sale table, HTML | Easiest to parse; `countyId=24` |
| newcastlede.gov PDF | Official "Current Sheriff Sale Listing" | Stable URL; judgment $, writ type, address, status. Sales are 2nd Tuesday monthly, 9 a.m., 800 N. French St. |
| Bid4Assets | Chester County online sheriff sales | 3rd Thursday, Jan–Nov, 11 a.m. **May–Aug 2026 sales postponed to Sept 17 / Oct 15 / Nov 19, 2026.** Upset prices often post only days before sale. |
| Redfin CSV | Active for-sale listings | Use the map search "Download All" link over your target area, then `--redfin file.csv`. Legal alternative to scraping an MLS. |

## Important caveats

- **Auction `price` ≠ market value.** Sheriff lists publish *judgment amounts*
  (debt owed); Chester's minimum bid (upset price) is set by the plaintiff.
  The JSON marks these with `"price_basis": "judgment_or_upset"`. Always verify
  before bidding — properties sell as-is, sight unseen, all sales final.
- **Sites change.** Each source fails soft with a warning. If a parser returns
  0 records, the page layout likely changed — inspect it and adjust selectors.
- **Bid4Assets is partly JS-rendered.** If the requests parser returns nothing,
  install Playwright and swap the fetch:
  ```bash
  pip install playwright && playwright install chromium
  ```
  ```python
  from playwright.sync_api import sync_playwright
  with sync_playwright() as pw:
      page = pw.chromium.launch().new_page()
      page.goto(URL, wait_until="networkidle")
      html = page.content()
  ```
- **Be polite.** 2-second delay between requests, identifying User-Agent.
  Put your real contact email in `HEADERS`. Check each site's terms of use;
  government sale lists are public records, but Redfin/Bid4Assets have their
  own terms — the CSV export path exists specifically so you don't scrape Redfin.

## Scheduling

Run daily (auction dockets update as sales approach):

```bash
# crontab -e  — every day at 6:30 a.m.
30 6 * * * cd /path/to/tracker-scraper && /usr/bin/python3 sheriff_scraper.py --out /var/www/tracker/properties.json >> scraper.log 2>&1
```

Or GitHub Actions (`.github/workflows/scrape.yml`):

```yaml
on:
  schedule: [{cron: "30 10 * * *"}]   # 10:30 UTC = 6:30 a.m. ET
jobs:
  scrape:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install -r requirements.txt
      - run: python sheriff_scraper.py --out properties.json
      - uses: stefanzweifel/git-auto-commit-action@v5
```

## Wiring into the tracker

The front-end currently uses `SAMPLE_PROPERTIES`. To feed it live data, replace
that constant with a fetch of the JSON this scraper produces (host it anywhere
static — GitHub Pages, S3, your server):

```jsx
const [properties, setProperties] = useState([]);
useEffect(() => {
  fetch("https://your-host/properties.json")
    .then(r => r.json())
    .then(d => setProperties(d.properties.filter(p => p.price)));
}, []);
```

Records without a price (upset not yet posted) are kept in the JSON but should
be filtered or shown as "bid TBD" in the UI. Neighborhood medians/rents in the
tracker's `NEIGHBORHOODS` table drive the rent/flip verdicts — update those
quarterly from your own comps for real decisions.

## Output schema

```json
{
  "id": 1,
  "address": "610 N Van Buren St Wilmington DE",
  "neighborhood": "Hilltop",
  "zip": "19801",
  "county": "New Castle, DE",
  "price": 121910,
  "price_basis": "judgment_or_upset",
  "source": "Sheriff",
  "saleDate": "2026-08-11",
  "status": "Scheduled",
  "url": "https://salesweb.civilview.com/Sales/SaleDetails?PropertyId=901"
}
```
