export type LongTermSource = "sourced" | "calculated" | "manual";
export type LongTermFormat = "text" | "number" | "percent" | "multiple" | "currency" | "date" | "duration" | "longtext" | "select";
export type LongTermGroup = "Company" | "Returns and Risk" | "Fundamentals" | "Valuation" | "Research Notes" | "Data Quality";
export interface LongTermColumn { key:string; label:string; group:LongTermGroup; source:LongTermSource; format:LongTermFormat; period:string; description:string; editable?:boolean; options?:string[]; quantitative?:boolean }

const col=(key:string,label:string,group:LongTermGroup,source:LongTermSource,format:LongTermFormat,period:string,description:string,extra:Partial<LongTermColumn>={}):LongTermColumn=>({key,label,group,source,format,period,description,...extra});
const q=(key:string,label:string,group:LongTermGroup,source:LongTermSource,format:LongTermFormat,period:string,description:string)=>col(key,label,group,source,format,period,description,{quantitative:true});
const manual=(key:string,label:string,format:LongTermFormat,description:string,options?:string[])=>col(key,label,"Research Notes","manual",format,"User maintained",description,{editable:true,options});
const manualValuation=(key:string,label:string,format:LongTermFormat,description:string)=>col(key,label,"Valuation","manual",format,"User maintained",description,{editable:true});
export const FINAL_VERDICTS=["Not Yet Researched","Attractive Now","Accumulate Gradually","Watchlist","Hold","Too Expensive","Quality Concerns","Avoid"];
export const DATA_QUALITY_STATUSES=["Complete","Mostly Complete","Partial","Insufficient Data","Calculation Error"];

// Deprecated score fields and unsupported historical fundamentals remain untouched in
// Firestore, but are intentionally absent from the active UI and standard exports.
export const LONG_TERM_COLUMNS:LongTermColumn[]=[
  col("ticker","Ticker","Company","sourced","text","Current","Trading symbol."),
  col("company","Company","Company","sourced","text","Current","Company name reported by Yahoo Finance."),
  col("sector","Sector","Company","sourced","text","Current","Company sector reported by Yahoo Finance."),
  col("industry","Industry","Company","sourced","text","Current","Company industry reported by Yahoo Finance."),
  q("currentPrice","Current Price","Company","sourced","currency","Latest quote","Latest regular-market price."),
  q("marketCap","Market Cap","Company","sourced","currency","Latest quote","Latest market capitalization."),
  col("currency","Currency","Company","sourced","text","Latest quote","Quote currency."),
  col("dataLastUpdated","Data Last Updated","Company","sourced","date","Refresh time","UTC refresh time."),
  col("dataStartDate","Return Data Start Date","Company","calculated","date","Available history","First adjusted-close observation used by return calculations."),

  q("totalReturn1y","1Y Total Return","Returns and Risk","calculated","percent","Trailing 1 year","Adjusted-close total return."),
  q("totalReturnCagr3y","3Y Total-Return CAGR","Returns and Risk","calculated","percent","Trailing 3 years","Annualized adjusted-close return."),
  q("totalReturnCagr5y","5Y Total-Return CAGR","Returns and Risk","calculated","percent","Trailing 5 years","Annualized adjusted-close return."),
  q("totalReturnCagr10y","10Y Total-Return CAGR","Returns and Risk","calculated","percent","Trailing 10 years","Annualized adjusted-close return."),
  q("medianRolling5yCagr","Median Rolling 5Y CAGR","Returns and Risk","calculated","percent","All rolling 5-year windows","Median of overlapping monthly five-year CAGRs."),
  q("worstRolling5yCagr","Worst Rolling 5Y CAGR","Returns and Risk","calculated","percent","All rolling 5-year windows","Lowest overlapping monthly five-year CAGR."),
  q("rolling5yVooWinRate","Rolling 5Y VOO Win Rate","Returns and Risk","calculated","percent","Matched rolling 5-year windows","Share of matched five-year windows outperforming VOO."),
  q("annualizedExcessReturn10yVoo","10Y Annualized Excess Return vs VOO","Returns and Risk","calculated","percent","Trailing 10 years","Stock ten-year CAGR minus VOO ten-year CAGR."),
  q("wealthMultiple10y","10Y Wealth Multiple","Returns and Risk","calculated","multiple","Trailing 10 years","Growth multiple implied by the ten-year return."),
  q("totalReturnSinceDataStart","Total Return Since Data Start","Returns and Risk","calculated","percent","Since Return Data Start Date","Adjusted-close return from the first available observation."),
  q("maximumDrawdown","Maximum Drawdown","Returns and Risk","calculated","percent","Available history","Largest peak-to-trough adjusted-close decline."),
  col("maximumDrawdownPeriod","Maximum-Drawdown Period","Returns and Risk","calculated","text","Available history","Peak date through trough date."),
  q("recoveryTime","Recovery Time (Days)","Returns and Risk","calculated","duration","Maximum drawdown episode","Calendar days from trough until the prior peak was regained."),
  q("longestUnderwaterPeriod","Longest Underwater Period (Days)","Returns and Risk","calculated","duration","Available history","Longest calendar period below a prior peak."),
  q("worstRolling12mReturn","Worst Rolling 12-Month Return","Returns and Risk","calculated","percent","All rolling 12-month windows","Lowest overlapping monthly 12-month return."),
  q("volatility5y","5Y Annualized Volatility","Returns and Risk","calculated","percent","Trailing 5 years","Monthly-return sample deviation annualized by square root of 12."),
  q("downMarketCaptureVoo","Down-Market Capture vs VOO","Returns and Risk","calculated","percent","Matched monthly down markets","Stock return sum divided by VOO return sum in down months."),
  q("beta","Beta","Returns and Risk","sourced","number","Provider-defined","Yahoo Finance beta; available only in All Reliable Data."),

  q("grossMargin","Gross Margin","Fundamentals","sourced","percent","Latest provider snapshot","Yahoo Finance financialData gross margin."),
  q("operatingMargin","Operating Margin","Fundamentals","sourced","percent","Latest provider snapshot","Yahoo Finance financialData operating margin."),
  q("fcfMargin","FCF Margin","Fundamentals","calculated","percent","Latest provider snapshot","Free cash flow divided by revenue from the same snapshot."),
  q("netDebtEbitda","Net Debt/EBITDA","Fundamentals","calculated","multiple","Latest provider snapshot","Debt less cash divided by EBITDA; not applicable to financial firms."),
  q("netDebtFcf","Net Debt/FCF","Fundamentals","calculated","multiple","Latest provider snapshot","Debt less cash divided by positive FCF; not applicable to financial firms."),

  q("trailingPe","Trailing P/E","Valuation","sourced","multiple","Latest provider snapshot","Yahoo Finance trailing P/E."),
  q("forwardPe","Forward P/E","Valuation","sourced","multiple","Latest provider snapshot","Yahoo Finance forward P/E."),
  q("evEbitda","EV/EBITDA","Valuation","sourced","multiple","Latest provider snapshot","Yahoo Finance enterprise value to EBITDA."),
  q("priceFcf","Price/FCF","Valuation","calculated","multiple","Latest provider snapshot","Market capitalization divided by positive FCF."),
  q("fcfYield","FCF Yield","Valuation","calculated","percent","Latest provider snapshot","Positive FCF divided by market cap; reciprocal of Price/FCF."),
  q("dividendYield","Dividend Yield","Valuation","sourced","percent","Latest provider snapshot","Current indicated dividend yield returned by Yahoo Finance."),
  manualValuation("baseCaseFairValue","Base-Case Fair Value","currency","Manual valuation output; never generated automatically."),
  manualValuation("marginOfSafety","Margin of Safety","percent","Manual valuation assessment."),
  manualValuation("fairValueEntryPrice","Fair-Value Entry Price","currency","Manual researched entry price."),
  manualValuation("expectedReturn5y","Expected 5Y Annualized Return","percent","Manual output from a documented valuation model."),

  manual("moatType","Moat Type","text","Primary durable competitive advantage."),
  manual("moatStrength","Moat Strength","select","Manual 1–5 assessment; 5 is strongest.",["1","2","3","4","5"]),
  manual("moatTrend","Moat Trend","select","Direction of the moat.",["Strengthening","Stable","Weakening"]),
  manual("pricingPower","Pricing Power","select","Manual 1–5 assessment; 5 is strongest.",["1","2","3","4","5"]),
  manual("missionCriticality","Mission Criticality","select","Manual 1–5 assessment; 5 is strongest.",["1","2","3","4","5"]),
  manual("marketNeedDurability","Market-Need Durability","select","Manual 1–5 assessment; 5 is strongest.",["1","2","3","4","5"]),
  manual("growthRunway","Growth Runway","select","Manual 1–5 assessment; 5 is longest.",["1","2","3","4","5"]),
  manual("cyclicality","Cyclicality","select","Sensitivity to the economic cycle.",["Low","Medium","High"]),
  manual("disruptionRisk","Disruption Risk","select","Manual 1–5 assessment; 5 is lowest risk.",["1","2","3","4","5"]),
  manual("managementQuality","Management Quality","select","Manual 1–5 assessment; 5 is strongest.",["1","2","3","4","5"]),
  manual("capitalAllocation","Capital Allocation","select","Manual 1–5 assessment; 5 is strongest.",["1","2","3","4","5"]),
  manual("investmentThesis","Investment Thesis","longtext","Core reasons to own the company."),
  manual("keyRisks","Key Risks","longtext","Material risks to the investment case."),
  manual("thesisBreakers","Thesis Breakers","longtext","Observable conditions that invalidate the thesis."),
  manual("personalNotes","Personal Notes","longtext","Free-form research notes."),
  manual("finalVerdict","Final Verdict","select","Your final manual verdict.",FINAL_VERDICTS),
  manual("nextReviewDate","Next Review Date","date","Planned manual review date."),

  q("dataCoverage","Data Coverage %","Data Quality","calculated","percent","Current refresh","Share of applicable essential quantitative fields that are valid."),
  col("dataQualityStatus","Data Quality Status","Data Quality","calculated","text","Current refresh","Coverage classification or Calculation Error when validation fails."),
  col("missingKeyMetrics","Missing Key Metrics","Data Quality","calculated","text","Current refresh","Missing required metrics and their explicit reasons."),
];
export const COLUMN_MAP=Object.fromEntries(LONG_TERM_COLUMNS.map(c=>[c.key,c]));
export const GROUPS=[...new Set(LONG_TERM_COLUMNS.map(c=>c.group))] as LongTermGroup[];
