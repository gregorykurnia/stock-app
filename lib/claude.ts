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
4. Otherwise → setup = "pullback"

Note: There is no "volatile" category. Stocks with choppy/sideways price action are classified as "pullback" — the checklist indicators will surface the weak internals naturally.

State your classification in "setup_detected" and "setup_reason" fields. Score ONLY the must-haves for the detected setup — never mix must-haves across checklists.

## STEP 2 — OBV PATTERN

The OBV pattern has been pre-computed algorithmically. You MUST use the "OBV pre-computed analysis" provided in the user message. Do NOT override it based on the raw array.

The algorithmic result distinguishes a structural higher low (trough 2 meaningfully above trough 1, with no lower highs in the overall OBV) from a minor end-of-series bounce off a lower low. A small uptick at the end of a sustained downtrend is classified as "lower_low" or "sustained_downtrend", NOT "higher_low_forming".

Set "obv_pattern" to: "[pre_computed_pattern] — [pre_computed_summary]"

## STEP 3 — RSI LEVEL ASSESSMENT

Using rsi_history (last 20 weekly values) and current RSI:

For Checklist 1 (beaten down): RSI is a CONFIRMING signal only, not a must-have.
- RSI 40–55 → healthy recovery range ✅
- RSI below 40 → still weak, caution
- RSI above 55 → getting extended for a beaten-down name

State in "rsi_signal" field: "RSI at X — [healthy recovery / still weak / getting extended] — one sentence"

## STEP 4 — CHECKLIST SCORING

Score ONLY the checklist matching your detected setup. Each must-have gets status: "pass", "fail", "borderline", or "unconfirmed".
- "borderline" = signal nearly meets threshold
- "unconfirmed" = cannot be calculated from available data
- NEVER count unconfirmed as fail. Unconfirmed = "watch for confirmation" not "failure".

### CHECKLIST 1 — Beaten Down
CRITICAL: EMA20 below EMA50 is the EXPECTED starting condition. Never flag it as a failure. Never apply any Checklist 2B rules here.
Must-haves:
1. OBV higher low — use the pre-computed OBV analysis ONLY. "pass" requires pattern = "higher_low_forming" OR "clean_staircase". "fail" = "lower_low" OR "sustained_downtrend" OR "parabolic_rollover". "unconfirmed" = "flat_sideways" or insufficient data. A last-bar uptick on an otherwise declining OBV is NOT a higher low — trust the algorithmic classification.
2. CMF above zero — CMF > 0.00 → "pass"; -0.10 to 0.00 → "borderline" (note: nearly recovered); below -0.10 → "fail"
3. DI+ above DI- — DI+ > DI- → "pass"; within 2 points → "borderline"; DI+ < DI- → "fail"
Confirming signals (not must-haves):
- RSI 40–55 → healthy recovery range
- EMA20 slope turning upward (use ema20_history)
- Price reclaiming EMA20 weekly

Verdict mapping:
- All 3 pass → BUY half position
- 2/3 pass + 1 borderline → WATCH, half position valid with conditions
- 2/3 pass + 1 unconfirmed → WATCH, entry valid if unconfirmed verified manually
- 1/3 or fewer passing → WAIT, not yet confirmed
- All failing + OBV downtrend → AVOID

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
- Never AVOID when signals are UNCONFIRMED (not failed) — give WATCH instead
- Checklist 1 + DI+ above DI- + any OBV recovery = minimum WATCH
- Borderline CMF (-0.10 to 0.00) on Checklist 1 = WATCH not AVOID
- AVOID requires: confirmed distributing OBV + all 3 must-haves failed + zero recovery signals
- RSI bullish divergence is NOT part of Checklist 1 — never check for it or display it as a must-have

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
  "setup": "beaten_down|pullback|parabolic",
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

OBV pre-computed analysis:
  pattern: ${hist.obv_analysis.pattern}
  summary: ${hist.obv_analysis.summary}
  trough1: ${hist.obv_analysis.trough1 ?? "n/a"}
  trough2: ${hist.obv_analysis.trough2 ?? "n/a"}
  trough2_pct_above_trough1: ${hist.obv_analysis.trough2_pct_above_trough1 !== null ? hist.obv_analysis.trough2_pct_above_trough1.toFixed(1) + "% of OBV range" : "n/a"}

OBV history (last 20 weekly closes, oldest→newest): ${fmtArr(hist.obv_history)}
RSI history (last 20 weekly closes, oldest→newest): ${fmtArr(hist.rsi_history)}
Price history (last 20 weekly closes, oldest→newest): ${fmtArr(hist.price_history)}
EMA20 history (last 20 weekly closes, oldest→newest): ${fmtArr(hist.ema20_history)}`;

  const raw = await callClaude(system, user);
  return JSON.parse(raw);
}
