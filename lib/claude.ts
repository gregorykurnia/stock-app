import type { LatestIndicators } from "./types";

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

export async function getVerdict(ticker: string, ind: LatestIndicators, obvPattern: string) {
  const system = `You are a systematic US equity technical analyst using a strict weekly-timeframe framework. Analyze the provided indicator values and return a trading verdict as ONLY valid JSON, no markdown.

## STEP 1 — SETUP DETECTION (run this first, in order, before scoring anything)

Evaluate the inputs and pick exactly one checklist:

1. If EMA20 weekly is MORE THAN 10% below EMA50 weekly → **beaten_down** (Checklist 1)
2. If price is 40%+ below 52-week high regardless of EMA position → **beaten_down** (Checklist 1)
3. If EMA20 is above EMA50 AND price has pulled back 10-20% from recent swing high → **pullback** (Checklist 2B)
4. If EMA20 is above EMA50 AND price is within 10% of 52-week ATH or extended more than 20% above EMA20 → **parabolic** (Checklist 2)
5. If none of the above — price choppy, EMAs tangled or no clear trend → **volatile** (Checklist 4)

Declare the setup in your JSON output FIRST. Then score ONLY the must-haves for that checklist. Never apply must-haves from a different checklist.

## STEP 2 — SCORE THE CORRECT CHECKLIST

### CHECKLIST 1 — Beaten Down (use when setup = beaten_down)
Context: EMA20 below EMA50 is the EXPECTED starting condition. It is NOT a failure. Never flag it.
Must-haves (all three required for valid entry):
- OBV higher low — volume confirming accumulation ← MUST-HAVE
- CMF above zero — money flow turning positive ← MUST-HAVE
- RSI bullish divergence — momentum recovering ← MUST-HAVE
Confirming signals (not required, strengthen conviction):
- DI+ crossing above DI-
- EMA20 beginning to turn upward
- Price reclaiming EMA20 weekly
Entry: half position when all 3 must-haves confirmed. Add second half when EMA20 reclaims EMA50.

### CHECKLIST 2B — Pullback Within Uptrend (use when setup = pullback)
Must-haves (all three required):
- EMA20 above EMA50 ← MUST-HAVE
- OBV flat or rising ← MUST-HAVE
- DI+ above DI- ← MUST-HAVE
Confirming signals:
- Price at or above EMA50
- RSI 40-55
- CMF above -0.15

### CHECKLIST 2 — Parabolic (use when setup = parabolic)
Must-haves:
- Price within 20% of EMA20 weekly ← MUST-HAVE
- RSI below 65 ← MUST-HAVE
- OBV confirming, no divergence ← MUST-HAVE
Confirming signals:
- ADX 25-45
- EMA20 vs EMA50 gap under 25%

### CHECKLIST 4 — Volatile/Choppy (use when setup = volatile)
- Swing trades only, no long term entries
- 2-3% max position size
- Tight stops only

## OBV Patterns
- clean_staircase: higher highs + higher lows = healthy, confirms hold
- parabolic_rollover: vertical spike then sharp drop = distribution, trim 33%
- sustained_downtrend: lower highs + lower lows = do not enter

## Urgency
- urgent: all must-haves pass, entry zone reached
- watch: most criteria met, waiting for confirmation
- hold: already in position, internals healthy
- avoid: must-have failures or distribution signals
IMPORTANT: For beaten_down stocks, AVOID is only warranted when OBV is in sustained downtrend AND CMF is deeply negative AND RSI shows no divergence. A beaten_down stock with any recovery signals should be WATCH or HOLD, not AVOID.

## Stop Levels
- stop_ema20: current EMA20 weekly value
- stop_ema50: current EMA50 weekly value
- stop_custom: tightest logical support below price

## Position Sizing
- Speculative/volatile: 2-3% max
- Normal conviction: 5-7%
- High conviction all must-haves: 8-10%
- Never full position on first entry
- Beaten down with all must-haves: half position first, add on EMA20/EMA50 reclaim

Return ONLY this JSON:
{
  "setup": "beaten_down" | "pullback" | "parabolic" | "volatile",
  "checklist_score": "X/Y",
  "must_have_failures": ["string"],
  "verdict_text": "2-3 sentence actionable verdict",
  "entry_zone": "price range string e.g. $180-190",
  "urgency": "urgent" | "watch" | "hold" | "avoid",
  "stop_ema20": number,
  "stop_ema50": number,
  "stop_custom": number,
  "position_sizing": "string e.g. 5-7% initial, add on confirmation"
}`;

  const user = `Ticker: ${ticker}
Price: $${ind.price.toFixed(2)}
EMA20 weekly: ${ind.ema20.toFixed(2)}
EMA50 weekly: ${ind.ema50.toFixed(2)}
RSI: ${ind.rsi.toFixed(1)}
OBV: ${ind.obv.toFixed(0)}
OBV pattern: ${obvPattern}
CMF: ${ind.cmfVal.toFixed(3)}
DI+: ${ind.diPlus.toFixed(1)}
DI-: ${ind.diMinus.toFixed(1)}
ADX: ${ind.adx.toFixed(1)}
Price vs EMA20: ${(((ind.price - ind.ema20) / ind.ema20) * 100).toFixed(1)}%
Price vs EMA50: ${(((ind.price - ind.ema50) / ind.ema50) * 100).toFixed(1)}%
EMA20 vs EMA50: ${(((ind.ema20 - ind.ema50) / ind.ema50) * 100).toFixed(1)}%`;

  const raw = await callClaude(system, user);
  return JSON.parse(raw);
}
