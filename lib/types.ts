export interface OHLCVBar {
  time: number; // unix timestamp seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Indicators {
  ema20: number[];
  ema50: number[];
  rsi: number[];
  obv: number[];
  cmf: number[];
  diPlus: number[];
  diMinus: number[];
  adx: number[];
}

export interface LatestIndicators {
  ema20: number;
  ema50: number;
  rsi: number;
  obv: number;
  cmfVal: number;
  diPlus: number;
  diMinus: number;
  adx: number;
  price: number;
}

export type SetupType = "beaten_down" | "pullback" | "parabolic" | "volatile";
export type Urgency = "urgent" | "watch" | "hold" | "avoid";

export interface ChecklistItem {
  label: string;
  mustHave: boolean;
  pass: boolean;
}

export interface Verdict {
  setup: SetupType;
  checklist_score: string;
  must_have_failures: string[];
  verdict_text: string;
  entry_zone: string;
  urgency: Urgency;
  stop_ema20: number;
  stop_ema50: number;
  stop_custom?: number;
  position_sizing: string;
  date: string;
}
