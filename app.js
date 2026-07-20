import { jsxDEV as _jsxDEV } from "react/jsx-dev-runtime";
const {
  useState,
  useMemo,
  useEffect
} = React;

/* ============ LIVE DATA ============
   Fetches ./properties.json (written by sheriff_scraper.py). If the file is
   missing or empty, falls back to the sample data below so the page always
   renders something. */
const DATA_URL = "./properties.json";
const CURRENT_RATE = 6.55;
const NEIGHBORHOODS = {
  "Trolley Square": {
    median: 340000,
    rent: 1700
  },
  "Union Park Gardens": {
    median: 252000,
    rent: 1500
  },
  "Riverside": {
    median: 122000,
    rent: 1150
  },
  "Hilltop": {
    median: 112000,
    rent: 1050
  },
  "Bellefonte": {
    median: 242000,
    rent: 1500
  },
  "Elsmere": {
    median: 236000,
    rent: 1550
  },
  "Newport": {
    median: 262000,
    rent: 1600
  },
  "New Castle (city)": {
    median: 256000,
    rent: 1550
  },
  "West Chester": {
    median: 525000,
    rent: 2400
  },
  "Coatesville": {
    median: 232000,
    rent: 1500
  },
  "Downingtown": {
    median: 455000,
    rent: 2300
  },
  "Kennett Square": {
    median: 482000,
    rent: 2350
  },
  "Phoenixville": {
    median: 468000,
    rent: 2300
  },
  "Oxford": {
    median: 332000,
    rent: 1850
  },
  "Avondale": {
    median: 352000,
    rent: 1900
  },
  // County-level fallbacks for ZIPs the scraper couldn't bucket precisely.
  // These are broad averages — refine ZIP_MAP in the scraper for better verdicts.
  "Other (New Castle)": {
    median: 280000,
    rent: 1650
  },
  "Other (Chester)": {
    median: 420000,
    rent: 2100
  }
};
const SAMPLE = [{
  id: 1,
  address: "1206 N Harrison St",
  neighborhood: "Trolley Square",
  county: "New Castle, DE",
  price: 315000,
  source: "MLS",
  beds: 3,
  baths: 1.5,
  sqft: 1650
}, {
  id: 2,
  address: "27 E 22nd St",
  neighborhood: "Riverside",
  county: "New Castle, DE",
  price: 84000,
  source: "MLS",
  beds: 3,
  baths: 1,
  sqft: 1225
}, {
  id: 3,
  address: "610 N Van Buren St",
  neighborhood: "Hilltop",
  county: "New Castle, DE",
  price: 67500,
  source: "Sheriff",
  saleDate: "2026-08-11"
}, {
  id: 4,
  address: "108 Filbert Ave",
  neighborhood: "Elsmere",
  county: "New Castle, DE",
  price: 152000,
  source: "Sheriff",
  saleDate: "2026-08-11"
}, {
  id: 5,
  address: "718 Olive St",
  neighborhood: "Coatesville",
  county: "Chester, PA",
  price: 129000,
  source: "Sheriff",
  saleDate: "2026-09-17"
}, {
  id: 6,
  address: "907 George St",
  neighborhood: "Other (Chester)",
  county: "Chester, PA",
  price: null,
  source: "Sheriff",
  saleDate: "2026-09-17"
}, {
  id: 7,
  address: "422 W Miner St",
  neighborhood: "West Chester",
  county: "Chester, PA",
  price: 415000,
  source: "MLS",
  beds: 3,
  baths: 2,
  sqft: 1750
}];
function mortgagePI(price, ratePct, downPct) {
  const L = price * (1 - downPct / 100),
    r = ratePct / 100 / 12,
    n = 360;
  return r === 0 ? L / n : L * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
}
function analyze(p, cfg) {
  const hood = NEIGHBORHOODS[p.neighborhood] || NEIGHBORHOODS["Other (New Castle)"];
  if (p.price == null) {
    return {
      tbd: true,
      verdict: "TBD",
      median: hood.median,
      county: p.county,
      payment: null
    };
  }
  const investment = p.price * (1 + cfg.renoPct / 100);
  const requiredRent = investment * (cfg.rentRule / 100);
  const marketRent = hood.rent;
  const rentAttainable = marketRent >= requiredRent;
  const paybackYears = investment / (marketRent * 12);
  const rentViable = rentAttainable && paybackYears <= cfg.horizon;
  const rentProfit = marketRent * 12 * cfg.horizon - investment;
  const netProceeds = hood.median * (1 - cfg.flipCost / 100);
  const flipProfit = netProceeds - investment;
  const flipROI = flipProfit / investment;
  const flipViable = flipROI >= cfg.flipMin / 100;
  let verdict = "PASS";
  if (rentViable && flipViable) verdict = flipProfit > rentProfit ? "FLIP" : "RENT";else if (rentViable) verdict = "RENT";else if (flipViable) verdict = "FLIP";
  return {
    tbd: false,
    investment,
    requiredRent,
    marketRent,
    rentAttainable,
    paybackYears,
    rentViable,
    rentProfit,
    netProceeds,
    flipProfit,
    flipROI,
    flipViable,
    verdict,
    median: hood.median,
    county: p.county,
    discount: p.price / hood.median,
    payment: mortgagePI(p.price, cfg.rate, cfg.downPct)
  };
}
const T = {
  paper: "#FAFAF7",
  card: "#FFFFFF",
  ink: "#1D2422",
  faint: "#6B7370",
  line: "#DDDFD8",
  brandy: "#722F37",
  rent: "#0E5E63",
  rentBg: "#E3F0EF",
  flip: "#9A5B0B",
  flipBg: "#F6EDDC",
  pass: "#7A7F7C",
  passBg: "#EEEFEA",
  auction: "#722F37"
};
const fmt = n => "$" + Math.round(n).toLocaleString();
const fmtK = n => "$" + (n >= 1000 ? Math.round(n / 1000) + "K" : Math.round(n));
const VS = {
  RENT: {
    c: T.rent,
    l: "RENT"
  },
  FLIP: {
    c: T.flip,
    l: "FLIP"
  },
  PASS: {
    c: T.pass,
    l: "PASS"
  },
  TBD: {
    c: T.faint,
    l: "BID TBD"
  }
};
const SOURCE_LABEL = {
  MLS: "For sale · MLS",
  Sheriff: "Sheriff sale",
  Foreclosure: "Foreclosure auction",
  Auction: "Public auction"
};
function Stamp({
  verdict
}) {
  const v = VS[verdict];
  return /*#__PURE__*/_jsxDEV("div", {
    "aria-label": "Verdict: " + v.l,
    style: {
      border: `2.5px solid ${v.c}`,
      color: v.c,
      borderRadius: 4,
      padding: "3px 12px 2px",
      fontFamily: "'IBM Plex Mono', monospace",
      fontWeight: 700,
      fontSize: 15,
      letterSpacing: "0.14em",
      transform: "rotate(-4deg)",
      opacity: 0.92,
      whiteSpace: "nowrap"
    },
    children: v.l
  }, void 0, false);
}
function Row({
  label,
  value,
  strong,
  color
}) {
  return /*#__PURE__*/_jsxDEV("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      gap: 16,
      padding: "3px 0"
    },
    children: [/*#__PURE__*/_jsxDEV("span", {
      style: {
        color: T.faint,
        fontSize: 13
      },
      children: label
    }, void 0, false), /*#__PURE__*/_jsxDEV("span", {
      style: {
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 13,
        fontWeight: strong ? 700 : 500,
        color: color || T.ink
      },
      children: value
    }, void 0, false)]
  }, void 0, true);
}
function Card({
  p,
  a
}) {
  const [open, setOpen] = useState(false);
  const isAuction = p.source !== "MLS";
  const details = [p.neighborhood, p.county, p.beds && `${p.beds}bd/${p.baths}ba`, p.sqft && `${Number(p.sqft).toLocaleString()} sqft`].filter(Boolean).join(" · ");
  return /*#__PURE__*/_jsxDEV("div", {
    style: {
      background: T.card,
      border: `1px solid ${T.line}`,
      borderLeft: `4px solid ${isAuction ? T.auction : T.line}`,
      borderRadius: 6,
      padding: "16px 18px",
      display: "flex",
      flexDirection: "column",
      gap: 10
    },
    children: [/*#__PURE__*/_jsxDEV("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 12
      },
      children: [/*#__PURE__*/_jsxDEV("div", {
        children: [/*#__PURE__*/_jsxDEV("div", {
          style: {
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: isAuction ? T.auction : T.faint,
            fontWeight: isAuction ? 700 : 500
          },
          children: [SOURCE_LABEL[p.source] || p.source, p.saleDate && " · sale " + new Date(p.saleDate + "T12:00:00").toLocaleDateString("en-US", {
            month: "short",
            day: "numeric"
          }), p.status && p.status !== "Scheduled" && p.status !== "Active" && " · " + p.status]
        }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
          style: {
            fontFamily: "'Zilla Slab', serif",
            fontSize: 20,
            fontWeight: 600,
            lineHeight: 1.2,
            marginTop: 2
          },
          children: p.url ? /*#__PURE__*/_jsxDEV("a", {
            href: p.url,
            target: "_blank",
            rel: "noopener",
            style: {
              color: T.ink,
              textDecoration: "none",
              borderBottom: `1px dotted ${T.faint}`
            },
            children: p.address
          }, void 0, false) : p.address
        }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
          style: {
            fontSize: 13,
            color: T.faint,
            marginTop: 2
          },
          children: details
        }, void 0, false)]
      }, void 0, true), /*#__PURE__*/_jsxDEV(Stamp, {
        verdict: a.verdict
      }, void 0, false)]
    }, void 0, true), a.tbd ? /*#__PURE__*/_jsxDEV("div", {
      style: {
        fontSize: 13,
        color: T.faint,
        background: T.paper,
        borderRadius: 4,
        padding: "8px 10px"
      },
      children: "Opening bid not yet posted — Chester upset prices usually appear on Bid4Assets in the days before the sale. This card will grade automatically once the scraper picks up a number."
    }, void 0, false) : /*#__PURE__*/_jsxDEV(React.Fragment, {
      children: [/*#__PURE__*/_jsxDEV("div", {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
          gap: 8
        },
        children: [[isAuction ? "Opening/judgment" : "List price", fmt(p.price)], ["Mo. payment (P&I)", fmt(a.payment)], ["Hood median", fmtK(a.median)], ["Price vs median", Math.round(a.discount * 100) + "%"]].map(([l, val]) => /*#__PURE__*/_jsxDEV("div", {
          style: {
            background: T.paper,
            borderRadius: 4,
            padding: "6px 10px"
          },
          children: [/*#__PURE__*/_jsxDEV("div", {
            style: {
              fontSize: 10.5,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: T.faint
            },
            children: l
          }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
            style: {
              fontFamily: "'IBM Plex Mono', monospace",
              fontWeight: 700,
              fontSize: 15
            },
            children: val
          }, void 0, false)]
        }, l, true))
      }, void 0, false), /*#__PURE__*/_jsxDEV("button", {
        onClick: () => setOpen(!open),
        style: {
          alignSelf: "flex-start",
          background: "none",
          border: "none",
          color: T.brandy,
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          padding: "2px 0",
          fontFamily: "'Public Sans', sans-serif"
        },
        children: open ? "Hide the math ▴" : "Show the math ▾"
      }, void 0, false), open && /*#__PURE__*/_jsxDEV("div", {
        style: {
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          borderTop: `1px dashed ${T.line}`,
          paddingTop: 10
        },
        children: [/*#__PURE__*/_jsxDEV("div", {
          children: [/*#__PURE__*/_jsxDEV("div", {
            style: {
              fontSize: 12,
              fontWeight: 700,
              color: a.rentViable ? T.rent : T.pass,
              letterSpacing: "0.06em",
              marginBottom: 4
            },
            children: ["RENT TEST ", a.rentViable ? "✓" : "✗"]
          }, void 0, true), /*#__PURE__*/_jsxDEV(Row, {
            label: "Investment (price +reno)",
            value: fmt(a.investment)
          }, void 0, false), /*#__PURE__*/_jsxDEV(Row, {
            label: "Required rent (rule)",
            value: fmt(a.requiredRent) + "/mo"
          }, void 0, false), /*#__PURE__*/_jsxDEV(Row, {
            label: "Achievable market rent",
            value: fmt(a.marketRent) + "/mo",
            color: a.rentAttainable ? T.rent : T.brandy
          }, void 0, false), /*#__PURE__*/_jsxDEV(Row, {
            label: "Payback at market rent",
            value: a.paybackYears.toFixed(1) + " yrs",
            color: a.paybackYears <= 10 ? T.rent : T.brandy
          }, void 0, false), /*#__PURE__*/_jsxDEV(Row, {
            label: "10-yr gross vs investment",
            value: (a.rentProfit >= 0 ? "+" : "−") + fmt(Math.abs(a.rentProfit)),
            strong: true
          }, void 0, false)]
        }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
          children: [/*#__PURE__*/_jsxDEV("div", {
            style: {
              fontSize: 12,
              fontWeight: 700,
              color: a.flipViable ? T.flip : T.pass,
              letterSpacing: "0.06em",
              marginBottom: 4
            },
            children: ["FLIP TEST ", a.flipViable ? "✓" : "✗"]
          }, void 0, true), /*#__PURE__*/_jsxDEV(Row, {
            label: "ARV (neighborhood median)",
            value: fmt(a.median)
          }, void 0, false), /*#__PURE__*/_jsxDEV(Row, {
            label: "Net after selling costs",
            value: fmt(a.netProceeds)
          }, void 0, false), /*#__PURE__*/_jsxDEV(Row, {
            label: "All-in investment",
            value: fmt(a.investment)
          }, void 0, false), /*#__PURE__*/_jsxDEV(Row, {
            label: "Projected profit",
            value: (a.flipProfit >= 0 ? "+" : "−") + fmt(Math.abs(a.flipProfit)),
            strong: true,
            color: a.flipProfit >= 0 ? T.flip : T.brandy
          }, void 0, false), /*#__PURE__*/_jsxDEV(Row, {
            label: "ROI",
            value: Math.round(a.flipROI * 100) + "%",
            strong: true
          }, void 0, false)]
        }, void 0, true)]
      }, void 0, true)]
    }, void 0, true)]
  }, void 0, true);
}
function Num({
  label,
  value,
  onChange,
  step = 1,
  suffix
}) {
  return /*#__PURE__*/_jsxDEV("label", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 3
    },
    children: [/*#__PURE__*/_jsxDEV("span", {
      style: {
        fontSize: 10.5,
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        color: T.faint,
        fontWeight: 600
      },
      children: label
    }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 4
      },
      children: [/*#__PURE__*/_jsxDEV("input", {
        type: "number",
        value: value,
        step: step,
        onChange: e => onChange(parseFloat(e.target.value) || 0),
        style: {
          width: 64,
          padding: "5px 7px",
          border: `1px solid ${T.line}`,
          borderRadius: 4,
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 14,
          fontWeight: 600,
          background: T.card,
          color: T.ink
        }
      }, void 0, false), /*#__PURE__*/_jsxDEV("span", {
        style: {
          fontSize: 12,
          color: T.faint
        },
        children: suffix
      }, void 0, false)]
    }, void 0, true)]
  }, void 0, true);
}
function App() {
  const [cfg, setCfg] = useState({
    rate: CURRENT_RATE,
    downPct: 20,
    renoPct: 20,
    rentRule: 1.0,
    horizon: 10,
    flipCost: 8,
    flipMin: 15
  });
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [countyFilter, setCountyFilter] = useState("ALL");
  const [verdictFilter, setVerdictFilter] = useState("ALL");
  const [sort, setSort] = useState("price");
  const [data, setData] = useState({
    properties: SAMPLE,
    live: false,
    generated: null
  });
  useEffect(() => {
    fetch(DATA_URL).then(r => {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).then(d => {
      if (d.properties && d.properties.length) setData({
        properties: d.properties,
        live: true,
        generated: d.generated_at
      });
    }).catch(() => {/* keep sample fallback */});
  }, []);
  const rows = useMemo(() => {
    let r = data.properties.map(p => ({
      p,
      a: analyze(p, cfg)
    }));
    if (sourceFilter === "AUCTIONS") r = r.filter(x => x.p.source !== "MLS");
    if (sourceFilter === "MLS") r = r.filter(x => x.p.source === "MLS");
    if (countyFilter !== "ALL") r = r.filter(x => x.p.county === countyFilter);
    if (verdictFilter !== "ALL") r = r.filter(x => x.a.verdict === verdictFilter);
    r.sort((x, y) => {
      const px = x.p.price ?? Infinity,
        py = y.p.price ?? Infinity;
      if (sort === "price") return px - py;
      if (sort === "payment") return (x.a.payment ?? Infinity) - (y.a.payment ?? Infinity);
      if (sort === "flip") return (y.a.flipProfit ?? -Infinity) - (x.a.flipProfit ?? -Infinity);
      if (sort === "discount") return (x.a.discount ?? Infinity) - (y.a.discount ?? Infinity);
      if (sort === "date") return (x.p.saleDate || "9999").localeCompare(y.p.saleDate || "9999");
      return 0;
    });
    return r;
  }, [data, cfg, sourceFilter, countyFilter, verdictFilter, sort]);
  const all = useMemo(() => data.properties.map(p => analyze(p, cfg)), [data, cfg]);
  const counts = {
    total: all.length,
    auctions: data.properties.filter(p => p.source !== "MLS").length,
    rent: all.filter(a => a.verdict === "RENT").length,
    flip: all.filter(a => a.verdict === "FLIP").length,
    pass: all.filter(a => a.verdict === "PASS").length,
    tbd: all.filter(a => a.verdict === "TBD").length
  };
  const set = k => v => setCfg(c => ({
    ...c,
    [k]: v
  }));
  const Chip = ({
    active,
    onClick,
    children,
    color
  }) => /*#__PURE__*/_jsxDEV("button", {
    onClick: onClick,
    style: {
      padding: "5px 12px",
      borderRadius: 99,
      border: `1px solid ${active ? color || T.ink : T.line}`,
      background: active ? color || T.ink : T.card,
      color: active ? "#fff" : T.ink,
      fontSize: 12.5,
      fontWeight: 600,
      cursor: "pointer",
      fontFamily: "'Public Sans', sans-serif"
    },
    children: children
  }, void 0, false);
  return /*#__PURE__*/_jsxDEV("div", {
    style: {
      minHeight: "100vh",
      background: T.paper,
      color: T.ink,
      fontFamily: "'Public Sans', system-ui, sans-serif"
    },
    children: [/*#__PURE__*/_jsxDEV("header", {
      style: {
        borderBottom: `3px double ${T.ink}`,
        background: T.card
      },
      children: /*#__PURE__*/_jsxDEV("div", {
        style: {
          maxWidth: 1060,
          margin: "0 auto",
          padding: "22px 20px 16px"
        },
        children: /*#__PURE__*/_jsxDEV("div", {
          style: {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            flexWrap: "wrap",
            gap: 12
          },
          children: [/*#__PURE__*/_jsxDEV("div", {
            children: [/*#__PURE__*/_jsxDEV("div", {
              style: {
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: 11,
                letterSpacing: "0.18em",
                color: T.brandy,
                fontWeight: 700
              },
              children: "NEW CASTLE CO, DE · CHESTER CO, PA"
            }, void 0, false), /*#__PURE__*/_jsxDEV("h1", {
              style: {
                fontFamily: "'Zilla Slab', serif",
                fontSize: 34,
                fontWeight: 700,
                margin: "2px 0 0",
                lineHeight: 1.05
              },
              children: "Brandywine Deal Docket"
            }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
              style: {
                fontSize: 13.5,
                color: T.faint,
                marginTop: 4
              },
              children: ["For-sale listings, sheriff sales & foreclosure auctions — auto-graded rent vs. flip", " · ", /*#__PURE__*/_jsxDEV("span", {
                style: {
                  color: data.live ? T.rent : T.flip,
                  fontWeight: 600
                },
                children: data.live ? "live data" + (data.generated ? " · updated " + new Date(data.generated).toLocaleDateString() : "") : "sample data (properties.json not found)"
              }, void 0, false)]
            }, void 0, true)]
          }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
            style: {
              display: "flex",
              gap: 18,
              fontFamily: "'IBM Plex Mono', monospace"
            },
            children: [["Tracked", counts.total, T.ink], ["Auctions", counts.auctions, T.auction], ["Rent", counts.rent, T.rent], ["Flip", counts.flip, T.flip], ["Pass", counts.pass, T.pass], ["TBD", counts.tbd, T.faint]].map(([l, n, c]) => /*#__PURE__*/_jsxDEV("div", {
              style: {
                textAlign: "center"
              },
              children: [/*#__PURE__*/_jsxDEV("div", {
                style: {
                  fontSize: 22,
                  fontWeight: 700,
                  color: c
                },
                children: n
              }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
                style: {
                  fontSize: 10,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: T.faint
                },
                children: l
              }, void 0, false)]
            }, l, true))
          }, void 0, false)]
        }, void 0, true)
      }, void 0, false)
    }, void 0, false), /*#__PURE__*/_jsxDEV("main", {
      style: {
        maxWidth: 1060,
        margin: "0 auto",
        padding: "18px 20px 60px"
      },
      children: [/*#__PURE__*/_jsxDEV("section", {
        "aria-label": "Model parameters",
        style: {
          background: T.card,
          border: `1px solid ${T.line}`,
          borderRadius: 6,
          padding: "14px 18px",
          display: "flex",
          gap: 22,
          flexWrap: "wrap",
          alignItems: "flex-end"
        },
        children: [/*#__PURE__*/_jsxDEV(Num, {
          label: "30-yr rate",
          value: cfg.rate,
          onChange: set("rate"),
          step: 0.05,
          suffix: "%"
        }, void 0, false), /*#__PURE__*/_jsxDEV(Num, {
          label: "Down payment",
          value: cfg.downPct,
          onChange: set("downPct"),
          suffix: "%"
        }, void 0, false), /*#__PURE__*/_jsxDEV(Num, {
          label: "Reno budget",
          value: cfg.renoPct,
          onChange: set("renoPct"),
          suffix: "% of price"
        }, void 0, false), /*#__PURE__*/_jsxDEV(Num, {
          label: "Rent rule",
          value: cfg.rentRule,
          onChange: set("rentRule"),
          step: 0.1,
          suffix: "% of invest/mo"
        }, void 0, false), /*#__PURE__*/_jsxDEV(Num, {
          label: "Payback horizon",
          value: cfg.horizon,
          onChange: set("horizon"),
          suffix: "yrs"
        }, void 0, false), /*#__PURE__*/_jsxDEV(Num, {
          label: "Selling costs",
          value: cfg.flipCost,
          onChange: set("flipCost"),
          suffix: "% of ARV"
        }, void 0, false), /*#__PURE__*/_jsxDEV(Num, {
          label: "Min flip ROI",
          value: cfg.flipMin,
          onChange: set("flipMin"),
          suffix: "%"
        }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
          style: {
            fontSize: 11.5,
            color: T.faint,
            maxWidth: 240,
            lineHeight: 1.45
          },
          children: "Payments are principal & interest only. Auction prices are judgment/upset amounts — verify before bidding."
        }, void 0, false)]
      }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
        style: {
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          margin: "16px 0 14px",
          alignItems: "center"
        },
        children: [/*#__PURE__*/_jsxDEV(Chip, {
          active: sourceFilter === "ALL",
          onClick: () => setSourceFilter("ALL"),
          children: "All sources"
        }, void 0, false), /*#__PURE__*/_jsxDEV(Chip, {
          active: sourceFilter === "MLS",
          onClick: () => setSourceFilter("MLS"),
          children: "For sale"
        }, void 0, false), /*#__PURE__*/_jsxDEV(Chip, {
          active: sourceFilter === "AUCTIONS",
          onClick: () => setSourceFilter("AUCTIONS"),
          color: T.auction,
          children: "Sheriff & auctions"
        }, void 0, false), /*#__PURE__*/_jsxDEV("span", {
          style: {
            width: 1,
            height: 22,
            background: T.line,
            margin: "0 4px"
          }
        }, void 0, false), /*#__PURE__*/_jsxDEV(Chip, {
          active: countyFilter === "ALL",
          onClick: () => setCountyFilter("ALL"),
          children: "Both counties"
        }, void 0, false), /*#__PURE__*/_jsxDEV(Chip, {
          active: countyFilter === "New Castle, DE",
          onClick: () => setCountyFilter("New Castle, DE"),
          children: "New Castle"
        }, void 0, false), /*#__PURE__*/_jsxDEV(Chip, {
          active: countyFilter === "Chester, PA",
          onClick: () => setCountyFilter("Chester, PA"),
          children: "Chester"
        }, void 0, false), /*#__PURE__*/_jsxDEV("span", {
          style: {
            width: 1,
            height: 22,
            background: T.line,
            margin: "0 4px"
          }
        }, void 0, false), /*#__PURE__*/_jsxDEV(Chip, {
          active: verdictFilter === "RENT",
          onClick: () => setVerdictFilter(verdictFilter === "RENT" ? "ALL" : "RENT"),
          color: T.rent,
          children: "Rent"
        }, void 0, false), /*#__PURE__*/_jsxDEV(Chip, {
          active: verdictFilter === "FLIP",
          onClick: () => setVerdictFilter(verdictFilter === "FLIP" ? "ALL" : "FLIP"),
          color: T.flip,
          children: "Flip"
        }, void 0, false), /*#__PURE__*/_jsxDEV("select", {
          value: sort,
          onChange: e => setSort(e.target.value),
          style: {
            marginLeft: "auto",
            padding: "6px 8px",
            border: `1px solid ${T.line}`,
            borderRadius: 4,
            background: T.card,
            fontSize: 13,
            fontFamily: "'Public Sans', sans-serif",
            color: T.ink
          },
          children: [/*#__PURE__*/_jsxDEV("option", {
            value: "price",
            children: "Sort: price ↑"
          }, void 0, false), /*#__PURE__*/_jsxDEV("option", {
            value: "payment",
            children: "Sort: payment ↑"
          }, void 0, false), /*#__PURE__*/_jsxDEV("option", {
            value: "flip",
            children: "Sort: flip profit ↓"
          }, void 0, false), /*#__PURE__*/_jsxDEV("option", {
            value: "discount",
            children: "Sort: deepest discount"
          }, void 0, false), /*#__PURE__*/_jsxDEV("option", {
            value: "date",
            children: "Sort: auction date"
          }, void 0, false)]
        }, void 0, true)]
      }, void 0, true), /*#__PURE__*/_jsxDEV("div", {
        style: {
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 14
        },
        children: rows.map(({
          p,
          a
        }) => /*#__PURE__*/_jsxDEV(Card, {
          p: p,
          a: a
        }, p.id + p.address, false))
      }, void 0, false), rows.length === 0 && /*#__PURE__*/_jsxDEV("div", {
        style: {
          textAlign: "center",
          color: T.faint,
          padding: 40,
          fontSize: 14
        },
        children: "No properties match these filters. Clear a filter to see more."
      }, void 0, false), /*#__PURE__*/_jsxDEV("footer", {
        style: {
          marginTop: 28,
          borderTop: `1px solid ${T.line}`,
          paddingTop: 14,
          fontSize: 12.5,
          color: T.faint,
          lineHeight: 1.6
        },
        children: [/*#__PURE__*/_jsxDEV("strong", {
          style: {
            color: T.ink
          },
          children: "Data note:"
        }, void 0, false), " auction records show judgment or upset amounts, not market value — sheriff properties sell as-is, sight unseen, all sales final. Neighborhood medians and rents are estimates you should replace with your own comps. This page is screening, not underwriting."]
      }, void 0, true)]
    }, void 0, true)]
  }, void 0, true);
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/_jsxDEV(App, {}, void 0, false));
