/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { drawdownStats, median, rollingCagrs, trailingCagr, type TotalReturnPoint } from "@/lib/longTermCalculations";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

type AnyRecord = Record<string, any>; // Yahoo's response varies by instrument.
const cache = new Map<string,{at:number,data:AnyRecord}>(), TTL = 12 * 60 * 60 * 1000;
const pctReturns = (p: TotalReturnPoint[]) => p.slice(1).map((x,i)=>x.value/p[i].value-1).filter(Number.isFinite);
const stdev = (xs:number[]) => { if(xs.length<2)return null; const m=xs.reduce((a,b)=>a+b,0)/xs.length; return Math.sqrt(xs.reduce((s,x)=>s+(x-m)**2,0)/(xs.length-1)); };
const align = (a:TotalReturnPoint[],b:TotalReturnPoint[]) => { const bm=new Map(b.map(x=>[x.date,x.value])); return a.filter(x=>bm.has(x.date)).map(x=>({date:x.date,a:x.value,b:bm.get(x.date)!})); };

async function series(ticker:string, interval:"1d"|"1mo"="1mo"):Promise<TotalReturnPoint[]> {
  const now=new Date(), start=new Date(now); start.setUTCFullYear(start.getUTCFullYear()-16);
  const result:AnyRecord=await yf.chart(ticker,{period1:start,period2:now,interval,events:"div,splits"});
  return (result?.quotes??[]).filter((q:AnyRecord)=>q.adjclose!=null||q.close!=null).map((q:AnyRecord)=>({date:new Date(q.date).toISOString().slice(0,10),value:q.adjclose??q.close}));
}

function history(stock:TotalReturnPoint[],voo:TotalReturnPoint[],fx:TotalReturnPoint[]) {
  const rolling=rollingCagrs(stock), rv=rolling.map(x=>x.value), aligned=align(stock,voo), stockAligned=aligned.map(x=>({date:x.date,value:x.a})), vooAligned=aligned.map(x=>({date:x.date,value:x.b}));
  const stockRoll=rollingCagrs(stockAligned), vooRoll=new Map(rollingCagrs(vooAligned).map(x=>[x.end,x.value]));
  const matched=stockRoll.filter(x=>vooRoll.has(x.end));
  const monthly=pctReturns(stock.slice(-61)), vol=stdev(monthly), downside=stdev(monthly.filter(x=>x<0));
  const annualReturn=trailingCagr(stock,5), rf=.04;
  const byYear=new Map<number,{first:number,last:number}>(); for(const p of stock){const y=+p.date.slice(0,4),v=byYear.get(y);if(!v)byYear.set(y,{first:p.value,last:p.value});else v.last=p.value;}
  const calendar=[...byYear.values()].map(x=>x.last/x.first-1).filter(Number.isFinite);
  const roll12=stock.slice(12).map((x,i)=>x.value/stock[i].value-1);
  const ar=align(stock,voo); let downS=0,downB=0; for(let i=1;i<ar.length;i++){const br=ar[i].b/ar[i-1].b-1;if(br<0){downB+=br;downS+=ar[i].a/ar[i-1].a-1;}}
  const usd=stock.length>1?stock.at(-1)!.value/stock[0].value-1:null, fxAligned=align(stock,fx), fxReturn=fxAligned.length>1?fxAligned.at(-1)!.b/fxAligned[0].b-1:null;
  const c10=trailingCagr(stock,10), b10=trailingCagr(vooAligned,10);
  const dd=drawdownStats(stock);
  return {
    totalReturn1y: trailingCagr(stock,1), totalReturnCagr3y:trailingCagr(stock,3),totalReturnCagr5y:trailingCagr(stock,5),totalReturnCagr10y:c10,totalReturnCagr15y:trailingCagr(stock,15),
    medianRolling5yCagr:median(rv),bestRolling5yCagr:rv.length?Math.max(...rv):null,worstRolling5yCagr:rv.length?Math.min(...rv):null,positiveRolling5yRate:rv.length?rv.filter(x=>x>0).length/rv.length:null,rolling5yVooWinRate:matched.length?matched.filter(x=>x.value>vooRoll.get(x.end)!).length/matched.length:null,annualizedExcessReturn10yVoo:c10!=null&&b10!=null?c10-b10:null,wealthMultiple10y:c10!=null?(1+c10)**10:null,
    usdTotalReturn:usd,idrAdjustedTotalReturn:usd!=null&&fxReturn!=null?(1+usd)*(1+fxReturn)-1:null,
    ...dd, recoveryTime:dd.recoveryDays, longestUnderwaterPeriod:dd.longestUnderwaterDays,
    worstCalendarYear:calendar.length?Math.min(...calendar):null,worstRolling12mReturn:roll12.length?Math.min(...roll12):null,volatility5y:vol!=null?vol*Math.sqrt(12):null,downsideDeviation:downside!=null?downside*Math.sqrt(12):null,sortinoRatio:annualReturn!=null&&downside?(annualReturn-rf)/downside:null,downMarketCaptureVoo:downB?downS/downB:null,
  };
}
async function one(ticker:string,voo:TotalReturnPoint[],fx:TotalReturnPoint[]) {
  const hit=cache.get(ticker); if(hit&&Date.now()-hit.at<TTL)return hit.data;
  try {
    const [stock,summary,quote]=await Promise.all([series(ticker),yf.quoteSummary(ticker,{modules:["assetProfile","financialData","defaultKeyStatistics","summaryDetail","earningsTrend"]}),yf.quote(ticker)]);
    const fd=summary.financialData??{},ks=summary.defaultKeyStatistics??{},sd=summary.summaryDetail??{}, marketCap=quote.marketCap??sd.marketCap??null, cash=fd.totalCash??null,debt=fd.totalDebt??null,fcf=fd.freeCashflow??null,ebitda=fd.ebitda??null;
    const isFinancial=/Financial|Banks|Insurance/i.test(`${summary.assetProfile?.sector??""} ${summary.assetProfile?.industry??""}`);
    const netDebt=debt!=null&&cash!=null?debt-cash:null;
    const balanceSheetScore=isFinancial?null:netDebt!=null&&ebitda?Math.max(0,Math.min(100,100-(netDebt/ebitda)*20)):netDebt!=null&&netDebt<=0?100:null;
    const analystGrowth=(summary.earningsTrend?.trend??[]).find((x:AnyRecord)=>x.period==="+5y")?.growth??null;
    const data:AnyRecord={ticker,company:quote.longName??quote.shortName??null,sector:summary.assetProfile?.sector??null,industry:summary.assetProfile?.industry??null,currentPrice:quote.regularMarketPrice??null,marketCap,currency:quote.currency??null,dataLastUpdated:new Date().toISOString(),source:"Yahoo Finance",...history(stock,voo,fx),
      beta:sd.beta??ks.beta??null,grossMargin:fd.grossMargins??null,operatingMargin:fd.operatingMargins??null,fcfMargin:fcf!=null&&fd.totalRevenue?fcf/fd.totalRevenue:null,cashAndInvestments:cash,totalDebt:debt,netDebt:isFinancial?null:netDebt,netDebtEbitda:!isFinancial&&netDebt!=null&&ebitda?netDebt/ebitda:null,netDebtFcf:!isFinancial&&netDebt!=null&&fcf?netDebt/fcf:null,interestCoverage:null,balanceSheetScore,financialSectorMetricNote:isFinancial?"Operating-company leverage ratios are not comparable for financial firms.":null,
      trailingPe:sd.trailingPE??null,forwardPe:ks.forwardPE??sd.forwardPE??null,evEbitda:ks.enterpriseToEbitda??null,priceFcf:marketCap&&fcf>0?marketCap/fcf:null,fcfYield:marketCap&&fcf?fcf/marketCap:null,peg:ks.pegRatio??null,analystEpsGrowthEstimate:analystGrowth,dividendYield:sd.dividendYield??null,
    };
    cache.set(ticker,{at:Date.now(),data}); return data;
  } catch(e){ return {ticker,error:e instanceof Error?e.message:"Unavailable",dataLastUpdated:new Date().toISOString()}; }
}

export async function GET(req:NextRequest){
  const tickers=(req.nextUrl.searchParams.get("tickers")??"").split(",").map(x=>x.trim().toUpperCase()).filter(Boolean).slice(0,100);
  if(!tickers.length)return NextResponse.json({error:"tickers required"},{status:400});
  try { const [voo,fx]=await Promise.all([series("VOO"),series("IDR=X")]); const data:AnyRecord={}; for(let i=0;i<tickers.length;i+=6)await Promise.all(tickers.slice(i,i+6).map(async t=>{data[t]=await one(t,voo,fx);})); return NextResponse.json({data,partial:Object.values(data).some((x:any)=>x.error)}); }
  catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Market data unavailable"},{status:503});}
}
