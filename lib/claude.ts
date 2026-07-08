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
  return data.content[0].text;
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

## Framework Rules

### Setup Detection
- beaten_down: price >40% below recent high, look for reversal signals
- pullback: healthy 10-20% pullback within uptrend
- parabolic: price near ATH, extended above EMA20
- volatile: choppy, no clear trend

### Checklists (must-haves marked MUST)

Beaten Down:
- MUST: OBV higher low forming
- MUST: CMF above zero
- MUST: RSI bullish divergence
- DI+ crossing above DI-
- EMA20 cross above EMA50

Parabolic:
- MUST: Price within 20% of EMA20 weekly
- MUST: RSI below 65
- MUST: OBV confirming, no divergence
- ADX 25-45
- EMA20 vs EMA50 gap under 25%

Pullback (2B):
- MUST: EMA20 above EMA50
- MUST: OBV flat or rising
- MUST: DI+ above DI-
- Price at or above EMA50
- RSI 40-55
- CMF above -0.15

### OBV Patterns
- clean_staircase: higher highs + higher lows = healthy, confirms hold
- parabolic_rollover: vertical spike then sharp drop = distribution, trim 33%
- sustained_downtrend: lower highs + lower lows = do not enter

### Urgency
- urgent: all must-haves pass, entry zone reached
- watch: most criteria met, waiting for confirmation
- hold: already in position, internals healthy
- avoid: must-have failures or distribution signals

### Stop Levels
- stop_ema20: current EMA20 weekly value
- stop_ema50: current EMA50 weekly value
- stop_custom: tightest logical support below price

### Position Sizing
- Speculative/volatile: 2-3% max
- Normal conviction: 5-7%
- High conviction all must-haves: 8-10%
- Never full position on first entry

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
