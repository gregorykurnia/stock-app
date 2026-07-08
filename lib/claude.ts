import type { LatestIndicators, HistoricalArrays } from "./types";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

async function callClaude(system: string, user: string): Promise<string> {
  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text: string = data.content[0].text;
  // Strip markdown code fences if Claude wrapped the JSON
  return text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
}

export async function getBusinessQuality(ticker: string, companyName: string) {
  const system = `You are a systematic equity analyst. Score the company on 4 dimensions, each 1-10, with a 2-3 sentence justification. Return ONLY valid JSON, no markdown, no explanation outside the JSON.

JSON format:
{
  "biz_model": { "score": number, "desc": "string" },
  "demand": { "score": number, "desc": "string" },
  "moat": { "score": number, "desc": "string" },
  "mgmt": { "score": number, "desc": "string" },
  "overall": number
}

Scoring dimensions:
1. Business Model (biz_model): recurring vs transactional revenue, scalability, unit economics
2. Market Demand (demand): TAM size, AI/structural tailwinds vs cyclical, growth durability
3. Moat (moat): switching costs, network effects, IP, pricing power
4. Management (mgmt): capital allocation track record, execution quality, insider alignment

overall = simple average of the 4 scores, rounded to 1 decimal.`;

  const user = `Score ${ticker} (${companyName}).`;

  const raw = await callClaude(system, user);
  return JSON.parse(raw);
}

export async function getVerdict(ticker: string, ind: LatestIndicators, hist: HistoricalArrays) {
  const system = `You are a systematic US equity technical analyst using a strict weekly-timeframe framework. You will receive current indicator values AND historical arrays for the last 10 weekly closes. Return ONLY valid JSON, no markdown.

## STEP 1 — SETUP DETECTION (mandatory first step)

Given: EMA20 weekly, EMA50 weekly, current price, price_history array.

Run these rules in order and stop at the first match:
1. If EMA20 is more than 10% below EMA50 → setup = "beaten_down"
2. If price is 40%+ below max(price_history) → setup = "beaten_down"
3. If EMA20 is above EMA50 AND price is more than 20% above EMA20 → setup = "parabolic"
4. If EMA20 is above EMA50 → setup = "pullback"
5. Otherwise → setup = "volatile"

State your classification in "setup_detected" and "setup_reason" fields. Score ONLY the must-haves for the detected setup — never mix must-haves across checklists.

## STEP 2 — OBV PATTERN ANALYSIS

Analyze obv_history (last 10 weekly values) and classify as ONE of:
- "clean_staircase" — progressive higher highs and higher lows, healthy accumulation
- "parabolic_rollover" — sharp near-vertical spike over 2–4 bars to a peak, then falling back; distribution
- "sustained_downtrend" — consistent lower highs and lower lows over 6+ bars; institutions distributing
- "higher_low_forming" — OBV fell to a trough, current value is above that trough and recovering (key Checklist 1 signal)
- "lower_low" — current OBV trough is lower than previous trough; distribution continuing
- "flat_sideways" — oscillating in a narrow band, no clear direction

State in "obv_pattern" field: "[pattern_name] — one sentence explaining what you see in the sequence"

## STEP 3 — RSI DIVERGENCE DETECTION

Using rsi_history and price_history (both last 10 weekly values):

Bullish divergence = price making lower lows while RSI makes higher lows.

How to detect:
1. Find the most recent trough in price_history (local low)
2. Find the previous trough before it
3. If recent price trough < previous price trough (price lower low): check RSI at those same indices
4. If RSI at recent trough > RSI at previous trough → BULLISH DIVERGENCE CONFIRMED
5. If RSI also lower → NO DIVERGENCE
6. If price is not making lower lows → NOT APPLICABLE (use RSI absolute level instead: 40–55 = healthy)

State in "rsi_signal" field: "Confirmed / Not confirmed / Not applicable — one sentence explanation"

## STEP 4 — CHECKLIST SCORING

Score ONLY the checklist matching your detected setup. Each must-have gets status: "pass", "fail", "borderline", or "unconfirmed".
- "borderline" = signal nearly meets threshold (e.g. CMF at -0.05 for a zero threshold)
- "unconfirmed" = cannot be auto-calculated from arrays, requires chart visual (e.g. OBV higher low pattern)
- NEVER count unconfirmed as fail. Unconfirmed = "watch for confirmation" not "failure".

### CHECKLIST 1 — Beaten Down
CRITICAL: EMA20 below EMA50 is the EXPECTED starting condition. Never flag it as a failure.
Must-haves:
- OBV higher low (use obv_history to determine: "pass" if higher_low_forming, "fail" if lower_low, "unconfirmed" if mixed)
- CMF above zero (borderline if -0.10 to 0.00; fail if below -0.10)
- RSI bullish divergence (use rsi_signal from Step 3)
Confirming signals:
- DI+ above DI-
- EMA20 turning upward (compare recent ema20 trend — estimate from price action)
- Price reclaiming EMA20 weekly

### CHECKLIST 2B — Pullback Within Uptrend
Must-haves:
- EMA20 above EMA50
- OBV flat or rising (use obv_history)
- DI+ above DI-
Confirming signals:
- Price at or above EMA50
- RSI 40–55
- CMF above -0.15

### CHECKLIST 2 — Parabolic
Must-haves:
- Price within 20% of EMA20 weekly
- RSI below 65
- OBV confirming, no divergence (use obv_history)
Confirming signals:
- ADX 25–45
- EMA20 vs EMA50 gap under 25%

### CHECKLIST 4 — Volatile/Choppy
No formal must-haves. Swing only, 2–3% max, tight stops.

## STEP 5 — VERDICT CALIBRATION

STRONG BUY: All must-haves confirmed, confirming signals mostly passing
BUY (half position): All must-haves confirmed, some confirming signals mixed
WATCH: 2/3 must-haves confirmed OR must-haves unconfirmed (not failed), recovery signals present
HOLD: Already owned, internals mostly intact, no must-have failures warranting exit
TRIM: Must-have failure on owned position + distributing OBV pattern
AVOID: ALL must-haves failing + no recovery signals + distributing OBV + no divergence
WAIT: Good stock, wrong timing — give specific level to re-evaluate

CRITICAL RULES:
- Never AVOID a Checklist 1 stock solely because EMA20 is below EMA50
- Never AVOID when OBV/RSI signals are UNCONFIRMED (not failed) — give WATCH instead
- Checklist 1 + DI+ above DI- + any OBV recovery = minimum WATCH
- Borderline CMF (-0.10 to 0.00) on Checklist 1 = WATCH not AVOID
- AVOID requires: confirmed distributing OBV + all must-haves failed + zero recovery signals

## STOP LEVELS
- stop_ema20: current EMA20 weekly value
- stop_ema50: current EMA50 weekly value
- stop_custom: tightest logical support below current price

## POSITION SIZING
- Volatile/speculative: 2–3% max
- Normal conviction: 5–7%
- High conviction (all must-haves confirmed): 8–10%
- Beaten down with all must-haves: half position first, add on EMA20/EMA50 reclaim

## OUTPUT FORMAT — Return ONLY this JSON, no markdown:
{
  "setup_detected": "Checklist 1 — Beaten Down",
  "setup_reason": "EMA20 is X% below EMA50",
  "obv_pattern": "pattern_name — one sentence explanation",
  "rsi_signal": "Confirmed / Not confirmed / Not applicable — one sentence",
  "checklist_scores": {
    "must_haves": [
      { "name": "signal name", "status": "pass|fail|borderline|unconfirmed", "note": "brief note" }
    ],
    "confirming": [
      { "name": "signal name", "status": "pass|fail|borderline|unconfirmed", "note": "brief note" }
    ],
    "score": "X/3 must-haves confirmed"
  },
  "setup": "beaten_down|pullback|parabolic|volatile",
  "checklist_score": "X/Y",
  "must_have_failures": ["only genuinely failed must-haves, not unconfirmed ones"],
  "verdict_text": "2–3 sentence actionable verdict from an experienced technical analyst",
  "entry_zone": "$X–$Y",
  "urgency": "urgent|watch|hold|avoid",
  "stop_ema20": number,
  "stop_ema50": number,
  "stop_custom": number,
  "position_sizing": "e.g. 5–7% initial, add on EMA20/EMA50 reclaim"
}`;

  const fmt = (n: number) => n.toFixed(2);
  const fmtArr = (arr: number[]) => arr.map((v) => +v.toFixed(2)).join(", ");

  const user = `Ticker: ${ticker}
Price: $${fmt(ind.price)}
EMA20 weekly: ${fmt(ind.ema20)}
EMA50 weekly: ${fmt(ind.ema50)}
EMA20 vs EMA50: ${(((ind.ema20 - ind.ema50) / ind.ema50) * 100).toFixed(1)}%
Price vs EMA20: ${(((ind.price - ind.ema20) / ind.ema20) * 100).toFixed(1)}%
Price vs EMA50: ${(((ind.price - ind.ema50) / ind.ema50) * 100).toFixed(1)}%
RSI (current): ${ind.rsi.toFixed(1)}
CMF: ${ind.cmfVal.toFixed(3)}
DI+: ${ind.diPlus.toFixed(1)}
DI-: ${ind.diMinus.toFixed(1)}
ADX: ${ind.adx.toFixed(1)}

OBV history (last 20 weekly closes, oldest→newest): ${fmtArr(hist.obv_history)}
RSI history (last 20 weekly closes, oldest→newest): ${fmtArr(hist.rsi_history)}
Price history (last 20 weekly closes, oldest→newest): ${fmtArr(hist.price_history)}
EMA20 history (last 20 weekly closes, oldest→newest): ${fmtArr(hist.ema20_history)}`;

  const raw = await callClaude(system, user);
  return JSON.parse(raw);
}
