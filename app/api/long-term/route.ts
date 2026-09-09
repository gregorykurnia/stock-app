/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import { availableHistoryYears, calculateDataQuality, drawdownStats, historyMissingReason, median, rollingCagrs, trailingCagr, validateFinancialSnapshot, type TotalReturnPoint } from "@/lib/longTermCalculations";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance=require("yahoo-finance2").default;
const yf=new YahooFinance({suppressNotices:["yahooSurvey"]});
type AnyRecord=Record<string,any>;
const cache=new Map<string,{at:number,data:AnyRecord}>(),TTL=12*60*60*1000;
const pctReturns=(p:TotalReturnPoint[])=>p.slice(1).map((x,i)=>x.value/p[i].value-1).filter(Number.isFinite);
const stdev=(xs:number[])=>{if(xs.length<2)return null;const m=xs.reduce((a,b)=>a+b,0)/xs.length;return Math.sqrt(xs.reduce((s,x)=>s+(x-m)**2,0)/(xs.length-1))};
const align=(a:TotalReturnPoint[],b:TotalReturnPoint[])=>{const bm=new Map(b.map(x=>[x.date.slice(0,7),x.value]));return a.filter(x=>bm.has(x.date.slice(0,7))).map(x=>({date:x.date,a:x.value,b:bm.get(x.date.slice(0,7))!}))};
const validRatio=(n:number|null,d:number|null,{positive=false}:{positive?:boolean}={})=>n!=null&&d!=null&&Number.isFinite(n)&&Number.isFinite(d)&&d!==0&&(!positive||d>0)?n/d:null;

async function series(ticker:string):Promise<TotalReturnPoint[]> {
  const now=new Date(),start=new Date(now);start.setUTCFullYear(start.getUTCFullYear()-16);
  const result:AnyRecord=await yf.chart(ticker,{period1:start,period2:now,interval:"1mo",events:"div,splits"});
  return (result?.quotes??[]).filter((q:AnyRecord)=>Number.isFinite(q.adjclose)).map((q:AnyRecord)=>({date:new Date(q.date).toISOString().slice(0,10),value:q.adjclose}));
}

function history(stock:TotalReturnPoint[],voo:TotalReturnPoint[]) {
  const reasons:Record<string,string>={},years=availableHistoryYears(stock),rolling=rollingCagrs(stock),rv=rolling.map(x=>x.value);
  const aligned=align(stock,voo),stockAligned=aligned.map(x=>({date:x.date,value:x.a})),vooAligned=aligned.map(x=>({date:x.date,value:x.b}));
  const stockRoll=rollingCagrs(stockAligned),vooRoll=new Map(rollingCagrs(vooAligned).map(x=>[x.end,x.value])),matched=stockRoll.filter(x=>vooRoll.has(x.end));
  const monthly5y=years>=4.5?pctReturns(stock.slice(-61)):[],vol=stdev(monthly5y);
  const by12=stock.slice(12).map((x,i)=>x.value/stock[i].value-1).filter(Number.isFinite);
  const ar=align(stock,voo);let downS=0,downB=0,downMonths=0;for(let i=1;i<ar.length;i++){const br=ar[i].b/ar[i-1].b-1;if(br<0){downB+=br;downS+=ar[i].a/ar[i-1].a-1;downMonths++}}
  const c10=trailingCagr(stockAligned,10),b10=trailingCagr(vooAligned,10),dd=drawdownStats(stock);
  const result:AnyRecord={
    dataStartDate:stock[0]?.date??null,historyYears:years,totalReturn1y:trailingCagr(stock,1),totalReturnCagr3y:trailingCagr(stock,3),totalReturnCagr5y:trailingCagr(stock,5),totalReturnCagr10y:c10,
    medianRolling5yCagr:median(rv),worstRolling5yCagr:rv.length?Math.min(...rv):null,rolling5yVooWinRate:matched.length?matched.filter(x=>x.value>vooRoll.get(x.end)!).length/matched.length:null,
    annualizedExcessReturn10yVoo:c10!=null&&b10!=null?c10-b10:null,wealthMultiple10y:c10!=null?(1+c10)**10:null,totalReturnSinceDataStart:stock.length>1?stock.at(-1)!.value/stock[0].value-1:null,
    ...dd,recoveryTime:dd.recoveryDays,longestUnderwaterPeriod:dd.longestUnderwaterDays,worstRolling12mReturn:by12.length?Math.min(...by12):null,volatility5y:vol!=null?vol*Math.sqrt(12):null,downMarketCaptureVoo:downMonths>=12&&downB?downS/downB:null,
  };
  for(const [key,period] of Object.entries({totalReturn1y:1,totalReturnCagr3y:3,totalReturnCagr5y:5,totalReturnCagr10y:10,medianRolling5yCagr:5,worstRolling5yCagr:5,rolling5yVooWinRate:5,annualizedExcessReturn10yVoo:10,wealthMultiple10y:10,volatility5y:5}))if(result[key]==null)reasons[key]=historyMissingReason(stock,period);
  if(result.totalReturnSinceDataStart==null)reasons.totalReturnSinceDataStart="Insufficient history";
  if(result.maximumDrawdown==null)reasons.maximumDrawdown=stock.length<2?"Insufficient history":"Not meaningful";
  if(result.worstRolling12mReturn==null)reasons.worstRolling12mReturn=historyMissingReason(stock,1);
  if(result.downMarketCaptureVoo==null)reasons.downMarketCaptureVoo=downMonths<12?"Insufficient history":"Not meaningful";
  return {...result,missingReasons:reasons};
}

async function one(ticker:string,voo:TotalReturnPoint[]) {
  const hit=cache.get(ticker);if(hit&&Date.now()-hit.at<TTL)return hit.data;
  try{
    const [stock,summary,quote]=await Promise.all([series(ticker),yf.quoteSummary(ticker,{modules:["assetProfile","financialData","defaultKeyStatistics","summaryDetail"]}),yf.quote(ticker)]);
    const fd=summary.financialData??{},ks=summary.defaultKeyStatistics??{},sd=summary.summaryDetail??{},marketCap=quote.marketCap??sd.marketCap??null,cash=fd.totalCash??null,debt=fd.totalDebt??null,fcf=fd.freeCashflow??null,revenue=fd.totalRevenue??null,ebitda=fd.ebitda??null;
    const isFinancial=/Financial|Banks|Insurance/i.test(`${summary.assetProfile?.sector??""} ${summary.assetProfile?.industry??""}`),netDebt=debt!=null&&cash!=null?debt-cash:null;
    const historyResult=history(stock,voo),{missingReasons:historyReasons,...h}=historyResult,reasons:Record<string,string>={...historyReasons};
    const data:AnyRecord={ticker,company:quote.longName??quote.shortName??null,sector:summary.assetProfile?.sector??null,industry:summary.assetProfile?.industry??null,currentPrice:quote.regularMarketPrice??null,marketCap,currency:quote.currency??null,dataLastUpdated:new Date().toISOString(),isFinancial,source:"Yahoo Finance",...h,
      beta:sd.beta??ks.beta??null,grossMargin:fd.grossMargins??null,operatingMargin:fd.operatingMargins??null,fcfMargin:validRatio(fcf,revenue),netDebtEbitda:isFinancial?null:validRatio(netDebt,ebitda),netDebtFcf:isFinancial?null:validRatio(netDebt,fcf,{positive:true}),
      trailingPe:sd.trailingPE??null,forwardPe:ks.forwardPE??sd.forwardPE??null,evEbitda:ks.enterpriseToEbitda??null,priceFcf:validRatio(marketCap,fcf,{positive:true}),fcfYield:validRatio(fcf,marketCap,{positive:true}),dividendYield:sd.dividendYield??null,
    };
    for(const key of ["currentPrice","marketCap","grossMargin","operatingMargin","beta","trailingPe","forwardPe","evEbitda","dividendYield"])if(data[key]==null)reasons[key]="Data unavailable";
    if(fcf==null)reasons.fcfMargin=reasons.priceFcf=reasons.fcfYield=reasons.netDebtFcf="Data unavailable";else if(fcf<=0)reasons.priceFcf=reasons.fcfYield=reasons.netDebtFcf="Not meaningful";
    if(marketCap==null){reasons.priceFcf="Data unavailable";reasons.fcfYield="Data unavailable";}
    if(revenue==null||revenue===0)reasons.fcfMargin=revenue===0?"Calculation error":"Data unavailable";
    if(isFinancial)reasons.netDebtEbitda=reasons.netDebtFcf="N/A";else{if(netDebt==null)reasons.netDebtEbitda=reasons.netDebtFcf="Data unavailable";if(!ebitda)reasons.netDebtEbitda=ebitda===0?"Not meaningful":"Data unavailable";}
    const validation=validateFinancialSnapshot(data);for(const key of Object.keys(validation))data[key]=null;
    const quality=calculateDataQuality(data,reasons,validation);
    Object.assign(data,quality,{missingReasons:{...reasons,...validation},validationErrors:validation});
    cache.set(ticker,{at:Date.now(),data});return data;
  }catch(e){return {ticker,error:e instanceof Error?e.message:"Unavailable",dataLastUpdated:new Date().toISOString(),dataCoverage:null,dataQualityStatus:"Insufficient Data",missingKeyMetrics:"All provider metrics",missingDetail:"All provider metrics: Data unavailable"};}
}

export async function GET(req:NextRequest){
  const tickers=(req.nextUrl.searchParams.get("tickers")??"").split(",").map(x=>x.trim().toUpperCase()).filter(Boolean).slice(0,100);
  if(!tickers.length)return NextResponse.json({error:"tickers required"},{status:400});
  try{const voo=await series("VOO"),data:AnyRecord={};for(let i=0;i<tickers.length;i+=6)await Promise.all(tickers.slice(i,i+6).map(async t=>{data[t]=await one(t,voo)}));return NextResponse.json({data,partial:Object.values(data).some((x:any)=>x.error)});}
  catch(e){return NextResponse.json({error:e instanceof Error?e.message:"Market data unavailable"},{status:503});}
}
