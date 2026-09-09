export interface TotalReturnPoint { date: string; value: number }
export type MissingDataReason = "N/A" | "Insufficient history" | "Not meaningful" | "Data unavailable" | "Calculation error" | "Not researched";
export type DataQualityStatus = "Complete" | "Mostly Complete" | "Partial" | "Insufficient Data" | "Calculation Error";
export interface DataQualityResult { dataCoverage:number|null; dataQualityStatus:DataQualityStatus; missingKeyMetrics:string; missingDetail:string }

const yearsBetween = (a: string, b: string) =>
  (new Date(b).getTime() - new Date(a).getTime()) / (365.2425 * 86_400_000);

export function cagr(start: number | null, end: number | null, years: number): number | null {
  if (start == null || end == null || start <= 0 || end <= 0 || years <= 0) return null;
  return Math.pow(end / start, 1 / years) - 1;
}

export function trailingCagr(points: TotalReturnPoint[], years: number): number | null {
  if (points.length < 2) return null;
  const end = points.at(-1)!;
  const target = new Date(end.date); target.setUTCFullYear(target.getUTCFullYear() - years);
  const start = points.find((p) => new Date(p.date) >= target);
  if (!start || yearsBetween(start.date, end.date) < years * 0.9) return null;
  return cagr(start.value, end.value, yearsBetween(start.date, end.date));
}

export function availableHistoryYears(points:TotalReturnPoint[]):number {
  return points.length > 1 ? yearsBetween(points[0].date,points.at(-1)!.date) : 0;
}

export function historyMissingReason(points:TotalReturnPoint[],years:number):MissingDataReason {
  return availableHistoryYears(points) < years*.9 ? "Insufficient history" : "Calculation error";
}

export function rollingCagrs(points: TotalReturnPoint[], years = 5): { start: string; end: string; value: number }[] {
  const months = years * 12;
  const out: { start: string; end: string; value: number }[] = [];
  for (let i = months; i < points.length; i++) {
    const start = points[i - months], end = points[i];
    const elapsed = yearsBetween(start.date, end.date);
    const value = cagr(start.value, end.value, elapsed);
    if (value != null && elapsed >= years * 0.9) out.push({ start: start.date, end: end.date, value });
  }
  return out;
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function drawdownStats(points: TotalReturnPoint[]) {
  let peak = -Infinity, peakDate = "", max = 0, start = "", bottom = "", recovery: string | null = null;
  let activePeakDate = "", activeBottomDate = "", activeBottom = 0;
  let longestDays = 0, longestStart = "", longestEnd: string | null = null;
  for (const p of points) {
    if (p.value >= peak) {
      if (activePeakDate) {
        const days = (new Date(p.date).getTime() - new Date(activePeakDate).getTime()) / 86_400_000;
        if (days > longestDays) { longestDays = days; longestStart = activePeakDate; longestEnd = p.date; }
        if (activeBottomDate === bottom && recovery == null) recovery = p.date;
      }
      peak = p.value; peakDate = p.date; activePeakDate = p.date; activeBottomDate = ""; activeBottom = 0;
    } else if (peak > 0) {
      const dd = p.value / peak - 1;
      if (dd < activeBottom) { activeBottom = dd; activeBottomDate = p.date; }
      if (dd < max) { max = dd; start = peakDate; bottom = p.date; recovery = null; }
    }
  }
  if (activePeakDate && points.length) {
    const last = points.at(-1)!.date;
    const days = (new Date(last).getTime() - new Date(activePeakDate).getTime()) / 86_400_000;
    if (days > longestDays) { longestDays = days; longestStart = activePeakDate; longestEnd = null; }
  }
  const recoveryDays = recovery && bottom ? Math.round((new Date(recovery).getTime() - new Date(bottom).getTime()) / 86_400_000) : null;
  return { maximumDrawdown: max || null, maximumDrawdownPeriod: start && bottom ? `${start} to ${bottom}` : null, recoveryDays, recovered: recovery != null, longestUnderwaterDays: longestDays || null, longestUnderwaterPeriod: longestStart ? `${longestStart} to ${longestEnd ?? "present"}` : null };
}

const finite=(value:unknown)=>typeof value==="number"&&Number.isFinite(value);
export function validateFinancialSnapshot(row:Record<string,unknown>):Record<string,string> {
  const errors:Record<string,string>={};
  const gross=row.grossMargin,operating=row.operatingMargin,fcfMargin=row.fcfMargin;
  if(finite(gross)&&(gross as number)<-1||finite(gross)&&(gross as number)>1.5)errors.grossMargin="Calculation error: implausible margin";
  if(finite(operating)&&(operating as number)<-2||finite(operating)&&(operating as number)>1.5)errors.operatingMargin="Calculation error: implausible margin";
  if(finite(gross)&&finite(operating)&&(operating as number)>(gross as number)+.05)errors.operatingMargin="Calculation error: operating margin materially exceeds gross margin";
  if(finite(fcfMargin)&&(fcfMargin as number)<-5||finite(fcfMargin)&&(fcfMargin as number)>2)errors.fcfMargin="Calculation error: implausible FCF margin";
  for(const key of ["netDebtEbitda","netDebtFcf","trailingPe","forwardPe","evEbitda","priceFcf","fcfYield"]){if(row[key]!=null&&!finite(row[key]))errors[key]="Calculation error: non-finite value";}
  if(finite(row.priceFcf)&&finite(row.fcfYield)&&Math.abs((row.priceFcf as number)*(row.fcfYield as number)-1)>.001){errors.fcfYield="Calculation error: FCF Yield and Price/FCF use inconsistent inputs";errors.priceFcf=errors.fcfYield;}
  return errors;
}

const ESSENTIAL:Record<string,string>={currentPrice:"Current Price",marketCap:"Market Cap",totalReturnCagr5y:"5Y Total-Return CAGR",medianRolling5yCagr:"Median Rolling 5Y CAGR",rolling5yVooWinRate:"Rolling 5Y VOO Win Rate",maximumDrawdown:"Maximum Drawdown",volatility5y:"5Y Annualized Volatility",grossMargin:"Gross Margin",operatingMargin:"Operating Margin",fcfMargin:"FCF Margin",forwardPe:"Forward P/E",fcfYield:"FCF Yield",netDebtEbitda:"Net Debt/EBITDA"};
export function calculateDataQuality(row:Record<string,unknown>,reasons:Record<string,string>={},validation:Record<string,string>={}):DataQualityResult {
  const keys=Object.keys(ESSENTIAL);
  const applicable=keys.filter(key=>!(key==="netDebtEbitda"&&row.isFinancial===true)).filter(key=>reasons[key]!=="N/A"&&reasons[key]!=="Insufficient history"&&reasons[key]!=="Not meaningful");
  const missing=keys.filter(key=>!finite(row[key])&&reasons[key]!=="N/A").map(key=>`${ESSENTIAL[key]}: ${validation[key]??reasons[key]??"Data unavailable"}`);
  const present=applicable.filter(key=>finite(row[key])&&!validation[key]).length;
  const coverage=applicable.length?present/applicable.length:null;
  const hasInsufficientHistory=Object.values(reasons).includes("Insufficient history");
  const status:DataQualityStatus=Object.keys(validation).length?"Calculation Error":coverage==null||coverage<.5?"Insufficient Data":coverage>=.9?(hasInsufficientHistory?"Mostly Complete":"Complete"):coverage>=.75?"Mostly Complete":"Partial";
  return {dataCoverage:coverage,dataQualityStatus:status,missingKeyMetrics:missing.map(x=>x.split(":")[0]).join(", "),missingDetail:missing.join("\n")};
}
