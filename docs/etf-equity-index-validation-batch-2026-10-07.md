# Broad equity-index ETF validation batch

Run captured 2026-10-07T01:47:02.943Z UTC. Common score cutoff: **2026-09-30**. This is a separate experimental batch; it does not update the ETF Core or Full scorecards.

Method equity-index-free-core-trial-v1: (0.30 × FeePoints + 0.40 × HistoricalOutcomes) ÷ 0.70. Fee efficiency is 100 × exp(−net expense ratio / 0.50%). Historical outcomes reuse the equity-index growth, drawdown and downside curves from the VOO/VXUS trial. No spread is required or inferred.

The original trial report documents the outcome component curves and window definitions: [VOO / VXUS Free Core trial](etf-free-core-trial-2026-10-07.md).

Historical cutoffs test market-window sensitivity. The latest dated issuer net fee is held constant at every cutoff. Results whose fee date is after the cutoff are not point-in-time backtests; see each row's `fee after cutoff` flag.

## Source and completeness coverage

| ETF | Mandate | Identity / mandate source | Issuer net fee | Official fee source | Yahoo adjusted history | Data coverage |
|---|---|---|---:|---|---|---|
| VOO | U.S. large-cap equity index | [identity](https://advisors.vanguard.com/investments/products/voo/vanguard-sp-500-etf) · [mandate](https://advisors.vanguard.com/investments/products/voo/vanguard-sp-500-etf) | 0.030% net · 2026-04-28 | [issuer source](https://advisors.vanguard.com/investments/products/voo/vanguard-sp-500-etf) | [Yahoo Finance adjusted history](https://finance.yahoo.com/quote/VOO/history/) · 2705 rows · 2016-01-04–2026-10-06 · USD · hash 6418116535e49fc6 | identity/mandate/fee/history: pass/pass/pass/pass |
| VTI | U.S. total-market equity index | [identity](https://advisors.vanguard.com/investments/products/vti/vanguard-total-stock-market-etf) · [mandate](https://advisors.vanguard.com/investments/products/vti/vanguard-total-stock-market-etf) | 0.030% net · 2026-04-28 | [issuer source](https://advisors.vanguard.com/investments/products/vti/vanguard-total-stock-market-etf) | [Yahoo Finance adjusted history](https://finance.yahoo.com/quote/VTI/history/) · 2705 rows · 2016-01-04–2026-10-06 · USD · hash 78d060e11a41f5ca | identity/mandate/fee/history: pass/pass/pass/pass |
| IVV | U.S. large-cap equity index | [identity](https://www.ishares.com/us/products/239726/ishares-core-sp-500-etf-ivv) · [mandate](https://www.ishares.com/us/products/239726/ishares-core-sp-500-etf-ivv) | 0.030% net · 2026-03-31 | [issuer source](https://www.ishares.com/us/literature/summary-prospectus/sp-ishares-core-s-and-p-500-etf-3-31.pdf) | [Yahoo Finance adjusted history](https://finance.yahoo.com/quote/IVV/history/) · 2705 rows · 2016-01-04–2026-10-06 · USD · hash 5bd7f7de900c58cf | identity/mandate/fee/history: pass/pass/pass/pass |
| ITOT | U.S. total-market equity index | [identity](https://www.ishares.com/us/products/239724/ishares-core-sp-total-us-stock-market-etf) · [mandate](https://www.ishares.com/us/products/239724/ishares-core-sp-total-us-stock-market-etf) | 0.030% net · 2026-03-31 | [issuer source](https://www.ishares.com/us/literature/summary-prospectus/sp-ishares-core-s-and-p-total-us-stock-market-etf-3-31.pdf) | [Yahoo Finance adjusted history](https://finance.yahoo.com/quote/ITOT/history/) · 2705 rows · 2016-01-04–2026-10-06 · USD · hash 8b53b66ecfafd985 | identity/mandate/fee/history: pass/pass/pass/pass |
| SCHB | U.S. broad-market equity index | [identity](https://www.schwabassetmanagement.com/products/schb) · [mandate](https://www.schwabassetmanagement.com/products/schb) | 0.030% net · 2026-08-27 | [issuer source](https://www.schwabassetmanagement.com/product-finder?producttype=mf) | [Yahoo Finance adjusted history](https://finance.yahoo.com/quote/SCHB/history/) · 2705 rows · 2016-01-04–2026-10-06 · USD · hash 74879cc8902c2a8c | identity/mandate/fee/history: pass/pass/pass/pass |
| VXUS | International broad-market equity index · ex-U.S. | [identity](https://advisors.vanguard.com/investments/products/vxus/vanguard-total-international-stock-etf) · [mandate](https://advisors.vanguard.com/investments/products/vxus/vanguard-total-international-stock-etf) | 0.050% net · 2026-02-27 | [issuer source](https://advisors.vanguard.com/investments/products/vxus/vanguard-total-international-stock-etf) | [Yahoo Finance adjusted history](https://finance.yahoo.com/quote/VXUS/history/) · 2705 rows · 2016-01-04–2026-10-06 · USD · hash 0f1d14145511c491 | identity/mandate/fee/history: pass/pass/pass/pass |
| VEA | International developed-market equity index · ex-U.S. | [identity](https://advisors.vanguard.com/investments/products/vea/vanguard-ftse-developed-markets-et) · [mandate](https://advisors.vanguard.com/investments/products/vea/vanguard-ftse-developed-markets-et) | 0.030% net · 2026-04-28 | [issuer source](https://advisors.vanguard.com/investments/products/vea/vanguard-ftse-developed-markets-et) | [Yahoo Finance adjusted history](https://finance.yahoo.com/quote/VEA/history/) · 2705 rows · 2016-01-04–2026-10-06 · USD · hash 815bfd7d797e901f | identity/mandate/fee/history: pass/pass/pass/pass |
| IXUS | International broad-market equity index · ex-U.S. | [identity](https://www.ishares.com/us/products/244048/ishares-core-msci-total-international-stock-etf) · [mandate](https://www.ishares.com/us/products/244048/ishares-core-msci-total-international-stock-etf) | 0.070% net · 2026-07-31 | [issuer source](https://www.ishares.com/us/literature/summary-prospectus/sp-ishares-core-msci-total-international-stock-etf-7-31.pdf) | [Yahoo Finance adjusted history](https://finance.yahoo.com/quote/IXUS/history/) · 2705 rows · 2016-01-04–2026-10-06 · USD · hash 960bf891d62d2742 | identity/mandate/fee/history: pass/pass/pass/pass |

Issuer note: Vanguard renamed VTI to Vanguard Morningstar Total Stock Market ETF effective July 29, 2026; the issuer says the name change did not affect the investment objective or management. [Vanguard announcement](https://corporate.vanguard.com/content/corporatesite/us/en/corp/who-we-are/pressroom/press-release-vanguard-to-update-names-of-us-equity-index-funds-tracking-morningstar-indexes-042926.html).


## Common-cutoff scores and window validation

| ETF | Horizon | Status / score | Net fee points | Historical points | CAGR | Max drawdown | Downside deviation | Monthly returns | Daily sessions / expected / missing | Fee after cutoff | Input hash prefix | Blockers |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---|
| VOO | 1Y | validated · 90.8730 | 94.1765 | 88.3954 | 15.7782% | 8.9005% | 5.1738% | 12 | 252 / 252 / 0 | no | f0548ae582544e6d | — |
| VOO | 3Y | validated · 87.3512 | 94.1765 | 82.2323 | 22.8172% | 18.6894% | 5.4040% | 36 | 753 / 753 / 0 | no | 22cb7a620992729e | — |
| VTI | 1Y | validated · 90.6048 | 94.1765 | 87.9260 | 15.3515% | 8.9182% | 5.1319% | 12 | 252 / 252 / 0 | no | 37992c28a784994f | — |
| VTI | 3Y | validated · 86.7088 | 94.1765 | 81.1080 | 22.3014% | 19.3036% | 5.7853% | 36 | 753 / 753 / 0 | no | 7066a445ccd87878 | — |
| IVV | 1Y | validated · 90.8673 | 94.1765 | 88.3854 | 15.7906% | 8.8850% | 5.2130% | 12 | 252 / 252 / 0 | no | 5d6ced630d59a7ae | — |
| IVV | 3Y | validated · 87.2977 | 94.1765 | 82.1387 | 22.8097% | 18.7545% | 5.4271% | 36 | 753 / 753 / 0 | no | 51c64f60c810dfe5 | — |
| ITOT | 1Y | validated · 90.7075 | 94.1765 | 88.1058 | 15.4177% | 8.8983% | 5.0368% | 12 | 252 / 252 / 0 | no | 4877cd1e39431130 | — |
| ITOT | 3Y | validated · 86.6252 | 94.1765 | 80.9618 | 22.3229% | 19.4405% | 5.7860% | 36 | 753 / 753 / 0 | no | e248e0978f00b6ad | — |
| SCHB | 1Y | validated · 90.5817 | 94.1765 | 87.8857 | 15.2980% | 8.9133% | 5.1087% | 12 | 252 / 252 / 0 | no | 2bacc423cb1afaf4 | — |
| SCHB | 3Y | validated · 86.6947 | 94.1765 | 81.0834 | 22.3048% | 19.3435% | 5.7649% | 36 | 753 / 753 / 0 | no | c165b7dfd422c301 | — |
| VXUS | 1Y | validated · 87.5035 | 90.4837 | 85.2683 | 18.6594% | 11.2738% | 8.3624% | 12 | 252 / 252 / 0 | no | b9c4add75cc2bd66 | — |
| VXUS | 3Y | validated · 87.9605 | 90.4837 | 86.0682 | 20.1202% | 13.5800% | 6.3039% | 36 | 753 / 753 / 0 | no | a56684dd551abc4c | — |
| VEA | 1Y | validated · 88.9191 | 94.1765 | 84.9762 | 20.9837% | 11.6263% | 9.1439% | 12 | 252 / 252 / 0 | no | 9e7abfd83af7627a | — |
| VEA | 3Y | validated · 89.2824 | 94.1765 | 85.6118 | 20.8418% | 13.4533% | 7.0981% | 36 | 753 / 753 / 0 | no | 68dc4eaa16d2228f | — |
| IXUS | 1Y | validated · 85.9961 | 86.9358 | 85.2912 | 18.7209% | 11.3581% | 8.3088% | 12 | 252 / 252 / 0 | no | 7c634897a0e4575a | — |
| IXUS | 3Y | validated · 86.3938 | 86.9358 | 85.9874 | 20.2929% | 13.7464% | 6.2836% | 36 | 753 / 753 / 0 | no | 9328ac049c478437 | — |

## Historical-cutoff sensitivity

Each cell is `1Y / 3Y`, with the current dated fee held constant. All four historical cutoffs precede the issuer fee dates shown above, so these are cutoff-sensitivity scores rather than point-in-time backtests.

| ETF | 2019-12-31 · score 1Y / 3Y | 2020-03-31 · score 1Y / 3Y | 2022-12-30 · score 1Y / 3Y | 2024-12-31 · score 1Y / 3Y |
|---|---:|---:|---:|---:|
| VOO | 93.7093 / 83.1579 | 47.6383 / 62.8347 | 42.9903 / 65.5985 | 93.7704 / 72.3311 |
| VTI | 93.4976 / 82.2076 | 45.9998 / 60.6453 | 42.6195 / 64.2047 | 93.2759 / 70.3160 |
| IVV | 93.7388 / 83.1859 | 47.6191 / 62.7975 | 42.9902 / 65.6476 | 93.7541 / 72.2875 |
| ITOT | 93.5755 / 82.2133 | 46.0042 / 60.5745 | 42.6343 / 64.0978 | 93.3012 / 70.3966 |
| SCHB | 93.4876 / 82.1316 | 45.9453 / 60.4697 | 42.6296 / 64.0587 | 93.3148 / 70.4205 |
| VXUS | 91.1081 / 74.6198 | 41.4479 / 50.0977 | 41.9606 / 53.5308 | 72.4607 / 56.2678 |
| VEA | 93.0953 / 76.0865 | 43.2756 / 52.0325 | 43.6955 / 56.0244 | 68.9794 / 57.9364 |
| IXUS | 89.5996 / 73.4415 | 39.9836 / 49.0156 | 40.2889 / 51.7754 | 71.2140 / 54.4033 |

## Validation results

- Common cutoff: 16/16 scores have complete inputs.
- Historical sensitivity windows: 64/64 are complete and scored.
- Score reproducibility from retained adjusted history and dated fee inputs: pass; common-cutoff input hash prefixes are shown above and full history and input hashes are retained in the JSON artifact.
- Score bounds: pass. Scores are saved only when all row-level inputs pass.
- Batch ready for this validation milestone: yes.
- Price series are Yahoo Finance adjusted closes in USD. Dividends and splits are reflected in adjclose; no distribution is added a second time. No bid/ask spread was fetched or treated as zero.

## Precise blockers

- No data-acquisition or issuer-source blockers were recorded in the captured run. The application integrity limitation below remains unresolved.

## Follow-up reliability limitation and next milestone

Standalone Node tests reproduced the retained batch scores. During implementation, an attempted replay in the Next.js production page produced different history hashes and blocked score display; the cause was not established. The current page checks saved validation flags, validated row status, score bounds and the presence of an input hash. It does not recompute the artifact's integrity before displaying scores. The captured validation totals above therefore do not establish page-level integrity verification.

The batch runner also repeats the same scoring function to check determinism; this is not an independently implemented reference calculation. Historical-cutoff scores still hold the current disclosed fee constant, as described above.

The next milestone is to diagnose and fix page reproducibility, independently verify the real-data calculations, audit weight/curve sensitivity and meaningful precision, and collect historical fee evidence where available. Follow the [copyable audit handoff prompt](etf-equity-index-audit-handoff.md). This follow-up note records a limitation; it does not change the captured prices or scores.

## Scope

This eight-fund sample includes U.S. large-cap, U.S. total-market, international developed-market and broad international ex-U.S. index funds. It is not catalogue coverage, a recommendation, or a frozen methodology. Results from distinct mandates are shown without a pooled ranking. The candidate method applies only to verified equity-index funds; it is not reused for active equity, bonds, income, commodity, leveraged, ETN or other fund families.
