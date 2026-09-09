import test from "node:test";
import assert from "node:assert/strict";
import { availableHistoryYears, cagr, calculateDataQuality, drawdownStats, historyMissingReason, rollingCagrs, validateFinancialSnapshot } from "../lib/longTermCalculations";
import { createCsv, csvEscape } from "../lib/longTermCsv";

test("CAGR uses the requested compounding formula",()=>assert.ok(Math.abs(cagr(100,161.051,5)!-.1)<1e-6));
test("rolling returns use overlapping monthly five-year windows",()=>{const p=Array.from({length:73},(_,i)=>({date:new Date(Date.UTC(2019,i,1)).toISOString().slice(0,10),value:100*Math.pow(1.01,i)}));assert.equal(rollingCagrs(p).length,13)});
test("drawdown finds bottom and recovery",()=>{const d=drawdownStats([{date:"2020-01-01",value:100},{date:"2020-02-01",value:70},{date:"2020-03-01",value:101}]);assert.ok(Math.abs(d.maximumDrawdown!+.3)<1e-12);assert.equal(d.recovered,true)});
test("short public history is classified without treating it as zero",()=>{const p=[{date:"2024-01-01",value:100},{date:"2026-01-01",value:120}];assert.ok(availableHistoryYears(p)>1.9);assert.equal(historyMissingReason(p,5),"Insufficient history")});
test("margin validation flags operating margin materially above gross margin",()=>{const errors=validateFinancialSnapshot({grossMargin:.726,operatingMargin:.804});assert.match(errors.operatingMargin,/exceeds gross margin/)});
test("FCF yield and Price-to-FCF must use reciprocal inputs",()=>{const errors=validateFinancialSnapshot({priceFcf:20,fcfYield:.04});assert.ok(errors.fcfYield)});
test("coverage excludes insufficient-history metrics from its denominator",()=>{const row={currentPrice:10,marketCap:100,maximumDrawdown:-.2,grossMargin:.5,operatingMargin:.2,fcfMargin:.1,forwardPe:20,fcfYield:.05,netDebtEbitda:1};const history={totalReturnCagr5y:"Insufficient history",medianRolling5yCagr:"Insufficient history",rolling5yVooWinRate:"Insufficient history",volatility5y:"Insufficient history"};const result=calculateDataQuality(row,history);assert.equal(result.dataCoverage,1);assert.equal(result.dataQualityStatus,"Mostly Complete");assert.match(result.missingDetail,/Insufficient history/)});
test("calculation errors override an otherwise high coverage status",()=>{const result=calculateDataQuality({currentPrice:10,marketCap:100},{},{operatingMargin:"Calculation error"});assert.equal(result.dataQualityStatus,"Calculation Error")});
test("CSV escapes commas quotes and line breaks and carries a UTF-8 BOM",()=>{assert.equal(csvEscape('a,"b"\nc'),'"a,""b""\nc"');assert.ok(createCsv(['A"ng',"B"],[[1,null]]).startsWith('\uFEFF"A""ng",B\r\n1,N/A'))});
