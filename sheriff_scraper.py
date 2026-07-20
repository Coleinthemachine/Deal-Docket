#!/usr/bin/env python3
"""
Brandywine Deal Docket — data collector
========================================
Pulls sheriff sale / foreclosure auction listings for:
  • New Castle County, DE  — CivilView SalesWeb (HTML) + official county PDF fallback
  • Chester County, PA     — Bid4Assets landing page + chesco.org listing PDFs
  • For-sale listings      — via a Redfin "Download All" CSV you export (legal, no scraping)

Outputs properties.json in the exact schema the tracker front-end reads.

IMPORTANT HONESTY NOTES
-----------------------
1. Sheriff lists publish JUDGMENT amounts (what's owed), not opening bids or
   market value. Chester's upset price is set by the plaintiff and often only
   appears on Bid4Assets close to sale day. Treat `price` for auction records
   as a starting reference, and verify before bidding.
2. County websites change. Every parser here fails soft: if a source breaks,
   you get a warning and the rest still runs. Selectors are current as of
   July 2026.
3. Bid4Assets renders some content with JavaScript. The requests-based parser
   grabs what is in the raw HTML; if it comes back empty, see README for the
   Playwright fallback.

Usage:
  python sheriff_scraper.py                       # scrape both counties
  python sheriff_scraper.py --redfin listings.csv # also merge a Redfin CSV export
  python sheriff_scraper.py --out properties.json
"""

import argparse
import csv
import io
import json
import re
import sys
import time
from datetime import datetime, timezone

import requests
from bs4 import BeautifulSoup

try:
    import pdfplumber
    HAS_PDF = True
except ImportError:
    HAS_PDF = False

# ----------------------------------------------------------------------------
# CONFIG
# ----------------------------------------------------------------------------

HEADERS = {
    # Identify yourself politely. Put a real contact in production.
    "User-Agent": "BrandywineDealDocket/1.0 (personal investment research; contact: you@example.com)",
    "Accept-Language": "en-US,en;q=0.9",
}
REQUEST_DELAY = 2.0   # seconds between requests — be a good citizen
TIMEOUT = 30

SOURCES = {
    "ncc_civilview": "https://salesweb.civilview.com/Sales/SalesSearch?countyId=24",
    "ncc_pdf": "https://www.newcastlede.gov/DocumentCenter/View/266/Current-Sheriff-Sale-Listing",
    "chester_bid4assets": "https://www.bid4assets.com/chestercopasheriffsales",
}

# ZIP -> (neighborhood bucket, county) used by the tracker's median/rent lookups.
# Extend freely; unmatched ZIPs fall into a county-level "Other" bucket.
ZIP_MAP = {
    # New Castle County, DE
    "19801": ("Hilltop", "New Castle, DE"),            # W Center City / downtown Wilmington
    "19802": ("Riverside", "New Castle, DE"),          # NE Wilmington
    "19803": ("Trolley Square", "New Castle, DE"),     # N Wilmington (proxy)
    "19805": ("Elsmere", "New Castle, DE"),
    "19804": ("Newport", "New Castle, DE"),
    "19806": ("Trolley Square", "New Castle, DE"),
    "19807": ("Trolley Square", "New Castle, DE"),
    "19809": ("Bellefonte", "New Castle, DE"),
    "19810": ("Bellefonte", "New Castle, DE"),
    "19720": ("New Castle (city)", "New Castle, DE"),
    # Chester County, PA
    "19380": ("West Chester", "Chester, PA"),
    "19382": ("West Chester", "Chester, PA"),
    "19320": ("Coatesville", "Chester, PA"),
    "19335": ("Downingtown", "Chester, PA"),
    "19348": ("Kennett Square", "Chester, PA"),
    "19460": ("Phoenixville", "Chester, PA"),
    "19363": ("Oxford", "Chester, PA"),
    "19311": ("Avondale", "Chester, PA"),
}

ZIP_RE = re.compile(r"\b(19\d{3})\b")
MONEY_RE = re.compile(r"\$\s*([\d,]+(?:\.\d{2})?)")


def polite_get(url, session, **kw):
    time.sleep(REQUEST_DELAY)
    r = session.get(url, headers=HEADERS, timeout=TIMEOUT, **kw)
    r.raise_for_status()
    return r


def classify_zip(text, default_county=None):
    m = ZIP_RE.search(text or "")
    if m and m.group(1) in ZIP_MAP:
        hood, county = ZIP_MAP[m.group(1)]
        return hood, county, m.group(1)
    if m and m.group(1).startswith("197") or (m and m.group(1).startswith("198")):
        return "Other (New Castle)", "New Castle, DE", m.group(1)
    if m and m.group(1).startswith("193") or (m and m.group(1).startswith("194")):
        return "Other (Chester)", "Chester, PA", m.group(1)
    if default_county == "Chester, PA":
        return "Other (Chester)", "Chester, PA", m.group(1) if m else None
    if default_county == "New Castle, DE":
        return "Other (New Castle)", "New Castle, DE", m.group(1) if m else None
    return None, None, m.group(1) if m else None


def parse_money(text):
    m = MONEY_RE.search(text or "")
    return float(m.group(1).replace(",", "")) if m else None


# ----------------------------------------------------------------------------
# SOURCE 1: New Castle County via CivilView SalesWeb (structured HTML)
# ----------------------------------------------------------------------------

def scrape_ncc_civilview(session):
    """SalesWeb lists NCC foreclosure sales in an HTML table with detail links.
    Columns typically: Details | Sheriff # | Sale Date | Plaintiff | Defendant | Address.
    Detail pages add Approx. Judgment, status, and attorney info."""
    out = []
    try:
        r = polite_get(SOURCES["ncc_civilview"], session)
    except Exception as e:
        print(f"[warn] NCC CivilView unreachable: {e}", file=sys.stderr)
        return out

    soup = BeautifulSoup(r.text, "html.parser")
    table = soup.find("table")
    if not table:
        print("[warn] NCC CivilView: no table found — page layout may have changed", file=sys.stderr)
        return out

    for row in table.find_all("tr"):
        cells = [c.get_text(" ", strip=True) for c in row.find_all("td")]
        if len(cells) < 4:
            continue
        link = row.find("a", href=True)
        detail_url = ("https://salesweb.civilview.com" + link["href"]) if link and link["href"].startswith("/") else None

        # Address is usually the last cell; sale date is a mm/dd/yyyy cell.
        address = cells[-1]
        sale_date = next((c for c in cells if re.match(r"\d{1,2}/\d{1,2}/\d{4}", c)), None)
        sheriff_no = cells[1] if len(cells) > 1 else None

        judgment = None
        status = "Scheduled"
        if detail_url:
            try:
                dr = polite_get(detail_url, session)
                dsoup = BeautifulSoup(dr.text, "html.parser")
                dtext = dsoup.get_text(" ", strip=True)
                jm = re.search(r"Judgment[^$]*\$\s*([\d,]+(?:\.\d{2})?)", dtext, re.I)
                if jm:
                    judgment = float(jm.group(1).replace(",", ""))
                sm = re.search(r"Status\s*:?\s*(Scheduled|Stayed|Postponed|Adjourned|Canceled|Cancelled|Sold)", dtext, re.I)
                if sm:
                    status = sm.group(1).strip()
            except Exception as e:
                print(f"[warn] NCC detail fetch failed ({detail_url}): {e}", file=sys.stderr)

        out.append({
            "source": "Sheriff",
            "source_detail": "New Castle County Sheriff Sale (via SalesWeb)",
            "address": address,
            "sale_date_raw": sale_date,
            "sheriff_no": sheriff_no,
            "judgment": judgment,
            "status": status,
            "url": detail_url or SOURCES["ncc_civilview"],
        })
    print(f"[ok] NCC CivilView: {len(out)} records")
    return out


# ----------------------------------------------------------------------------
# SOURCE 2: New Castle County official PDF (fallback / cross-check)
# ----------------------------------------------------------------------------

def scrape_ncc_pdf(session):
    """The county publishes 'Current Sheriff Sale Listing' at a stable URL —
    a Tyler Technologies report with parcel, judgment, writ type (MTG/TAX),
    address+ZIP, status, and case numbers. Layout is columnar; we regex-mine
    the text for address/ZIP/judgment triples."""
    out = []
    if not HAS_PDF:
        print("[warn] pdfplumber not installed — skipping NCC PDF", file=sys.stderr)
        return out
    try:
        r = polite_get(SOURCES["ncc_pdf"], session)
    except Exception as e:
        print(f"[warn] NCC PDF unreachable: {e}", file=sys.stderr)
        return out

    try:
        with pdfplumber.open(io.BytesIO(r.content)) as pdf:
            text = "\n".join(page.extract_text() or "" for page in pdf.pages)
    except Exception as e:
        print(f"[warn] NCC PDF parse failed: {e}", file=sys.stderr)
        return out

    # Pattern per record (order in report): $judgment  MTG|TAX  ADDRESS CITY 19xxx  Status
    rec_re = re.compile(
        r"\$\s*([\d,]+\.\d{2})\s+(MTG|TAX|JDG)\s+(.+?)\s+(19\d{3})\s+(Scheduled|Stayed|Postponed|Canceled|Cancelled|Sold)",
        re.I,
    )
    for m in rec_re.finditer(text):
        judgment, writ, addr, zipc, status = m.groups()
        out.append({
            "source": "Sheriff",
            "source_detail": f"New Castle County Sheriff Sale (official PDF, writ: {writ})",
            "address": f"{addr.title()} {zipc}",
            "sale_date_raw": None,  # sale date appears in the report header; fill from list header if needed
            "sheriff_no": None,
            "judgment": float(judgment.replace(",", "")),
            "status": status.title(),
            "url": SOURCES["ncc_pdf"],
        })
    print(f"[ok] NCC PDF: {len(out)} records")
    return out


# ----------------------------------------------------------------------------
# SOURCE 3: Chester County via Bid4Assets
# ----------------------------------------------------------------------------

def scrape_chester_bid4assets(session):
    """Chester County sales run online via Bid4Assets (3rd Thursday, Jan–Nov).
    The county landing page links to /auction/index/<id> pages whose titles
    carry the property address. Some data is JS-rendered; we harvest whatever
    is present in raw HTML and follow auction links for dates/bids."""
    out = []
    try:
        r = polite_get(SOURCES["chester_bid4assets"], session)
    except Exception as e:
        print(f"[warn] Bid4Assets unreachable: {e}", file=sys.stderr)
        return out

    soup = BeautifulSoup(r.text, "html.parser")
    seen = set()
    links = []
    for a in soup.find_all("a", href=True):
        m = re.search(r"/auction/index/(\d+)", a["href"])
        if m and m.group(1) not in seen:
            seen.add(m.group(1))
            links.append(("https://www.bid4assets.com/auction/index/" + m.group(1), a.get_text(" ", strip=True)))

    if not links:
        print("[warn] Bid4Assets: no auction links in raw HTML (likely JS-rendered). "
              "Use the Playwright fallback in README.", file=sys.stderr)
        return out

    for url, link_text in links[:60]:  # safety cap
        try:
            ar = polite_get(url, session)
            atext = BeautifulSoup(ar.text, "html.parser").get_text(" ", strip=True)
        except Exception as e:
            print(f"[warn] auction fetch failed ({url}): {e}", file=sys.stderr)
            continue

        title = re.search(r"Chester County, PA Sheriff Sale:\s*([^|<]{5,80})", atext)
        address = (title.group(1).strip() if title else link_text or "Address on auction page")
        stayed = bool(re.search(r"STAYED|POSTPONED|CANCEL", atext[:2000], re.I))
        date_m = re.search(r"(\d{2}-\d{2}-\d{4})\s+Chester County Sheriff sale", atext)
        bid = parse_money(re.search(r"(Current|Opening|Minimum)\s+Bid[^$]*\$[\d,\.]+", atext, re.I).group(0)) \
            if re.search(r"(Current|Opening|Minimum)\s+Bid", atext, re.I) else None

        out.append({
            "source": "Sheriff",
            "source_detail": "Chester County Sheriff Sale (Bid4Assets)",
            "default_county": "Chester, PA",
            "address": address.title(),
            "sale_date_raw": date_m.group(1).replace("-", "/") if date_m else None,
            "sheriff_no": None,
            "judgment": bid,   # upset/opening bid when exposed; often posted close to sale day
            "status": "Stayed/Postponed" if stayed else "Scheduled",
            "url": url,
        })
    print(f"[ok] Bid4Assets: {len(out)} records")
    return out


# ----------------------------------------------------------------------------
# SOURCE 4: For-sale listings via Redfin CSV export (no scraping needed)
# ----------------------------------------------------------------------------

def ingest_redfin_csv(path):
    """Redfin's map search has a 'Download All' link that exports a CSV of
    active listings — the sanctioned way to get for-sale data without an MLS
    feed. Draw your search around Wilmington/Greater Wilmington and Chester
    County, download, and pass the file with --redfin."""
    out = []
    with open(path, newline="", encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            addr = row.get("ADDRESS") or row.get("Address") or ""
            city = row.get("CITY") or row.get("City") or ""
            zipc = row.get("ZIP OR POSTAL CODE") or row.get("ZIP") or ""
            price = row.get("PRICE") or row.get("Price") or ""
            try:
                price = float(re.sub(r"[^\d.]", "", price))
            except ValueError:
                continue
            out.append({
                "source": "MLS",
                "source_detail": "For sale (Redfin export)",
                "address": f"{addr}, {city} {zipc}".strip(", "),
                "sale_date_raw": None,
                "sheriff_no": None,
                "judgment": price,   # list price
                "status": "Active",
                "url": row.get("URL (SEE https://www.redfin.com/buy-a-home/comparative-market-analysis FOR INFO ON PRICING)", ""),
                "beds": row.get("BEDS"), "baths": row.get("BATHS"),
                "sqft": row.get("SQUARE FEET"),
            })
    print(f"[ok] Redfin CSV: {len(out)} records")
    return out


# ----------------------------------------------------------------------------
# NORMALIZE -> tracker schema
# ----------------------------------------------------------------------------

def normalize(records):
    props, skipped = [], 0
    for i, r in enumerate(records, 1):
        hood, county, zipc = classify_zip(r["address"], r.get("default_county"))
        if county is None:
            skipped += 1
            continue  # outside our two-county footprint
        sale_date = None
        if r.get("sale_date_raw"):
            try:
                sale_date = datetime.strptime(r["sale_date_raw"], "%m/%d/%Y").strftime("%Y-%m-%d")
            except ValueError:
                pass
        props.append({
            "id": i,
            "address": re.sub(r"\s+19\d{3}$", "", r["address"]).strip(),
            "neighborhood": hood,
            "zip": zipc,
            "county": county,
            "price": round(r["judgment"]) if r.get("judgment") else None,
            "price_basis": ("list_price" if r["source"] == "MLS" else "judgment_or_upset"),
            "source": r["source"],
            "source_detail": r["source_detail"],
            "saleDate": sale_date,
            "status": r.get("status"),
            "beds": r.get("beds"), "baths": r.get("baths"), "sqft": r.get("sqft"),
            "url": r.get("url"),
        })
    if skipped:
        print(f"[info] skipped {skipped} records outside NCC/Chester ZIP footprint")
    return props


def dedupe(props):
    seen, out = {}, []
    for p in props:
        key = re.sub(r"[^a-z0-9]", "", p["address"].lower())
        if key in seen:
            # prefer the record that has a price and a sale date
            old = seen[key]
            if (p["price"] and not old["price"]) or (p["saleDate"] and not old["saleDate"]):
                out[out.index(old)] = p
                seen[key] = p
            continue
        seen[key] = p
        out.append(p)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="properties.json")
    ap.add_argument("--redfin", help="path to a Redfin 'Download All' CSV export")
    ap.add_argument("--skip", nargs="*", default=[], choices=["civilview", "pdf", "bid4assets"])
    args = ap.parse_args()

    session = requests.Session()
    records = []
    if "civilview" not in args.skip:
        records += scrape_ncc_civilview(session)
    if "pdf" not in args.skip:
        records += scrape_ncc_pdf(session)
    if "bid4assets" not in args.skip:
        records += scrape_chester_bid4assets(session)
    if args.redfin:
        records += ingest_redfin_csv(args.redfin)

    props = dedupe(normalize(records))
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "counts": {
            "total": len(props),
            "auctions": sum(1 for p in props if p["source"] != "MLS"),
            "for_sale": sum(1 for p in props if p["source"] == "MLS"),
        },
        "disclaimer": ("Auction 'price' fields are judgment/upset amounts, not market value. "
                       "Verify every property before bidding. Sold as-is, buyer beware."),
        "properties": props,
    }
    with open(args.out, "w") as f:
        json.dump(payload, f, indent=2)
    print(f"[done] wrote {len(props)} properties -> {args.out}")


if __name__ == "__main__":
    main()
