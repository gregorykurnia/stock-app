# STOCK ANALYSIS WEB APP — CLAUDE CODE CONTEXT

## PROJECT OVERVIEW

A systematic US stock investment framework web app. Auto-pulls weekly OHLCV data, calculates technical indicators, renders charts, runs Claude AI analysis, and stores verdicts. Built by Greg (founder, systematic investor).

## TECH STACK

| Layer | Tool |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Price + OHLCV | Yahoo Finance unofficial API via allorigins CORS proxy |
| Indicator calculation | technicalindicators (npm package) |
| Chart rendering | lightweight-charts (TradingView, npm package) |
| AI Analysis | Claude API (claude-sonnet-4-6) — call https://api.anthropic.com/v1/messages directly, no API key needed |
| Storage | Firebase Firestore |
| Hosting | Vercel (auto-deploy from GitHub) |

## FOLDER STRUCTURE

```
/app
  /page.tsx                    ← Master Table View (home)
  /stock/[ticker]/page.tsx     ← Stock Detail View
  /portfolio/page.tsx          ← Portfolio Tracker
  /watchlist/page.tsx          ← Watchlist
  /api/yahoo/route.ts          ← Server-side Yahoo Finance proxy
/lib
  /indicators.ts               ← All TA calculations (EMA, OBV, CMF, DI+/-, RSI)
  /yahoo.ts                    ← OHLCV fetching helpers
  /claude.ts                   ← Claude API call wrappers
  /firebase.ts                 ← Firestore helpers + initialization
  /seedData.ts                 ← All 54 stocks hardcoded (scores + meta)
  /types.ts                    ← All TypeScript interfaces
/components
  /StockChart.tsx              ← TradingView lightweight chart + EMA overlays
  /ChecklistPanel.tsx          ← Auto-scored checklist with must-haves flagged
  /VerdictCard.tsx             ← Verdict display + edit + save
  /MasterTable.tsx             ← Sortable/filterable table
  /PortfolioRow.tsx            ← Portfolio tracker row with stop distance
```

## FIREBASE CONFIG

Greg will provide his own Firebase config. Always use this placeholder in `/lib/firebase.ts`:

```typescript
const firebaseConfig = {
  apiKey: "REPLACE_WITH_YOUR_API_KEY",
  authDomain: "REPLACE_WITH_YOUR_AUTH_DOMAIN",
  projectId: "REPLACE_WITH_YOUR_PROJECT_ID",
  storageBucket: "REPLACE_WITH_YOUR_STORAGE_BUCKET",
  messagingSenderId: "REPLACE_WITH_YOUR_MESSAGING_SENDER_ID",
  appId: "REPLACE_WITH_YOUR_APP_ID"
};
```

## FIRESTORE DATA STRUCTURE

```
/stocks/{ticker}/
  meta: { name, industry, sector }
  business_quality: {
    biz_model_score, biz_model_desc,
    demand_score, demand_desc,
    moat_score, moat_desc,
    mgmt_score, mgmt_desc,
    overall_biz_score,
    generated_at
  }
  fundamentals: { rev_growth, gross_margin, op_margin, fcf_margin, roic, fund_score, industry_group }
  valuation: { fwd_pe, peg, ev_ebitda, ev_fcf, val_score, combined_score }
  latest_verdict: {
    setup,              // "beaten_down" | "pullback" | "parabolic" | "volatile"
    checklist_score,    // e.g. "5.5/6"
    must_have_failures, // string[]
    verdict_text,
    entry_zone,
    urgency,            // "urgent" | "watch" | "hold" | "avoid"
    stop_ema20,
    stop_ema50,
    stop_custom,
    position_sizing,
    date
  }
  owned: boolean
  entry_price: number
  position_size_pct: number

/verdict_history/{ticker}/{timestamp}/
  { ...snapshot of latest_verdict }

/portfolio/{ticker}/
  { entry_price, position_size_pct, stop_level, date_entered }

/watchlist/{ticker}/
  { alert_price, entry_zone, verdict, date_added }
```

---

## THE 4-STEP INVESTMENT FRAMEWORK

### Step 1 — Fundamentals Gate
- Revenue growth 15%+ YoY
- Net margin positive
- D/E below 1.0
- Gross margin 20%+

**Industry waivers:**
- D/E waived for: asset-leasing (FTAI), aviation/defense (GEV), software with buybacks (APP, ORCL, CRM)
- Gross margin waived for: EMS/contract manufacturers (JBL, CLS), OSAT, specialty contractors (PWR, FIX, MTZ)
- Infrastructure developers in buildout phase (APLD, IREN, CIFR): use contracted backlog vs market cap instead
- Always check business model before applying hard gates

### Step 1B — Valuation by Industry Type
| Type | Metric |
|---|---|
| Tech/Software | Forward P/E + PEG |
| Industrials | Forward P/E + PEG |
| Power/Infrastructure | EV/EBITDA |
| Asset-leasing | EV/EBITDA + margin expansion |
| EMS/Contract Mfg | EV/EBITDA + operating margin |
| Hypergrowth no earnings | P/S + revenue growth |

- PEG < 1.5 = reasonable
- PEG 1.5–2.5 = slight premium
- PEG > 2.5 = expensive

### Step 2 — Setup Categorization
- Beaten down 40%+ from high → Checklist 1
- Healthy pullback 10–20% → Checklist 2B
- Parabolic near ATH → Checklist 2 (swing only)
- Volatile/choppy → Checklist 4

### Step 3 — Checklists (weekly timeframe always authoritative)

**Checklist 1 — Beaten Down:**
- ✅ MUST: OBV higher low
- ✅ MUST: CMF above zero
- ✅ MUST: RSI bullish divergence
- DI+ cross above DI-
- EMA20 cross above EMA50

**Checklist 2 — Parabolic:**
- ✅ MUST: Price within 20% of EMA20 weekly
- ✅ MUST: RSI below 65
- ✅ MUST: OBV confirming, no divergence
- ADX 25–45
- EMA20 vs EMA50 gap under 25%

**Checklist 2B — Pullback Within Uptrend:**
- ✅ MUST: EMA20 above EMA50
- ✅ MUST: OBV flat or rising
- ✅ MUST: DI+ above DI-
- Price at or above EMA50
- RSI 40–55
- CMF above -0.15

### Step 4 — Exit Framework

**Swing:** EMA21 daily breach = full exit same day

**Long term tiered:**
- Tier 1 early warning: OBV monthly diverging, TICKER/SPY ratio rolling over, RSI monthly lower highs → trim 25–33%
- Tier 2 confirmation: Two closes below EMA50 daily + internals deteriorating → trim 33%
- Tier 3 full exit: Two closes below EMA100 weekly, EMA50 weekly breached on high volume

**Critical internals rule:**
- Two closes below EMA50 daily = check internals hard, NOT automatic trim
- If OBV + CMF + DI+ all still healthy → hold, yellow flag only
- Mandatory trim only when price breach + internals deterioration together
- EMA50 weekly breach = non-negotiable full exit regardless of internals

---

## EMA FRAMEWORK

| EMA | Timeframe | Purpose |
|---|---|---|
| EMA21 daily | Daily | Swing stop |
| EMA50 daily | Daily | Check internals hard if breached |
| EMA20 weekly | Weekly | Best long term entry zone |
| EMA50 weekly | Weekly | Non-negotiable full exit |

---

## OBV PATTERN CLASSIFICATION

Three patterns — critical for verdict:
1. **Clean staircase uptrend** (higher highs, higher lows) = healthy, confirms hold
2. **Parabolic spike then rollover** (vertical run, sharp drop from peak) = distribution, trim 33%
3. **Sustained downtrend** (lower highs + lower lows) = institutions distributing, do not enter

---

## US SWING TABLE — STOCK CATEGORY TAGS

Computed in `components/USSwingTable.tsx` for the "Stock Category" column. Separate from the framework's `setup` field (`beaten_down`/`pullback`/`parabolic`) — a stock can match multiple tags, or none.

| Category | Definition |
|---|---|
| **Limited Upside** | Within 15% below the 5-year high, but it's been more than 75 days since that high was set — sitting quietly under an old ceiling instead of chasing it or falling away from it. |
| **Recent Breakout** | Made a new 2Y high within the last 15 days, is between -1% and 5% from its resistance level, and that resistance was set at least 100 days ago. |
| **Strong Uptrend** | At least 35% above its 6mo low, within 8% of EMA20D, ROC90 above 20%, made a new 2Y high within the last 60 days, and less than 300 days removed from its 1Y low. |
| **Stable Long Term** | At least 300 days removed from its 1Y low, at least 45% above that 1Y low, made a new 2Y high within the last 45 days, at most 50% above its 6mo low, excluding stocks already at a fresh 2Y high (within -0.5% to 0% of it). |
| **Parabolic Recovery** | More than 50% above its 6mo low, but still 28% or more below its 2Y high (can be -28%, -50%, -80%, etc.) — a sharp bounce off the bottom that hasn't reclaimed the old high yet. |
| **Stable Recovery** | Within 6% of EMA20D, at most 40% above its 6mo low, and still 25% or more below its 2Y high (can be -25%, -40%, -50%, etc.) — a steadier, less parabolic bounce off the bottom that's found footing near its short-term trend. |
| **Stable Moderate Upside** | Within 6% of EMA20D, at most 50% above its 6mo low, and 15.01%–24.99% below its 2Y high — a middle zone between Stable Recovery and Limited Upside. |
| **Parabolic** | More than 15% above its resistance level and more than 60% above its 6mo low — a vertical, overextended run well clear of its prior ceiling. |

---

## BUSINESS QUALITY SCORING (Claude Call 1)

4 dimensions, each scored 1–10:
1. **Business Model** — recurring vs transactional, scalability, how it makes money
2. **Market Demand** — TAM, AI tailwinds, structural vs cyclical
3. **Moat** — switching costs, network effects, IP, pricing power
4. **Management** — capital allocation, execution track record, insider alignment

Overall = average of 4 dimensions.

Claude prompt for this call: score each dimension 1–10 with a 2–3 sentence justification paragraph. Return JSON only.

---

## FUNDAMENTALS SCORING (5 metrics, industry-adjusted)

Metrics: Revenue Growth, Gross Margin, Operating Margin, FCF Margin, ROIC
- Higher = better for all 5
- **Industry adjustment for gross margin:** EMS/contractors/industrials/storage/hardware/asset-leasing scored vs peer group only, not vs software
- Score 1–10, normalized across all 54 stocks

**Industry groups:**
- software: APP, ADBE, CRM, WDAY, NOW, HUBS, ZS, NET, CDNS, DOCN, ORCL, SAP, MSFT, INTU
- semi: NVDA, MU, AVGO, ADI, AMAT, ASML, ANET, LRCX, CRDO, MRVL, TSM, ARM, AMD, TER, KEYS
- ems: JBL, CLS
- ems_hardware: DELL, HPE
- contractor: PWR, FIX, MTZ
- industrial: GEV, GE, CAT, HWM, GWW, VRT
- hypergrowth: SE, SHOP, DUOL
- fintech: HOOD
- storage: STX, WDC
- hardware: GLW
- asset_lease: FTAI
- adtech: META, GOOG
- cloud_retail: AMZN
- consumer_tech: AAPL

---

## VALUATION SCORING (4 metrics)

Metrics: Forward PE, PEG, EV/EBITDA, EV/FCF
- Lower = better (cheaper = higher score)
- Score 1–10, normalized across all 54 stocks
- N/A data points excluded from average, not penalized

---

## CLAUDE API INTEGRATION

### Call 1 — Business Quality
```typescript
// System prompt: 4-dimension scoring framework
// Return JSON: { biz_model: { score, desc }, demand: { score, desc }, moat: { score, desc }, mgmt: { score, desc }, overall: number }
```

### Call 2 — Chart Analysis + Verdict
```typescript
// Input: all calculated indicator values (EMA20W, EMA50W, OBV pattern, CMF, DI+, DI-, RSI, price)
// System prompt: full framework rules, checklist must-haves, exit rules, OBV patterns, industry waivers
// Return JSON: { setup, checklist_score, must_have_failures[], verdict_text, entry_zone, urgency, stop_ema20, stop_ema50, position_sizing }
```

### Two modes:
- **Auto mode**: Claude generates verdict on new stock load (no saved verdict exists)
- **Review mode**: loads saved Firestore verdict, Claude only runs on explicit "Re-analyze" click

---

## SEED DATA — ALL 54 STOCKS

### Combined Power Rankings (Val Score + Fund Score, 50/50 weight)

```typescript
// In /lib/seedData.ts
export const SEED_STOCKS = [
  { ticker: "APP",  industry: "software",      val: 8.9, fund: 8.0, combined: 8.4 },
  { ticker: "MU",   industry: "semi",          val: 9.8, fund: 7.1, combined: 8.4 },
  { ticker: "NVDA", industry: "semi",          val: 9.3, fund: 6.9, combined: 8.1 },
  { ticker: "ADBE", industry: "software",      val: 9.7, fund: 5.6, combined: 7.6 },
  { ticker: "HPE",  industry: "ems_hardware",  val: 9.7, fund: 5.2, combined: 7.4 },
  { ticker: "ANET", industry: "semi",          val: 7.9, fund: 6.7, combined: 7.3 },
  { ticker: "CRDO", industry: "semi",          val: 7.9, fund: 6.8, combined: 7.3 },
  { ticker: "INTU", industry: "software",      val: 9.6, fund: 5.0, combined: 7.3 },
  { ticker: "AVGO", industry: "semi",          val: 9.0, fund: 5.4, combined: 7.2 },
  { ticker: "DUOL", industry: "hypergrowth",   val: 9.1, fund: 5.4, combined: 7.2 },
  { ticker: "META", industry: "adtech",        val: 9.3, fund: 5.2, combined: 7.2 },
  { ticker: "TSM",  industry: "semi",          val: 9.2, fund: 5.3, combined: 7.2 },
  { ticker: "CRM",  industry: "software",      val: 9.6, fund: 4.6, combined: 7.1 },
  { ticker: "SAP",  industry: "software",      val: 9.7, fund: 4.5, combined: 7.1 },
  { ticker: "MSFT", industry: "software",      val: 9.0, fund: 5.0, combined: 7.0 },
  { ticker: "WDAY", industry: "software",      val: 9.6, fund: 4.3, combined: 6.9 },
  { ticker: "ADI",  industry: "semi",          val: 8.8, fund: 4.8, combined: 6.8 },
  { ticker: "NOW",  industry: "software",      val: 9.0, fund: 4.6, combined: 6.8 },
  { ticker: "GOOG", industry: "adtech",        val: 8.9, fund: 4.4, combined: 6.7 },
  { ticker: "HOOD", industry: "fintech",       val: 6.9, fund: 6.5, combined: 6.7 },
  { ticker: "ASML", industry: "semi",          val: 8.6, fund: 4.6, combined: 6.6 },
  { ticker: "HUBS", industry: "software",      val: 9.0, fund: 4.2, combined: 6.6 },
  { ticker: "ORCL", industry: "software",      val: 9.4, fund: 3.5, combined: 6.5 },
  { ticker: "WDC",  industry: "storage",       val: 8.8, fund: 4.2, combined: 6.5 },
  { ticker: "AAPL", industry: "consumer_tech", val: 8.0, fund: 4.8, combined: 6.4 },
  { ticker: "KEYS", industry: "semi",          val: 8.6, fund: 4.2, combined: 6.4 },
  { ticker: "SE",   industry: "hypergrowth",   val: 9.0, fund: 3.8, combined: 6.4 },
  { ticker: "STX",  industry: "storage",       val: 8.6, fund: 4.2, combined: 6.4 },
  { ticker: "LRCX", industry: "semi",          val: 7.8, fund: 4.8, combined: 6.3 },
  { ticker: "FTAI", industry: "asset_lease",   val: 9.0, fund: 3.4, combined: 6.2 },
  { ticker: "ZS",   industry: "software",      val: 8.6, fund: 3.8, combined: 6.2 },
  { ticker: "AMZN", industry: "cloud_retail",  val: 8.8, fund: 3.4, combined: 6.1 },
  { ticker: "CDNS", industry: "software",      val: 7.3, fund: 4.9, combined: 6.1 },
  { ticker: "DELL", industry: "ems_hardware",  val: 9.2, fund: 3.0, combined: 6.1 },
  { ticker: "FIX",  industry: "contractor",    val: 8.7, fund: 3.5, combined: 6.1 },
  { ticker: "TER",  industry: "semi",          val: 7.9, fund: 4.3, combined: 6.1 },
  { ticker: "AMAT", industry: "semi",          val: 8.0, fund: 4.0, combined: 6.0 },
  { ticker: "JBL",  industry: "ems",           val: 9.3, fund: 2.6, combined: 6.0 },
  { ticker: "VRT",  industry: "industrial",    val: 8.3, fund: 3.7, combined: 6.0 },
  { ticker: "CLS",  industry: "ems",           val: 8.8, fund: 2.9, combined: 5.9 },
  { ticker: "HWM",  industry: "industrial",    val: 7.8, fund: 3.7, combined: 5.8 },
  { ticker: "AMD",  industry: "semi",          val: 7.5, fund: 3.8, combined: 5.7 },
  { ticker: "CAT",  industry: "industrial",    val: 8.1, fund: 3.2, combined: 5.7 },
  { ticker: "GWW",  industry: "industrial",    val: 8.2, fund: 3.2, combined: 5.7 },
  { ticker: "MRVL", industry: "semi",          val: 7.4, fund: 3.9, combined: 5.7 },
  { ticker: "SHOP", industry: "hypergrowth",   val: 7.4, fund: 3.9, combined: 5.7 },
  { ticker: "DOCN", industry: "software",      val: 7.0, fund: 4.0, combined: 5.5 },
  { ticker: "GE",   industry: "industrial",    val: 7.5, fund: 3.5, combined: 5.5 },
  { ticker: "GLW",  industry: "hardware",      val: 7.6, fund: 3.3, combined: 5.4 },
  { ticker: "GEV",  industry: "industrial",    val: 7.7, fund: 3.0, combined: 5.3 },
  { ticker: "MTZ",  industry: "contractor",    val: 8.1, fund: 2.4, combined: 5.2 },
  { ticker: "PWR",  industry: "contractor",    val: 7.7, fund: 2.6, combined: 5.2 },
  { ticker: "ARM",  industry: "semi",          val: 1.6, fund: 4.9, combined: 3.2 },
  { ticker: "NET",  industry: "software",      val: 1.6, fund: 3.5, combined: 2.5 },
]
```

### Raw Fundamentals Data

```typescript
export const FUNDAMENTALS_RAW = {
  MU:   { rev_growth: 1.6698, gross_margin: 0.7257, op_margin: 0.6563, fcf_margin: 0.2899, roic: 0.6759 },
  ADBE: { rev_growth: 0.1149, gross_margin: 0.8940, op_margin: 0.3607, fcf_margin: 0.4080, roic: 0.5917 },
  INTU: { rev_growth: 0.1496, gross_margin: 0.8077, op_margin: 0.2748, fcf_margin: 0.3710, roic: 0.2069 },
  HPE:  { rev_growth: 0.2258, gross_margin: 0.8340, op_margin: 0.5392, fcf_margin: 0.1028, roic: 0.6775 },
  CRM:  { rev_growth: 0.1098, gross_margin: 0.7764, op_margin: 0.2040, fcf_margin: 0.3423, roic: 0.1042 },
  WDAY: { rev_growth: 0.1332, gross_margin: 0.7513, op_margin: 0.1034, fcf_margin: 0.3016, roic: 0.1111 },
  HUBS: { rev_growth: 0.2107, gross_margin: 0.8366, op_margin: 0.0010, fcf_margin: 0.2252, roic: 0.0056 },
  ORCL: { rev_growth: 0.1735, gross_margin: 0.6582, op_margin: 0.3059, fcf_margin: -0.3516, roic: 0.1124 },
  META: { rev_growth: 0.2618, gross_margin: 0.8194, op_margin: 0.4121, fcf_margin: 0.2245, roic: 0.2987 },
  SAP:  { rev_growth: 0.0625, gross_margin: 0.7313, op_margin: 0.2742, fcf_margin: 0.2164, roic: 0.1680 },
  NVDA: { rev_growth: 0.7068, gross_margin: 0.7415, op_margin: 0.6402, fcf_margin: 0.4697, roic: 1.1735 },
  MSFT: { rev_growth: 0.1788, gross_margin: 0.6831, op_margin: 0.4680, fcf_margin: 0.2291, roic: 0.3210 },
  JBL:  { rev_growth: 0.1780, gross_margin: 0.0923, op_margin: 0.0428, fcf_margin: 0.0389, roic: 0.2738 },
  DELL: { rev_growth: 0.3857, gross_margin: 0.1907, op_margin: 0.0794, fcf_margin: 0.0705, roic: 0.2256 },
  TSM:  { rev_growth: 0.3066, gross_margin: 0.6187, op_margin: 0.5331, fcf_margin: 0.2573, roic: 0.5320 },
  AVGO: { rev_growth: 0.3229, gross_margin: 0.6828, op_margin: 0.4339, fcf_margin: 0.4341, roic: 0.2380 },
  NOW:  { rev_growth: 0.2172, gross_margin: 0.7656, op_margin: 0.1344, fcf_margin: 0.3319, roic: 0.1534 },
  SE:   { rev_growth: 0.4054, gross_margin: 0.4427, op_margin: 0.0842, fcf_margin: 0.1966, roic: 0.2423 },
  ADI:  { rev_growth: 0.2975, gross_margin: 0.6449, op_margin: 0.3250, fcf_margin: 0.3583, roic: 0.0904 },
  FTAI: { rev_growth: 0.4846, gross_margin: 0.4269, op_margin: 0.2682, fcf_margin: -0.1675, roic: 0.1804 },
  KEYS: { rev_growth: 0.1919, gross_margin: 0.6367, op_margin: 0.1817, fcf_margin: 0.2229, roic: 0.1494 },
  AMZN: { rev_growth: 0.1422, gross_margin: 0.5060, op_margin: 0.1150, fcf_margin: -0.0033, roic: 0.1424 },
  GOOG: { rev_growth: 0.1745, gross_margin: 0.6037, op_margin: 0.3269, fcf_margin: 0.1525, roic: 0.2881 },
  GWW:  { rev_growth: 0.0661, gross_margin: 0.3915, op_margin: 0.1423, fcf_margin: 0.0750, roic: 0.3008 },
  CLS:  { rev_growth: 0.3672, gross_margin: 0.1202, op_margin: 0.0859, fcf_margin: 0.0356, roic: 0.4123 },
  APP:  { rev_growth: 0.8539, gross_margin: 0.8837, op_margin: 0.7709, fcf_margin: 0.7188, roic: 1.2846 },
  ZS:   { rev_growth: 0.2461, gross_margin: 0.7665, op_margin: -0.0473, fcf_margin: 0.3036, roic: -0.5533 },
  AAPL: { rev_growth: 0.1276, gross_margin: 0.4786, op_margin: 0.3264, fcf_margin: 0.2861, roic: 1.0433 },
  STX:  { rev_growth: 0.2892, gross_margin: 0.4154, op_margin: 0.2818, fcf_margin: 0.2191, roic: 0.7137 },
  WDC:  { rev_growth: 0.3204, gross_margin: 0.4543, op_margin: 0.3031, fcf_margin: 0.2467, roic: 0.3435 },
  FIX:  { rev_growth: 0.3843, gross_margin: 0.2513, op_margin: 0.1207, fcf_margin: 0.1364, roic: 0.6182 },
  CAT:  { rev_growth: 0.1185, gross_margin: 0.3344, op_margin: 0.1648, fcf_margin: 0.1117, roic: 0.1588 },
  CRDO: { rev_growth: 2.0568, gross_margin: 0.6804, op_margin: 0.3333, fcf_margin: 0.3048, roic: 0.7361 },
  MTZ:  { rev_growth: 0.2259, gross_margin: 0.1282, op_margin: 0.0093, fcf_margin: 0.0168, roic: 0.0191 },
  AMAT: { rev_growth: 0.0333, gross_margin: 0.4896, op_margin: 0.2859, fcf_margin: 0.1841, roic: 0.3247 },
  VRT:  { rev_growth: 0.2895, gross_margin: 0.3715, op_margin: 0.1825, fcf_margin: 0.2104, roic: 0.3156 },
  ASML: { rev_growth: 0.0970, gross_margin: 0.5260, op_margin: 0.3479, fcf_margin: 0.2662, roic: 0.6342 },
  ANET: { rev_growth: 0.3057, gross_margin: 0.6354, op_margin: 0.4279, fcf_margin: 0.5474, roic: 2.4521 },
  CDNS: { rev_growth: 0.1342, gross_margin: 0.8608, op_margin: 0.2825, fcf_margin: 0.2586, roic: 0.1763 },
  LRCX: { rev_growth: 0.2653, gross_margin: 0.4998, op_margin: 0.3426, fcf_margin: 0.2770, roic: 0.7388 },
  PWR:  { rev_growth: 0.2109, gross_margin: 0.1510, op_margin: 0.0568, fcf_margin: 0.0558, roic: 0.0877 },
  TER:  { rev_growth: 0.3032, gross_margin: 0.5870, op_margin: 0.2647, fcf_margin: 0.1461, roic: 0.3033 },
  GE:   { rev_growth: 0.2175, gross_margin: 0.3606, op_margin: 0.1839, fcf_margin: 0.1543, roic: 0.2805 },
  DUOL: { rev_growth: 0.3545, gross_margin: 0.7267, op_margin: 0.1424, fcf_margin: 0.3786, roic: 1.2237 },
  MRVL: { rev_growth: 0.3407, gross_margin: 0.5150, op_margin: 0.1597, fcf_margin: 0.1911, roic: 0.0680 },
  HWM:  { rev_growth: 0.1424, gross_margin: 0.3505, op_margin: 0.2673, fcf_margin: 0.1920, roic: 0.2478 },
  GLW:  { rev_growth: 0.2005, gross_margin: 0.3636, op_margin: 0.1515, fcf_margin: 0.1195, roic: 0.1071 },
  HOOD: { rev_growth: 0.3825, gross_margin: 0.9521, op_margin: 0.4628, fcf_margin: 0.6529, roic: 0.3934 },
  GEV:  { rev_growth: 0.1027, gross_margin: 0.1993, op_margin: 0.0387, fcf_margin: 0.1911, roic: 0.3291 },
  AMD:  { rev_growth: 0.3497, gross_margin: 0.5028, op_margin: 0.1165, fcf_margin: 0.1500, roic: 0.0639 },
  SHOP: { rev_growth: 0.3185, gross_margin: 0.4797, op_margin: 0.1332, fcf_margin: 0.1714, roic: 0.2223 },
  DOCN: { rev_growth: 0.1761, gross_margin: 0.5849, op_margin: 0.1644, fcf_margin: 0.1812, roic: 0.1005 },
  ARM:  { rev_growth: 0.2279, gross_margin: 0.9754, op_margin: 0.1829, fcf_margin: 0.1990, roic: 0.1434 },
  NET:  { rev_growth: 0.3155, gross_margin: 0.7333, op_margin: -0.0927, fcf_margin: 0.1377, roic: -0.2746 },
}
```

### Raw Valuation Data

```typescript
export const VALUATION_RAW = {
  MU:   { fwd_pe: 6.86,   peg: 0.04,  ev_ebitda: 14.75,  ev_fcf: 38.44  },
  ADBE: { fwd_pe: 8.41,   peg: 0.60,  ev_ebitda: 9.46,   ev_fcf: 8.95   },
  INTU: { fwd_pe: 10.16,  peg: 0.66,  ev_ebitda: 11.87,  ev_fcf: 9.81   },
  HPE:  { fwd_pe: 11.20,  peg: 0.38,  ev_ebitda: 12.99,  ev_fcf: 18.34  },
  CRM:  { fwd_pe: 11.88,  peg: 0.73,  ev_ebitda: 13.28,  ev_fcf: 11.68  },
  WDAY: { fwd_pe: 12.43,  peg: 0.59,  ev_ebitda: 22.18,  ev_fcf: 11.28  },
  HUBS: { fwd_pe: 14.14,  peg: 0.46,  ev_ebitda: 103.09, ev_fcf: 12.21  },
  ORCL: { fwd_pe: 17.87,  peg: 0.63,  ev_ebitda: 17.61,  ev_fcf: null   },
  META: { fwd_pe: 18.29,  peg: 0.88,  ev_ebitda: 14.13,  ev_fcf: 32.01  },
  SAP:  { fwd_pe: 18.84,  peg: null,  ev_ebitda: 13.81,  ev_fcf: 20.00  },
  NVDA: { fwd_pe: 19.68,  peg: 0.44,  ev_ebitda: 28.03,  ev_fcf: 38.97  },
  MSFT: { fwd_pe: 20.89,  peg: 1.29,  ev_ebitda: 15.83,  ev_fcf: 40.05  },
  JBL:  { fwd_pe: 21.52,  peg: 0.75,  ev_ebitda: 14.94,  ev_fcf: 27.42  },
  DELL: { fwd_pe: 22.22,  peg: 0.84,  ev_ebitda: 20.49,  ev_fcf: 30.52  },
  TSM:  { fwd_pe: 22.54,  peg: null,  ev_ebitda: 21.32,  ev_fcf: 57.88  },
  AVGO: { fwd_pe: 23.75,  peg: 0.52,  ev_ebitda: 42.84,  ev_fcf: 55.02  },
  NOW:  { fwd_pe: 24.89,  peg: 1.00,  ev_ebitda: 37.46,  ev_fcf: 23.35  },
  SE:   { fwd_pe: 25.54,  peg: 1.35,  ev_ebitda: 22.88,  ev_fcf: 12.27  },
  ADI:  { fwd_pe: 27.43,  peg: 1.25,  ev_ebitda: 30.48,  ev_fcf: 41.06  },
  FTAI: { fwd_pe: 27.75,  peg: 0.81,  ev_ebitda: 27.30,  ev_fcf: null   },
  KEYS: { fwd_pe: 28.54,  peg: 1.52,  ev_ebitda: 37.20,  ev_fcf: 39.20  },
  AMZN: { fwd_pe: 29.15,  peg: 1.36,  ev_ebitda: 17.44,  ev_fcf: null   },
  GOOG: { fwd_pe: 29.17,  peg: null,  ev_ebitda: 27.48,  ev_fcf: 68.79  },
  GWW:  { fwd_pe: 29.42,  peg: 2.47,  ev_ebitda: 21.33,  ev_fcf: 47.72  },
  CLS:  { fwd_pe: 29.78,  peg: null,  ev_ebitda: 29.58,  ev_fcf: 83.07  },
  APP:  { fwd_pe: 31.31,  peg: 0.84,  ev_ebitda: 37.72,  ev_fcf: 41.40  },
  ZS:   { fwd_pe: 33.91,  peg: 1.46,  ev_ebitda: null,   ev_fcf: 23.51  },
  AAPL: { fwd_pe: 34.31,  peg: 2.99,  ev_ebitda: 28.43,  ev_fcf: 35.21  },
  STX:  { fwd_pe: 35.54,  peg: 0.49,  ev_ebitda: 53.52,  ev_fcf: 77.97  },
  WDC:  { fwd_pe: 36.19,  peg: 0.49,  ev_ebitda: 45.07,  ev_fcf: 60.94  },
  FIX:  { fwd_pe: 37.15,  peg: 1.10,  ev_ebitda: 35.87,  ev_fcf: 45.03  },
  CAT:  { fwd_pe: 38.19,  peg: 2.17,  ev_ebitda: 33.42,  ev_fcf: 61.57  },
  CRDO: { fwd_pe: 38.61,  peg: 0.96,  ev_ebitda: 90.38,  ev_fcf: 106.52 },
  MTZ:  { fwd_pe: 39.01,  peg: 1.26,  ev_ebitda: 26.97,  ev_fcf: 126.34 },
  AMAT: { fwd_pe: 40.10,  peg: 1.60,  ev_ebitda: 50.64,  ev_fcf: 87.91  },
  VRT:  { fwd_pe: 42.98,  peg: 1.44,  ev_ebitda: 47.90,  ev_fcf: 50.04  },
  ASML: { fwd_pe: 43.57,  peg: null,  ev_ebitda: 44.92,  ev_fcf: 64.16  },
  ANET: { fwd_pe: 45.92,  peg: 2.61,  ev_ebitda: 47.01,  ev_fcf: 37.74  },
  CDNS: { fwd_pe: 46.17,  peg: 3.22,  ev_ebitda: 51.26,  ev_fcf: 72.20  },
  LRCX: { fwd_pe: 46.43,  peg: 2.10,  ev_ebitda: 51.50,  ev_fcf: 67.31  },
  PWR:  { fwd_pe: 46.67,  peg: 2.67,  ev_ebitda: 39.42,  ev_fcf: 66.40  },
  TER:  { fwd_pe: 47.92,  peg: 1.64,  ev_ebitda: 44.66,  ev_fcf: 93.78  },
  GE:   { fwd_pe: 48.84,  peg: 3.24,  ev_ebitda: 36.77,  ev_fcf: 54.44  },
  DUOL: { fwd_pe: 50.82,  peg: null,  ev_ebitda: 28.48,  ev_fcf: 12.14  },
  MRVL: { fwd_pe: 50.90,  peg: 1.55,  ev_ebitda: 80.93,  ev_fcf: 131.80 },
  HWM:  { fwd_pe: 52.70,  peg: 2.09,  ev_ebitda: 44.36,  ev_fcf: 68.60  },
  GLW:  { fwd_pe: 54.33,  peg: 1.99,  ev_ebitda: 42.63,  ev_fcf: 111.03 },
  HOOD: { fwd_pe: 57.09,  peg: 3.36,  ev_ebitda: null,   ev_fcf: 33.27  },
  GEV:  { fwd_pe: 62.15,  peg: 1.97,  ev_ebitda: 80.29,  ev_fcf: 36.43  },
  AMD:  { fwd_pe: 63.17,  peg: 1.07,  ev_ebitda: 110.24, ev_fcf: 95.53  },
  SHOP: { fwd_pe: 63.36,  peg: 2.19,  ev_ebitda: 71.63,  ev_fcf: 72.58  },
  DOCN: { fwd_pe: 123.83, peg: null,  ev_ebitda: 53.34,  ev_fcf: 91.68  },
  ARM:  { fwd_pe: 148.47, peg: 4.82,  ev_ebitda: 303.42, ev_fcf: 329.98 },
  NET:  { fwd_pe: 202.71, peg: 4.43,  ev_ebitda: null,   ev_fcf: 289.75 },
}
```

---

## BUILD PHASES — DO THESE IN ORDER

### Phase 1 — Data + Chart (build first, get working before moving on)
1. Ticker input field
2. Fetch weekly OHLCV from Yahoo Finance via allorigins proxy (server route `/api/yahoo`)
3. Calculate client-side: EMA20, EMA50, RSI, OBV, CMF, DI+, DI- using `technicalindicators` npm package
4. Render weekly candlestick chart + EMA20/EMA50 overlaid using `lightweight-charts`
5. Display all indicator values numerically below chart
6. Auto-score the relevant checklist with must-haves flagged

### Phase 2 — Claude API Verdict
- Call 2 (Chart + Verdict): pass all indicator values, return setup + checklist + verdict + entry + stops
- Call 1 (Business Quality): 4 dimension scores + paragraphs
- Save/load from Firestore

### Phase 3 — Master Table View
- Load all 54 stocks from seed data
- Pull live price + indicators for each
- Sortable, filterable, color-coded

### Phase 4 — Portfolio Tracker + Watchlist
- Portfolio: entry price, P&L%, stop distance, action flags
- Watchlist: alert prices, one-click move to portfolio

---

## AUTO-PUSH TO GITHUB

Always end every session by running:
```bash
git add -A && git commit -m "auto-save: [brief description]" && git push
```

---

## KEY RULES

- Weekly timeframe is always authoritative for all indicator readings
- Never full position on first entry regardless of conviction
- Post-parabolic collapses almost always retrace to pre-parabolic base — never average down
- Speculative plays (NBIS, APLD, IREN, ASTS) = 2–3% max position size
- Software/platform stocks = hold through rate hike risk
- Hardware/infrastructure = trim on weakness, AI capex dependent

---

## US-SWING CHAT — RESPONSE STYLE (reference copy)

The live system prompt for the US-Swing embedded chat assistant lives in `stock-app/lib/claude.ts` (`askSwingChat` function). This is a reference copy so the tone/style can be checked without opening the code. If the two ever diverge, the code is the source of truth — update this copy to match.

```
You are a swing/midterm portfolio construction assistant embedded in a stock screener. You have access to the full screener data for the current session, including each stock's computed Grand Score and component scores (Price & Trend, Momentum, Price Levels, Trend Strength, Liquidity & Events).

## WHO YOU'RE TALKING TO

A financially literate retail investor building a 6-slot US equity swing portfolio with 4-8 week holds. He knows his metrics, doesn't need hand-holding, and wants honest reads not diplomatic ones. Code-switch English/Indonesian naturally if he does.

## WHAT YOU DO

You help him figure out which stocks belong in the portfolio — ranking them, comparing them, building compositions, finding names that fit a theme, or giving a gut-check on the current list. You answer whatever he asks, in whatever form he asks it.

If he asks for the best 6, give him the best 6.
If he asks for multiple portfolio compositions, build them and explain the logic behind each.
If he asks which is better between two names, tell him directly and explain why.
If he asks to find names with a specific characteristic, scan the list and surface them.
If he asks about a single stock, give a one-line gut read, what's working, what's not, how it stacks up against the rest of the list, and a clear actionable verdict: buy now / wait / pass / watchlist.
If he asks a follow-up, flow naturally from what was already discussed — don't restart from scratch.

## WHAT'S IN THE DATA

These are the columns available for each stock, grouped by how much weight they carry in the actual verdict:

**Drives the verdict — read these actively for every stock:**
- ROC14 — short-term price momentum, is it actually moving right now
- Sortino 3m — momentum quality, risk-adjusted return over 3 months
- MACD — trend momentum confirmation, direction and conviction
- ADX — trend strength, how much conviction is behind the move
- DI+ / DI- spread — trend direction dominance, DI+ clearly above DI- = bullish confirmation
- Dist EMA20D% — short-term trend health, how close price is to the 20-day moving average
- Dist EMA50D% — medium-term extension check. Too far above = stretched, flag it. Don't recommend something already extended far from its 50
- Dist from Resistance% — room below resistance is upside potential, not a penalty. Already above = confirmed breakout
- Dist from 6mo Low% — where in the recovery cycle the stock sits. Too close to the low = risky entry. Too far = you've missed the move. Sweet spot is mid-recovery, not at the bottom and not already extended
- Days to Earnings — proximity risk. Flag at 14 days, hard no at 7 days or under
- Short Float% — high short interest = contested name, very high = risk flag

**Adds color and context — use to support or question the verdict:**
- Sortino 6m — whether momentum quality has been consistent over a longer period
- ROC63 / ROC90 — trend duration, confirms whether the move has been building over months not just days
- Golden Cross age — early cross is best entry zone, aged cross is fine if momentum data is still alive
- CAGR from 1Y Low% — pace of recovery. Very high = stock may have already run too far from its base
- Dist from 2Y High% — historical extension context

**Sanity checks — only surface if something looks off:**
- ATR% — daily volatility, flag if unusually high or unusually flat
- ADV / Rel Volume — liquidity and whether today's volume confirms the move
- RSI — temperature check, only relevant at extremes

**Scores — starting reference, not the verdict:**
- Grand Score and component scores are useful to sort and get a first pass, but always read the actual numbers behind them. A high score with weak Sort3m and earnings in 10 days is not a good stock. A slightly lower score with clean momentum and structure might be the better trade.

## HOW YOU THINK

You read stocks the way an experienced trader would — looking at the full picture, not running a checklist. The Grand Score and component scores are a useful starting reference but not the verdict.

You always evaluate each name relative to the others in the list — a recommendation means it earned that slot over the other names available, not just that it looks okay in isolation.

Read the momentum picture as a whole — ROC14, Sortino 3m, MACD together tell you whether momentum is real and quality. No single one leads. Trend structure tells you whether the move has conviction — ADX strength, DI+ dominance, EMA distances all paint that picture together. Price position tells you the opportunity — room below resistance is upside, where a stock sits in its recovery cycle tells you whether the entry is early, timely, or already late.

An old golden cross with live momentum data is still a valid trend. A fresh cross with weak ADX and flat Sortino is not. A stock extended far above its EMA50 or already deep into its recovery from the low is a flag regardless of how clean everything else looks — you don't want to chase.

Composition matters. When building a portfolio, 6 names that complement each other across sectors and trend characters beats 6 names that all move together. Actively think about what role each name plays and whether the 6 together form a coherent portfolio.

## HOW YOU RESPOND

Match the format to what he asked. Answer conversationally — don't write reports. No headers, no horizontal rules, no heavy structure. Light bullets where they help, bold only when something genuinely needs to stand out. This is a conversation not an analyst note.

Rankings get a clean table then a short conversational paragraph on what stands out. Comparisons get stripped down to what actually differentiates the names with a clear verdict. Open-ended questions get answered naturally.

He marks his actual current 6 holdings in the screener — a "CURRENT SWING PORTFOLIO" line up top lists them, and each of their ticker lines carries an "[IN PORTFOLIO]" tag. That's ground truth for what he's holding right now, not something to infer or guess. When he asks "what should my portfolio be" and he already has names marked, treat that as a review of the current holdings — should each stay or go — not a cold build from scratch, unless he explicitly asks you to build fresh. When comparing or ranking, note when a name is already one of his 6 vs. a candidate to swap in.

When he asks what his portfolio should be — give the 6 names, the role each one plays, one honest flag per name if there is one, and a short read on what kind of portfolio this composition is overall.

Keep it tight. Only surface what actually matters for the decision. If something is clean, say it's clean. If something is a problem, say it directly. Proactively flag earnings proximity and overextension when recommending names — don't wait to be asked.

Never pad with disclaimers. Never mention analyst targets unless he asks. Never recommend more than 6 for the portfolio unless he specifically wants more options.

## ALWAYS KNOW

- 6 slots, Rp25 juta each, 4-8 week signal-driven holds
- 0.25% transaction cost each side — small edges don't justify entries
- Hard stop -12%, trailing stop 6% below peak once profitable
- Default exit before earnings, partial hold ok if well in profit
- Earnings within 14 days = flag it. Within 7 days = don't enter
- Preference for recovery/runway names over chasing ATH
- Composition matters — sector and character diversity across the 6 slots

## DATA FORMAT NOTES

Each ticker's line carries a "[...]" bracket listing its Stock Category tag(s) (e.g. "Strong Uptrend", "Parabolic Recovery", "Limited Upside") — computed programmatically, not by you. Treat them as ground truth; never recompute or invent a category not in the bracket.

Category definitions (reference only):
- Limited Upside: within 15% below the 2Y high, 75+ days since that high.
- Recent Breakout: new 2Y high within 15 days, -1% to 5% from resistance, resistance set 100+ days ago.
- Strong Uptrend: 35%+ above 6mo low, within 8% of EMA20D, ROC90 > 20%, new 2Y high within 60 days, <300 days since 1Y low.
- Stable Long Term: 300+ days since 1Y low, 45%+ above that low, new 2Y high within 45 days, at most 50% above 6mo low, excluding names already at a fresh 2Y high.
- Parabolic Recovery: 47%+ above 6mo low but still 28%+ below 2Y high.
- Stable Recovery: within 6% of EMA20D, at most 40% above 6mo low, still 25%+ below 2Y high.
- Stable Moderate Upside: within 6% of EMA20D, at most 50% above 6mo low, 15.01-24.99% below 2Y high.
- Parabolic: more than 15% above resistance and more than 60% above 6mo low.
A ticker can carry multiple tags or none.

Each line also carries the Grand Score and its 5 weighted components (Price&Trend 30%, Trend Strength 25%, Momentum 22%, Price Levels 18%, Liquidity 5%), each 0-10. These are also precomputed — use them as your starting reference point, not the raw inputs.

If a NOTE at the top says the data was pre-filtered to specific stock categories, treat that filtered set as the entire scope of "my list" / "these stocks" / "the screener" for this conversation unless he explicitly names a ticker outside it.
```
