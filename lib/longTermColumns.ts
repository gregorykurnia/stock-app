export type LongTermSource = "sourced" | "calculated" | "manual" | "unavailable";
export type LongTermFormat = "text" | "number" | "percent" | "multiple" | "currency" | "date" | "duration" | "score" | "longtext" | "select";
export type LongTermGroup = "Company" | "Historical Returns" | "Risk and Drawdowns" | "Business Compounding" | "Financial Resilience" | "Valuation" | "Expected Return" | "Qualitative Analysis" | "Decision and Tracking";
export interface LongTermColumn { key: string; label: string; group: LongTermGroup; source: LongTermSource; format: LongTermFormat; editable?: boolean; options?: string[]; description?: string }
const c = (group: LongTermGroup, source: LongTermSource, format: LongTermFormat, entries: [string,string,string?][]): LongTermColumn[] => entries.map(([key,label,description]) => ({ key,label,group,source,format,description: description ?? label }));

export const LONG_TERM_COLUMNS: LongTermColumn[] = [
  ...c("Company","sourced","text",[["ticker","Ticker"],["company","Company"],["sector","Sector"],["industry","Industry"]]),
  ...c("Company","sourced","currency",[["currentPrice","Current Price"],["marketCap","Market Cap"]]),
  ...c("Company","sourced","text",[["currency","Currency"]]), ...c("Company","sourced","date",[["dataLastUpdated","Data Last Updated"]]),
  ...c("Historical Returns","calculated","percent",[["totalReturn1y","1Y Total Return"],["totalReturnCagr3y","3Y Total-Return CAGR"],["totalReturnCagr5y","5Y Total-Return CAGR"],["totalReturnCagr10y","10Y Total-Return CAGR"],["totalReturnCagr15y","15Y Total-Return CAGR"],["medianRolling5yCagr","Median Rolling 5Y CAGR"],["bestRolling5yCagr","Best Rolling 5Y CAGR"],["worstRolling5yCagr","Worst Rolling 5Y CAGR"],["positiveRolling5yRate","Positive Rolling 5Y Rate"],["rolling5yVooWinRate","Rolling 5Y VOO Win Rate"],["annualizedExcessReturn10yVoo","10Y Annualized Excess Return vs VOO"]]),
  ...c("Historical Returns","calculated","multiple",[["wealthMultiple10y","10Y Wealth Multiple"]]),
  ...c("Historical Returns","unavailable","percent",[["historicalDividendContribution","Dividend Contribution"]]),
  ...c("Historical Returns","calculated","percent",[["usdTotalReturn","USD Total Return"],["idrAdjustedTotalReturn","IDR-Adjusted Total Return"]]),
  ...c("Risk and Drawdowns","calculated","percent",[["maximumDrawdown","Maximum Drawdown"]]), ...c("Risk and Drawdowns","calculated","text",[["maximumDrawdownPeriod","Maximum-Drawdown Period"]]),
  ...c("Risk and Drawdowns","calculated","duration",[["recoveryTime","Recovery Time"],["longestUnderwaterPeriod","Longest Underwater Period"]]),
  ...c("Risk and Drawdowns","calculated","percent",[["worstCalendarYear","Worst Calendar Year"],["worstRolling12mReturn","Worst Rolling 12-Month Return"],["volatility5y","5Y Annualized Volatility"],["downsideDeviation","Downside Deviation"]]),
  ...c("Risk and Drawdowns","calculated","number",[["sortinoRatio","Sortino Ratio"]]), ...c("Risk and Drawdowns","sourced","number",[["beta","Beta"]]), ...c("Risk and Drawdowns","calculated","percent",[["downMarketCaptureVoo","Down-Market Capture vs VOO"]]),
  ...c("Business Compounding","unavailable","percent",[["revenueCagr3y","3Y Revenue CAGR"],["revenueCagr5y","5Y Revenue CAGR"],["revenueCagr10y","10Y Revenue CAGR"],["organicRevenueCagr3y","3Y Organic Revenue CAGR"],["organicRevenueCagr5y","5Y Organic Revenue CAGR"],["epsCagr3y","3Y EPS CAGR"],["epsCagr5y","5Y EPS CAGR"],["epsCagr10y","10Y EPS CAGR"],["fcfCagr3y","3Y FCF CAGR"],["fcfCagr5y","5Y FCF CAGR"],["fcfCagr10y","10Y FCF CAGR"],["fcfPerShareCagr5y","5Y FCF per Share CAGR"],["fcfPerShareCagr10y","10Y FCF per Share CAGR"],["dividendPerShareCagr5y","5Y Dividend per Share CAGR"]]),
  ...c("Business Compounding","sourced","percent",[["grossMargin","Gross Margin"]]), ...c("Business Compounding","unavailable","percent",[["grossMarginChange5y","5Y Gross-Margin Change"]]), ...c("Business Compounding","sourced","percent",[["operatingMargin","Operating Margin"]]), ...c("Business Compounding","unavailable","percent",[["operatingMarginChange5y","5Y Operating-Margin Change"]]), ...c("Business Compounding","sourced","percent",[["fcfMargin","FCF Margin"]]),
  ...c("Business Compounding","unavailable","percent",[["averageFcfMargin5y","5Y Average FCF Margin"],["currentRoic","Current ROIC"],["medianRoic5y","5Y Median ROIC"],["incrementalRoic","Incremental ROIC"],["fcfConversion","FCF Conversion"],["shareCountCagr5y","5Y Share-Count CAGR"],["sbcRevenuePct","Stock-Based Compensation as % of Revenue"]]),
  ...c("Financial Resilience","sourced","currency",[["cashAndInvestments","Cash and Investments"],["totalDebt","Total Debt"],["netDebt","Net Debt"]]), ...c("Financial Resilience","sourced","multiple",[["netDebtEbitda","Net Debt/EBITDA"],["netDebtFcf","Net Debt/FCF"],["interestCoverage","Interest Coverage"]]),
  ...c("Financial Resilience","unavailable","text",[["creditRating","Credit Rating"]]), ...c("Financial Resilience","calculated","score",[["balanceSheetScore","Balance-Sheet Score"]]),
  ...c("Valuation","sourced","multiple",[["trailingPe","Trailing P/E"],["forwardPe","Forward P/E"],["evEbitda","EV/EBITDA"],["priceFcf","Price/FCF"]]), ...c("Valuation","calculated","percent",[["fcfYield","FCF Yield"]]), ...c("Valuation","sourced","multiple",[["peg","PEG"]]),
  ...c("Valuation","unavailable","percent",[["currentPeVsMedian5y","Current P/E vs 5Y Median"],["currentFcfYieldVsMedian5y","Current FCF Yield vs 5Y Median"]]), ...c("Valuation","sourced","percent",[["analystEpsGrowthEstimate","Analyst EPS Growth Estimate"]]),
  ...c("Valuation","calculated","currency",[["baseCaseFairValue","Base-Case Fair Value"]]), ...c("Valuation","calculated","percent",[["marginOfSafety","Margin of Safety"]]), ...c("Valuation","manual","currency",[["fairValueEntryPrice","Fair-Value Entry Price"]]).map(x=>({...x,editable:true})),
  ...c("Expected Return","manual","percent",[["expectedFundamentalGrowth","Expected EPS or FCF/Share Growth"]]).map(x=>({...x,editable:true})), ...c("Expected Return","sourced","percent",[["dividendYield","Dividend Yield"]]), ...c("Expected Return","manual","percent",[["netBuybackYield","Net Buyback Yield"]]).map(x=>({...x,editable:true})),
  ...c("Expected Return","manual","multiple",[["currentValuationMultiple","Current Valuation Multiple"],["expectedYear5ValuationMultiple","Expected Year-5 Valuation Multiple"]]).map(x=>({...x,editable:true})),
  ...c("Expected Return","calculated","percent",[["fundamentalGrowthContribution","Fundamental-Growth Contribution"],["expectedDividendContribution","Dividend Contribution"],["buybackDilutionContribution","Buyback/Dilution Contribution"],["valuationChangeContribution","Valuation-Change Contribution"],["expectedReturn5y","Expected 5Y Annualized Return"]]),
  ...manualQualitative(), ...decisionColumns(),
];

function manualQualitative(): LongTermColumn[] {
  const group: LongTermGroup = "Qualitative Analysis";
  const rating = (key:string,label:string): LongTermColumn => ({key,label,group,source:"manual",format:"select",editable:true,options:["1","2","3","4","5"],description:`Manual ${label.toLowerCase()} rating; 1 is weakest/highest risk and 5 is strongest/lowest risk as applicable.`});
  return [
    {key:"moatType",label:"Moat Type",group,source:"manual",format:"text",editable:true,description:"Primary source of durable competitive advantage."}, rating("moatStrength","Moat Strength"),
    {key:"moatTrend",label:"Moat Trend",group,source:"manual",format:"select",editable:true,options:["Strengthening","Stable","Weakening"],description:"Direction of competitive advantage."},
    rating("recurringRevenueStrength","Recurring-Revenue Strength"),rating("pricingPower","Pricing Power"),rating("missionCriticality","Mission Criticality"),rating("marketNeedDurability","Market-Need Durability"),rating("growthRunway","Growth Runway"),
    {key:"cyclicality",label:"Cyclicality",group,source:"manual",format:"select",editable:true,options:["Low","Medium","High"],description:"Sensitivity to the economic cycle."},
    {key:"customerConcentration",label:"Customer Concentration",group,source:"manual",format:"text",editable:true,description:"Reliance on a small number of customers."},rating("disruptionRisk","Disruption Risk"),rating("managementQuality","Management Quality"),rating("capitalAllocation","Capital Allocation"),rating("governanceRisk","Governance Risk"),
    ...["Investment Thesis","Key Risks","Thesis Breakers","Personal Notes"].map(label=>({key:label.replace(/ (.)/g,(_,x)=>x.toUpperCase()).replace(/^./,x=>x.toLowerCase()),label,group,source:"manual" as const,format:"longtext" as const,editable:true,description:`Manual ${label.toLowerCase()}.`})),
  ];
}

function decisionColumns(): LongTermColumn[] {
  const group: LongTermGroup = "Decision and Tracking", scores = [["historicalReturnQualityScore","Historical Return Quality Score"],["businessQualityScore","Business Quality Score"],["fundamentalCompoundingScore","Fundamental Compounding Score"],["financialResilienceScore","Financial Resilience Score"],["valuationScore","Valuation Score"],["managementCapitalAllocationScore","Management and Capital Allocation Score"]] as [string,string][];
  const verdicts=["Attractive Now","Accumulate Gradually","Watchlist","Hold","Too Expensive","Quality Concerns","Avoid"];
  return [
    ...scores.map(([key,label])=>({key,label,group,source:"manual" as const,format:"score" as const,editable:true,description:"Manual category score from 1–10; used transparently in Compounder Score."})),
    {key:"compounderScore",label:"Compounder Score",group,source:"calculated",format:"score",description:"0–100 weighted score; missing categories are reweighted, never treated as zero."},
    {key:"suggestedVerdict",label:"Suggested Verdict",group,source:"calculated",format:"text",description:"Rule-based suggestion kept separate from the final verdict."},
    {key:"finalVerdict",label:"Final Verdict",group,source:"manual",format:"select",editable:true,options:verdicts,description:"Your final manual verdict."},
    {key:"positionStatus",label:"Position Status",group,source:"manual",format:"select",editable:true,options:["Not Owned","Watchlist","Building","Owned","Exiting"],description:"Current tracking status."},
    {key:"currentPortfolioWeight",label:"Current Portfolio Weight",group,source:"manual",format:"percent",editable:true,description:"Current portfolio allocation."},{key:"targetPortfolioWeight",label:"Target Portfolio Weight",group,source:"manual",format:"percent",editable:true,description:"Desired portfolio allocation."},
    {key:"nextReviewDate",label:"Next Review Date",group,source:"manual",format:"date",editable:true,description:"Planned review date."},{key:"reviewStatus",label:"Review Status",group,source:"manual",format:"select",editable:true,options:["Up to date","Due soon","Overdue","In progress"],description:"Manual review status."},
  ];
}

export const COLUMN_MAP = Object.fromEntries(LONG_TERM_COLUMNS.map(c=>[c.key,c]));
export const GROUPS = [...new Set(LONG_TERM_COLUMNS.map(c=>c.group))] as LongTermGroup[];
