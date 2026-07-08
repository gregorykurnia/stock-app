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
  status: "pass" | "fail" | "borderline" | "unconfirmed";
}

export interface ChecklistScoreItem {
  name: string;
  status: "pass" | "fail" | "borderline" | "unconfirmed";
  note: string;
}

export interface OBVAnalysis {
  pattern: "clean_staircase" | "higher_low_forming" | "lower_low" | "sustained_downtrend" | "parabolic_rollover" | "flat_sideways";
  trough1: number | null;
  trough2: number | null;
  trough2_pct_above_trough1: number | null;
  summary: string;
}

export interface HistoricalArrays {
  obv_history: number[];
  rsi_history: number[];
  price_history: number[];
  ema20_history: number[];
  obv_analysis: OBVAnalysis;
}

export interface Verdict {
  // Core fields (always present)
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
  // Enriched fields from history-aware analysis
  setup_detected?: string;
  setup_reason?: string;
  obv_pattern?: string;
  rsi_signal?: string;
  checklist_scores?: {
    must_haves: ChecklistScoreItem[];
    confirming: ChecklistScoreItem[];
    score: string;
  };
}
