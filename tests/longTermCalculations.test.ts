import test from "node:test";
import assert from "node:assert/strict";
import { cagr, compounderScore, drawdownStats, expectedReturn, rollingCagrs } from "../lib/longTermCalculations";
import { createCsv, csvEscape } from "../lib/longTermCsv";

test("CAGR uses the requested compounding formula",()=>assert.ok(Math.abs(cagr(100,161.051,5)!-.1)<1e-6));
test("rolling returns use overlapping monthly five-year windows",()=>{const p=Array.from({length:73},(_,i)=>({date:new Date(Date.UTC(2019,i,1)).toISOString().slice(0,10),value:100*Math.pow(1.01,i)}));assert.equal(rollingCagrs(p).length,13)});
test("drawdown finds bottom and recovery",()=>{const d=drawdownStats([{date:"2020-01-01",value:100},{date:"2020-02-01",value:70},{date:"2020-03-01",value:101}]);assert.ok(Math.abs(d.maximumDrawdown!+.3)<1e-12);assert.equal(d.recovered,true)});
test("expected return keeps all components visible",()=>{const r=expectedReturn(.1,.02,.01,20,15);assert.equal(r.fundamentalGrowthContribution,.1);assert.ok(r.valuationChangeContribution!<0);assert.ok(r.expectedAnnualizedReturn!=null)});
test("compounder score reweights missing categories instead of scoring them zero",()=>{const r=compounderScore({businessQualityScore:8,fundamentalCompoundingScore:6});assert.equal(r.score,70);assert.ok(r.completeness<1);assert.ok(r.missing.includes("valuationScore"))});
test("CSV escapes commas quotes and line breaks and carries a UTF-8 BOM",()=>{assert.equal(csvEscape('a,"b"\nc'),'"a,""b""\nc"');assert.ok(createCsv(['A"ng',"B"],[[1,null]]).startsWith('\uFEFF"A""ng",B\r\n1,N/A'))});
