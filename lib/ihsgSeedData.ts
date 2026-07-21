export interface IhsgStock {
  ticker: string; // without .JK suffix (e.g. "BBCA")
  industry: string;
  val: number;
  fund: number;
  combined: number;
}

// Populate with IDX stocks — tickers are stored without .JK suffix.
// API calls will automatically append .JK for Yahoo Finance.
export const IHSG_STOCKS: IhsgStock[] = [];
