# ETF equity-index reliability and methodology audit

Audit generated 2026-10-07T04:02:06.436Z. Baseline capture: 2026-10-07T01:47:02.943Z; common cutoff 2026-09-30. The original JSON history and scores remain the audit baseline; the dated sidecar is a separate integrity manifest and the audit data is a separate experiment record.

## Replay diagnosis and integrity

The retained artifact replayed under Node 26.10.0: 16/16 common-cutoff scores and 64/64 historical windows. The prior Next.js hash mismatch was reproduced and traced to a changed numeric input in the generated JSON module: VOO history bar 278 is 180.93528747558594 in the retained file and 180.9352874755859 in the compiled module. This precision loss changed history and result hashes. The earlier page also trusted saved flags without replay.

The page now reads the source and manifest files as raw UTF-8 text before JSON parsing, preserving the stored IEEE-754 values. It compares a equity-index-integrity-v2 / canonical-json-key-order-v1 / SHA-256 manifest and recalculates scores from retained histories before display. Its input hashes cover source identity/mandate, full fee provenance, Yahoo history metadata and bars, window endpoints and returns, all current curve/weight parameters, and score output. Object properties are sorted before hashing; array order and exact parsed numbers remain intact. A digest is an integrity check, not a cryptographic signature.

Independent reference calculations covered 80 fund/horizon/cutoff rows. Maximum absolute difference across CAGR, daily drawdown, downside deviation, fee points, historical points and final scores: 1.421e-14 in their reported units; tolerance: 1e-10.

The reference derives month-end bars from the retained Yahoo history, daily peak-to-trough drawdown from the actual daily levels, CAGR from compounded monthly returns over actual endpoint days using 365.2425 days/year, and downside deviation as `100 × sqrt(12 × sum(min(monthlyReturn, 0)^2) / n)`. It then independently applies the recorded fee, logistic growth, drawdown, downside and weighted geometric-mean formulas. Dividends remain in Yahoo adjusted closes and are not added again.

## Baseline coverage

| ETF | Cutoff | Horizon | Independent CAGR | Daily drawdown | Downside deviation | Fee points | Historical points | Score | Daily sessions / expected / missing | Fee after cutoff |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| VOO | 2019-12-31 | 1Y | 31.3889% | 6.6395% | 6.5565% | 94.1765 | 93.3590 | 93.7093 | 253 / 253 / 0 | yes |
| VOO | 2019-12-31 | 3Y | 15.1673% | 19.4768% | 7.9159% | 94.1765 | 74.8940 | 83.1579 | 755 / 755 / 0 | yes |
| VOO | 2020-03-31 | 1Y | -6.9116% | 33.9930% | 16.2291% | 94.1765 | 12.7348 | 47.6383 | 254 / 254 / 0 | yes |
| VOO | 2020-03-31 | 3Y | 5.0920% | 33.9930% | 11.6673% | 94.1765 | 39.3284 | 62.8347 | 755 / 755 / 0 | yes |
| VOO | 2022-12-30 | 1Y | -18.2300% | 24.5207% | 17.7861% | 94.1765 | 4.6007 | 42.9903 | 252 / 252 / 0 | yes |
| VOO | 2022-12-30 | 3Y | 7.6404% | 33.9930% | 13.9123% | 94.1765 | 44.1650 | 65.5985 | 757 / 757 / 0 | yes |
| VOO | 2024-12-31 | 1Y | 24.7674% | 8.4464% | 4.7343% | 94.1765 | 93.4659 | 93.7704 | 253 / 253 / 0 | yes |
| VOO | 2024-12-31 | 3Y | 8.9077% | 24.5207% | 11.1785% | 94.1765 | 55.9471 | 72.3311 | 754 / 754 / 0 | yes |
| VOO | 2026-09-30 | 1Y | 15.7782% | 8.9005% | 5.1738% | 94.1765 | 88.3954 | 90.8730 | 252 / 252 / 0 | no |
| VOO | 2026-09-30 | 3Y | 22.8172% | 18.6894% | 5.4040% | 94.1765 | 82.2323 | 87.3512 | 753 / 753 / 0 | no |
| VTI | 2019-12-31 | 1Y | 30.6919% | 6.7848% | 6.7778% | 94.1765 | 92.9885 | 93.4976 | 253 / 253 / 0 | yes |
| VTI | 2019-12-31 | 3Y | 14.4922% | 20.0465% | 8.2269% | 94.1765 | 73.2309 | 82.2076 | 755 / 755 / 0 | yes |
| VTI | 2020-03-31 | 1Y | -9.1758% | 35.0003% | 17.3994% | 94.1765 | 9.8673 | 45.9998 | 254 / 254 / 0 | yes |
| VTI | 2020-03-31 | 3Y | 3.9903% | 35.0003% | 12.3807% | 94.1765 | 35.4970 | 60.6453 | 755 / 755 / 0 | yes |
| VTI | 2022-12-30 | 1Y | -19.5831% | 25.3633% | 18.0967% | 94.1765 | 3.9518 | 42.6195 | 252 / 252 / 0 | yes |
| VTI | 2022-12-30 | 3Y | 6.9924% | 35.0003% | 14.4081% | 94.1765 | 41.7259 | 64.2047 | 757 / 757 / 0 | yes |
| VTI | 2024-12-31 | 1Y | 23.6122% | 8.5704% | 5.3554% | 94.1765 | 92.6005 | 93.2759 | 253 / 253 / 0 | yes |
| VTI | 2024-12-31 | 3Y | 7.8892% | 25.3633% | 11.4851% | 94.1765 | 52.4207 | 70.3160 | 754 / 754 / 0 | yes |
| VTI | 2026-09-30 | 1Y | 15.3515% | 8.9182% | 5.1319% | 94.1765 | 87.9260 | 90.6048 | 252 / 252 / 0 | no |
| VTI | 2026-09-30 | 3Y | 22.3014% | 19.3036% | 5.7853% | 94.1765 | 81.1080 | 86.7088 | 753 / 753 / 0 | no |
| IVV | 2019-12-31 | 1Y | 31.2754% | 6.6315% | 6.5130% | 94.1765 | 93.4106 | 93.7388 | 253 / 253 / 0 | yes |
| IVV | 2019-12-31 | 3Y | 15.1324% | 19.3841% | 7.9234% | 94.1765 | 74.9429 | 83.1859 | 755 / 755 / 0 | yes |
| IVV | 2020-03-31 | 1Y | -6.9634% | 33.9032% | 16.1561% | 94.1765 | 12.7011 | 47.6191 | 254 / 254 / 0 | yes |
| IVV | 2020-03-31 | 3Y | 5.0448% | 33.9032% | 11.6468% | 94.1765 | 39.2634 | 62.7975 | 755 / 755 / 0 | yes |
| IVV | 2022-12-30 | 1Y | -18.2173% | 24.5276% | 17.8603% | 94.1765 | 4.6005 | 42.9902 | 252 / 252 / 0 | yes |
| IVV | 2022-12-30 | 3Y | 7.6581% | 33.9032% | 13.9230% | 94.1765 | 44.2510 | 65.6476 | 757 / 757 / 0 | yes |
| IVV | 2024-12-31 | 1Y | 24.7255% | 8.4126% | 4.7894% | 94.1765 | 93.4374 | 93.7541 | 253 / 253 / 0 | yes |
| IVV | 2024-12-31 | 3Y | 8.8959% | 24.5276% | 11.2250% | 94.1765 | 55.8708 | 72.2875 | 754 / 754 / 0 | yes |
| IVV | 2026-09-30 | 1Y | 15.7906% | 8.8850% | 5.2130% | 94.1765 | 88.3854 | 90.8673 | 252 / 252 / 0 | no |
| IVV | 2026-09-30 | 3Y | 22.8097% | 18.7545% | 5.4271% | 94.1765 | 82.1387 | 87.2977 | 753 / 753 / 0 | no |
| ITOT | 2019-12-31 | 1Y | 30.6941% | 6.8446% | 6.6257% | 94.1765 | 93.1248 | 93.5755 | 253 / 253 / 0 | yes |
| ITOT | 2019-12-31 | 3Y | 14.5055% | 20.1236% | 8.1576% | 94.1765 | 73.2409 | 82.2133 | 755 / 755 / 0 | yes |
| ITOT | 2020-03-31 | 1Y | -9.1763% | 35.0039% | 17.3459% | 94.1765 | 9.8750 | 46.0042 | 254 / 254 / 0 | yes |
| ITOT | 2020-03-31 | 3Y | 3.9335% | 35.0039% | 12.3372% | 94.1765 | 35.3730 | 60.5745 | 755 / 755 / 0 | yes |
| ITOT | 2022-12-30 | 1Y | -19.5291% | 25.3599% | 18.0311% | 94.1765 | 3.9777 | 42.6343 | 252 / 252 / 0 | yes |
| ITOT | 2022-12-30 | 3Y | 6.9074% | 35.0039% | 14.3868% | 94.1765 | 41.5387 | 64.0978 | 757 / 757 / 0 | yes |
| ITOT | 2024-12-31 | 1Y | 23.6022% | 8.4960% | 5.3686% | 94.1765 | 92.6447 | 93.3012 | 253 / 253 / 0 | yes |
| ITOT | 2024-12-31 | 3Y | 7.9304% | 25.3599% | 11.4507% | 94.1765 | 52.5617 | 70.3966 | 754 / 754 / 0 | yes |
| ITOT | 2026-09-30 | 1Y | 15.4177% | 8.8983% | 5.0368% | 94.1765 | 88.1058 | 90.7075 | 252 / 252 / 0 | no |
| ITOT | 2026-09-30 | 3Y | 22.3229% | 19.4405% | 5.7860% | 94.1765 | 80.9618 | 86.6252 | 753 / 753 / 0 | no |
| SCHB | 2019-12-31 | 1Y | 30.8181% | 6.7909% | 6.7928% | 94.1765 | 92.9710 | 93.4876 | 253 / 253 / 0 | yes |
| SCHB | 2019-12-31 | 3Y | 14.4997% | 20.1883% | 8.2270% | 94.1765 | 73.0980 | 82.1316 | 755 / 755 / 0 | yes |
| SCHB | 2020-03-31 | 1Y | -9.2291% | 35.2745% | 17.4492% | 94.1765 | 9.7719 | 45.9453 | 254 / 254 / 0 | yes |
| SCHB | 2020-03-31 | 3Y | 3.9257% | 35.2745% | 12.4014% | 94.1765 | 35.1897 | 60.4697 | 755 / 755 / 0 | yes |
| SCHB | 2022-12-30 | 1Y | -19.5156% | 25.4100% | 18.1970% | 94.1765 | 3.9695 | 42.6296 | 252 / 252 / 0 | yes |
| SCHB | 2022-12-30 | 3Y | 6.9739% | 35.2745% | 14.4968% | 94.1765 | 41.4704 | 64.0587 | 757 / 757 / 0 | yes |
| SCHB | 2024-12-31 | 1Y | 23.7296% | 8.5317% | 5.3389% | 94.1765 | 92.6686 | 93.3148 | 253 / 253 / 0 | yes |
| SCHB | 2024-12-31 | 3Y | 7.9850% | 25.4100% | 11.5282% | 94.1765 | 52.6035 | 70.4205 | 754 / 754 / 0 | yes |
| SCHB | 2026-09-30 | 1Y | 15.2980% | 8.9133% | 5.1087% | 94.1765 | 87.8857 | 90.5817 | 252 / 252 / 0 | no |
| SCHB | 2026-09-30 | 3Y | 22.3048% | 19.3435% | 5.7649% | 94.1765 | 81.0834 | 86.6947 | 753 / 753 / 0 | no |
| VXUS | 2019-12-31 | 1Y | 21.7618% | 8.2709% | 6.1653% | 90.4837 | 91.5764 | 91.1081 | 253 / 253 / 0 | yes |
| VXUS | 2019-12-31 | 3Y | 9.9093% | 23.0537% | 7.6650% | 90.4837 | 62.7218 | 74.6198 | 755 / 755 / 0 | yes |
| VXUS | 2020-03-31 | 1Y | -16.4616% | 34.9332% | 18.9079% | 90.4837 | 4.6711 | 41.4479 | 254 / 254 / 0 | yes |
| VXUS | 2020-03-31 | 3Y | -2.6156% | 35.9723% | 12.8550% | 90.4837 | 19.8082 | 50.0977 | 755 / 755 / 0 | yes |
| VXUS | 2022-12-30 | 1Y | -16.1305% | 28.4173% | 15.6295% | 90.4837 | 5.5682 | 41.9606 | 252 / 252 / 0 | yes |
| VXUS | 2022-12-30 | 3Y | 0.4032% | 34.9332% | 14.1880% | 90.4837 | 25.8161 | 53.5308 | 757 / 757 / 0 | yes |
| VXUS | 2024-12-31 | 1Y | 5.0400% | 8.5054% | 6.0969% | 90.4837 | 58.9434 | 72.4607 | 253 / 253 / 0 | yes |
| VXUS | 2024-12-31 | 3Y | 0.7181% | 28.4173% | 10.8649% | 90.4837 | 30.6058 | 56.2678 | 754 / 754 / 0 | yes |
| VXUS | 2026-09-30 | 1Y | 18.6594% | 11.2738% | 8.3624% | 90.4837 | 85.2683 | 87.5035 | 252 / 252 / 0 | no |
| VXUS | 2026-09-30 | 3Y | 20.1202% | 13.5800% | 6.3039% | 90.4837 | 86.0682 | 87.9605 | 753 / 753 / 0 | no |
| VEA | 2019-12-31 | 1Y | 22.6378% | 8.0000% | 5.9038% | 94.1765 | 92.2844 | 93.0953 | 253 / 253 / 0 | yes |
| VEA | 2019-12-31 | 3Y | 9.7380% | 22.8355% | 7.6379% | 94.1765 | 62.5190 | 76.0865 | 755 / 755 / 0 | yes |
| VEA | 2020-03-31 | 1Y | -15.6487% | 35.2692% | 18.2202% | 94.1765 | 5.1000 | 43.2756 | 254 / 254 / 0 | yes |
| VEA | 2020-03-31 | 3Y | -2.3751% | 35.7351% | 12.5450% | 94.1765 | 20.4245 | 52.0325 | 755 / 755 / 0 | yes |
| VEA | 2022-12-30 | 1Y | -15.3900% | 28.7683% | 16.9678% | 94.1765 | 5.8348 | 43.6955 | 252 / 252 / 0 | yes |
| VEA | 2022-12-30 | 3Y | 1.2243% | 35.2692% | 14.5513% | 94.1765 | 27.4103 | 56.0244 | 757 / 757 / 0 | yes |
| VEA | 2024-12-31 | 1Y | 3.1257% | 9.4302% | 7.3592% | 94.1765 | 50.0816 | 68.9794 | 253 / 253 / 0 | yes |
| VEA | 2024-12-31 | 3Y | 0.9850% | 28.7683% | 11.6823% | 94.1765 | 30.7563 | 57.9364 | 754 / 754 / 0 | yes |
| VEA | 2026-09-30 | 1Y | 20.9837% | 11.6263% | 9.1439% | 94.1765 | 84.9762 | 88.9191 | 252 / 252 / 0 | no |
| VEA | 2026-09-30 | 3Y | 20.8418% | 13.4533% | 7.0981% | 94.1765 | 85.6118 | 89.2824 | 753 / 753 / 0 | no |
| IXUS | 2019-12-31 | 1Y | 21.7238% | 8.2408% | 6.1571% | 86.9358 | 91.5974 | 89.5996 | 253 / 253 / 0 | yes |
| IXUS | 2019-12-31 | 3Y | 10.0966% | 23.0409% | 7.4968% | 86.9358 | 63.3208 | 73.4415 | 755 / 755 / 0 | yes |
| IXUS | 2020-03-31 | 1Y | -16.2747% | 35.2689% | 18.4991% | 86.9358 | 4.7695 | 39.9836 | 254 / 254 / 0 | yes |
| IXUS | 2020-03-31 | 3Y | -2.2251% | 36.2229% | 12.5554% | 86.9358 | 20.5754 | 49.0156 | 755 / 755 / 0 | yes |
| IXUS | 2022-12-30 | 1Y | -16.5170% | 28.8967% | 15.8374% | 86.9358 | 5.3037 | 40.2889 | 252 / 252 / 0 | yes |
| IXUS | 2022-12-30 | 3Y | 0.2514% | 35.2689% | 14.0902% | 86.9358 | 25.4052 | 51.7754 | 757 / 757 / 0 | yes |
| IXUS | 2024-12-31 | 1Y | 5.1520% | 8.5209% | 6.0376% | 86.9358 | 59.4227 | 71.2140 | 253 / 253 / 0 | yes |
| IXUS | 2024-12-31 | 3Y | 0.5897% | 28.8967% | 10.9997% | 86.9358 | 30.0039 | 54.4033 | 754 / 754 / 0 | yes |
| IXUS | 2026-09-30 | 1Y | 18.7209% | 11.3581% | 8.3088% | 86.9358 | 85.2912 | 85.9961 | 252 / 252 / 0 | no |
| IXUS | 2026-09-30 | 3Y | 20.2929% | 13.7464% | 6.2836% | 86.9358 | 85.9874 | 86.3938 | 753 / 753 / 0 | no |

## Sensitivity design and results

One-factor-at-a-time from the captured baseline: final fee weight +/-10 and +/-20 percentage points (historical weight is the complement); each historical component weight +/-10 and +/-20 points with remaining component weights re-normalized proportionally; fee scale and each growth/risk curve parameter multiplied by 0.8, 0.9, 1.1 and 1.2. No parameter combination was selected by fund rank.

The grid contains 37 configurations and 2960 score calculations from the same retained prices. Baseline score range is 39.9836–93.7704; across scenarios it is 23.5504–95.2480. 0 of 80 baseline scores are at least 95. All baseline and scenario component/final values remain in [0,100]: pass.

Baseline component ranges:

| Component | Minimum–maximum |
|---|---:|
| feePoints | 86.9358–94.1765 |
| growthPoints | 0.1011–99.7120 |
| drawdownPoints | 32.2648–93.4262 |
| downsidePoints | 38.6261–90.9408 |
| historicalPoints | 3.9518–93.4659 |
| score | 39.9836–93.7704 |

Comparable pair differences use the identical horizon and cutoff. Candidate groups are deliberately limited to VOO/IVV, VTI/ITOT/SCHB and VXUS/IXUS. VEA has no matched developed-market peer in this eight-fund sample. The indexes differ within the VTI/ITOT/SCHB group; FTSE and MSCI constructions differ within VXUS/IXUS. No cross-family or universal ranking is computed.

| Peer set | Pair | Cutoff | Horizon | Baseline left-minus-right | Range across scenarios | Order changes | Scenario ties |
|---|---|---|---|---:|---:|---:|---:|
| us-large-cap-s-and-p-500 | VOO / IVV | 2019-12-31 | 1Y | -0.0295 | -0.0504 to -0.0074 | 0/37 | 0/37 |
| us-large-cap-s-and-p-500 | VOO / IVV | 2019-12-31 | 3Y | -0.0280 | -0.0630 to 0.0114 | 1/37 | 0/37 |
| us-large-cap-s-and-p-500 | VOO / IVV | 2020-03-31 | 1Y | 0.0192 | -0.0088 to 0.0259 | 1/37 | 0/37 |
| us-large-cap-s-and-p-500 | VOO / IVV | 2020-03-31 | 3Y | 0.0372 | -0.0108 to 0.0792 | 1/37 | 0/37 |
| us-large-cap-s-and-p-500 | VOO / IVV | 2022-12-30 | 1Y | 0.0001 | -0.0018 to 0.0094 | 9/37 | 0/37 |
| us-large-cap-s-and-p-500 | VOO / IVV | 2022-12-30 | 3Y | -0.0491 | -0.0663 to -0.0319 | 0/37 | 0/37 |
| us-large-cap-s-and-p-500 | VOO / IVV | 2024-12-31 | 1Y | 0.0163 | -0.0096 to 0.0418 | 2/37 | 0/37 |
| us-large-cap-s-and-p-500 | VOO / IVV | 2024-12-31 | 3Y | 0.0436 | 0.0283 to 0.0594 | 0/37 | 0/37 |
| us-large-cap-s-and-p-500 | VOO / IVV | 2026-09-30 | 1Y | 0.0057 | -0.0145 to 0.0261 | 5/37 | 0/37 |
| us-large-cap-s-and-p-500 | VOO / IVV | 2026-09-30 | 3Y | 0.0535 | 0.0348 to 0.0722 | 0/37 | 0/37 |
| us-total-market | VTI / ITOT | 2019-12-31 | 1Y | -0.0779 | -0.1595 to 0.0087 | 1/37 | 0/37 |
| us-total-market | VTI / ITOT | 2019-12-31 | 3Y | -0.0057 | -0.0490 to 0.0356 | 8/37 | 0/37 |
| us-total-market | VTI / ITOT | 2020-03-31 | 1Y | -0.0044 | -0.0126 to -0.0002 | 0/37 | 0/37 |
| us-total-market | VTI / ITOT | 2020-03-31 | 3Y | 0.0708 | 0.0266 to 0.1069 | 0/37 | 0/37 |
| us-total-market | VTI / ITOT | 2022-12-30 | 1Y | -0.0148 | -0.0322 to -0.0059 | 0/37 | 0/37 |
| us-total-market | VTI / ITOT | 2022-12-30 | 3Y | 0.1070 | 0.0467 to 0.1689 | 0/37 | 0/37 |
| us-total-market | VTI / ITOT | 2024-12-31 | 1Y | -0.0252 | -0.0466 to -0.0034 | 0/37 | 0/37 |
| us-total-market | VTI / ITOT | 2024-12-31 | 3Y | -0.0806 | -0.1088 to -0.0524 | 0/37 | 0/37 |
| us-total-market | VTI / ITOT | 2026-09-30 | 1Y | -0.1028 | -0.1387 to -0.0668 | 0/37 | 0/37 |
| us-total-market | VTI / ITOT | 2026-09-30 | 3Y | 0.0836 | 0.0365 to 0.1231 | 0/37 | 0/37 |
| us-total-market | VTI / SCHB | 2019-12-31 | 1Y | 0.0100 | 0.0021 to 0.0174 | 0/37 | 0/37 |
| us-total-market | VTI / SCHB | 2019-12-31 | 3Y | 0.0760 | 0.0297 to 0.1170 | 0/37 | 0/37 |
| us-total-market | VTI / SCHB | 2020-03-31 | 1Y | 0.0545 | 0.0313 to 0.0933 | 0/37 | 0/37 |
| us-total-market | VTI / SCHB | 2020-03-31 | 3Y | 0.1756 | 0.1141 to 0.2371 | 0/37 | 0/37 |
| us-total-market | VTI / SCHB | 2022-12-30 | 1Y | -0.0101 | -0.0136 to -0.0024 | 0/37 | 0/37 |
| us-total-market | VTI / SCHB | 2022-12-30 | 3Y | 0.1461 | 0.0949 to 0.1972 | 0/37 | 0/37 |
| us-total-market | VTI / SCHB | 2024-12-31 | 1Y | -0.0389 | -0.0525 to -0.0253 | 0/37 | 0/37 |
| us-total-market | VTI / SCHB | 2024-12-31 | 3Y | -0.1045 | -0.1868 to -0.0189 | 0/37 | 0/37 |
| us-total-market | VTI / SCHB | 2026-09-30 | 1Y | 0.0230 | -0.0002 to 0.0460 | 1/37 | 0/37 |
| us-total-market | VTI / SCHB | 2026-09-30 | 3Y | 0.0141 | -0.0039 to 0.0294 | 2/37 | 0/37 |
| us-total-market | ITOT / SCHB | 2019-12-31 | 1Y | 0.0879 | -0.0066 to 0.1769 | 1/37 | 0/37 |
| us-total-market | ITOT / SCHB | 2019-12-31 | 3Y | 0.0817 | 0.0531 to 0.1103 | 0/37 | 0/37 |
| us-total-market | ITOT / SCHB | 2020-03-31 | 1Y | 0.0589 | 0.0327 to 0.1053 | 0/37 | 0/37 |
| us-total-market | ITOT / SCHB | 2020-03-31 | 3Y | 0.1048 | 0.0681 to 0.1431 | 0/37 | 0/37 |
| us-total-market | ITOT / SCHB | 2022-12-30 | 1Y | 0.0047 | -0.0003 to 0.0298 | 1/37 | 0/37 |
| us-total-market | ITOT / SCHB | 2022-12-30 | 3Y | 0.0391 | -0.0490 to 0.1246 | 3/37 | 0/37 |
| us-total-market | ITOT / SCHB | 2024-12-31 | 1Y | -0.0136 | -0.0324 to 0.0047 | 2/37 | 0/37 |
| us-total-market | ITOT / SCHB | 2024-12-31 | 3Y | -0.0239 | -0.0830 to 0.0375 | 4/37 | 0/37 |
| us-total-market | ITOT / SCHB | 2026-09-30 | 1Y | 0.1258 | 0.0818 to 0.1698 | 0/37 | 0/37 |
| us-total-market | ITOT / SCHB | 2026-09-30 | 3Y | -0.0695 | -0.0938 to -0.0405 | 0/37 | 0/37 |
| broad-international-ex-us | VXUS / IXUS | 2019-12-31 | 1Y | 1.5086 | 0.7948 to 2.2224 | 0/37 | 0/37 |
| broad-international-ex-us | VXUS / IXUS | 2019-12-31 | 3Y | 1.1783 | 0.3489 to 2.0077 | 0/37 | 0/37 |
| broad-international-ex-us | VXUS / IXUS | 2020-03-31 | 1Y | 1.4643 | 0.7350 to 2.1936 | 0/37 | 0/37 |
| broad-international-ex-us | VXUS / IXUS | 2020-03-31 | 3Y | 1.0821 | 0.2191 to 1.9452 | 0/37 | 0/37 |
| broad-international-ex-us | VXUS / IXUS | 2022-12-30 | 1Y | 1.6717 | 1.0150 to 2.3284 | 0/37 | 0/37 |
| broad-international-ex-us | VXUS / IXUS | 2022-12-30 | 3Y | 1.7554 | 1.1280 to 2.3828 | 0/37 | 0/37 |
| broad-international-ex-us | VXUS / IXUS | 2024-12-31 | 1Y | 1.2467 | 0.4412 to 2.0521 | 0/37 | 0/37 |
| broad-international-ex-us | VXUS / IXUS | 2024-12-31 | 3Y | 1.8645 | 1.2753 to 2.4537 | 0/37 | 0/37 |
| broad-international-ex-us | VXUS / IXUS | 2026-09-30 | 1Y | 1.5074 | 0.7933 to 2.2216 | 0/37 | 0/37 |
| broad-international-ex-us | VXUS / IXUS | 2026-09-30 | 3Y | 1.5667 | 0.8733 to 2.2601 | 0/37 | 0/37 |

Pearson correlations across the retained 80 windows: growth vs drawdown magnitude -0.724, growth vs downside deviation -0.900, drawdown magnitude vs downside deviation 0.823. The last pair shows overlap between two loss-sensitive components; the score gives them separate weights, so some adverse-return effects can be counted in both. Correlations are descriptive across eight funds and five cutoffs, not a validation of the weights.

The scenario order changes and rounded gaps do not support a stable precise rank. Display at one decimal place at most; a displayed equality means the rounded values coincide, not that fund returns or mandates are identical. Keep the formula experimental and do not interpret historical score gaps as evidence about future performance.

## Historical fee evidence

A fee can enter a point-in-time score only when an official issuer document was both available by that cutoff and shown to apply then, with net/gross and waiver terms established. Current fees are not carried backward.

| ETF | Cutoff | Fee | Evidence status | Document date | Official source | Exact blocker / limitation |
|---|---|---:|---|---|---|---|
| VOO | 2019-12-31 | 0.030% | disclosure-found-application-review-blocked | 2019-04-26 | [official filing](https://www.sec.gov/Archives/edgar/data/36405/000093247119006968/sp_968finaldate.htm) | 2019 Vanguard summary prospectus fee table; applicability through cutoff and intervening supplements still require issuer filing review. |
| VTI | 2019-12-31 | 0.030% | disclosure-found-application-review-blocked | 2019-04-26 | [official filing](https://www.sec.gov/Archives/edgar/data/36405/000093247119006977/sp_970042019blueline.htm) | 2019 Vanguard summary prospectus fee table; applicability through cutoff and intervening supplements still require issuer filing review. |
| IVV | 2019-12-31 | — | blocked-source-not-established | — | — | No issuer net-fee document published by 2019-12-31 with the applicable net/gross designation and waiver/expiry terms was established in this audit. The captured 0.030% fee dated 2026-03-31 is not substituted backward. |
| ITOT | 2019-12-31 | — | blocked-source-not-established | — | — | No issuer net-fee document published by 2019-12-31 with the applicable net/gross designation and waiver/expiry terms was established in this audit. The captured 0.030% fee dated 2026-03-31 is not substituted backward. |
| SCHB | 2019-12-31 | — | blocked-source-not-established | — | — | No issuer net-fee document published by 2019-12-31 with the applicable net/gross designation and waiver/expiry terms was established in this audit. The captured 0.030% fee dated 2026-08-27 is not substituted backward. |
| VXUS | 2019-12-31 | — | blocked-source-not-established | — | — | No issuer net-fee document published by 2019-12-31 with the applicable net/gross designation and waiver/expiry terms was established in this audit. The captured 0.050% fee dated 2026-02-27 is not substituted backward. |
| VEA | 2019-12-31 | 0.050% | disclosure-found-application-review-blocked | 2019-04-26 | [official filing](https://www.sec.gov/Archives/edgar/data/923202/000093247119006980/sp936.htm) | 2019 Vanguard summary prospectus fee table; applicability through cutoff and intervening supplements still require issuer filing review. |
| IXUS | 2019-12-31 | — | blocked-source-not-established | — | — | No issuer net-fee document published by 2019-12-31 with the applicable net/gross designation and waiver/expiry terms was established in this audit. The captured 0.070% fee dated 2026-07-31 is not substituted backward. |
| VOO | 2020-03-31 | 0.030% | disclosure-found-application-review-blocked | 2019-04-26 | [official filing](https://www.sec.gov/Archives/edgar/data/36405/000093247119006968/sp_968finaldate.htm) | Last located VOO annual prospectus before cutoff; issuer supplement/applicability review remains incomplete. |
| VTI | 2020-03-31 | 0.030% | disclosure-found-application-review-blocked | 2019-04-26 | [official filing](https://www.sec.gov/Archives/edgar/data/36405/000093247119006977/sp_970042019blueline.htm) | Last located VTI annual prospectus before cutoff; issuer supplement/applicability review remains incomplete. |
| IVV | 2020-03-31 | — | blocked-source-not-established | — | — | No issuer net-fee document published by 2020-03-31 with the applicable net/gross designation and waiver/expiry terms was established in this audit. The captured 0.030% fee dated 2026-03-31 is not substituted backward. |
| ITOT | 2020-03-31 | — | blocked-source-not-established | — | — | No issuer net-fee document published by 2020-03-31 with the applicable net/gross designation and waiver/expiry terms was established in this audit. The captured 0.030% fee dated 2026-03-31 is not substituted backward. |
| SCHB | 2020-03-31 | — | blocked-source-not-established | — | — | No issuer net-fee document published by 2020-03-31 with the applicable net/gross designation and waiver/expiry terms was established in this audit. The captured 0.030% fee dated 2026-08-27 is not substituted backward. |
| VXUS | 2020-03-31 | 0.080% | disclosure-found-application-review-blocked | 2020-02-27 | [official filing](https://www.sec.gov/Archives/edgar/data/736054/000168386320000445/f2508d1.htm) | 2020 Vanguard prospectus identifies the ETF share class and expense ratio; inspect fee-table page and supplements before point-in-time use. |
| VEA | 2020-03-31 | 0.050% | disclosure-found-application-review-blocked | 2019-04-26 | [official filing](https://www.sec.gov/Archives/edgar/data/923202/000093247119006980/sp936.htm) | Last located VEA annual prospectus before cutoff; issuer supplement/applicability review remains incomplete. |
| IXUS | 2020-03-31 | — | blocked-source-not-established | — | — | No issuer net-fee document published by 2020-03-31 with the applicable net/gross designation and waiver/expiry terms was established in this audit. The captured 0.070% fee dated 2026-07-31 is not substituted backward. |
| VOO | 2022-12-30 | — | blocked-source-not-established | — | — | No issuer net-fee document published by 2022-12-30 with the applicable net/gross designation and waiver/expiry terms was established in this audit. The captured 0.030% fee dated 2026-04-28 is not substituted backward. |
| VTI | 2022-12-30 | — | blocked-source-not-established | — | — | No issuer net-fee document published by 2022-12-30 with the applicable net/gross designation and waiver/expiry terms was established in this audit. The captured 0.030% fee dated 2026-04-28 is not substituted backward. |
| IVV | 2022-12-30 | — | blocked-source-not-established | — | — | No issuer net-fee document published by 2022-12-30 with the applicable net/gross designation and waiver/expiry terms was established in this audit. The captured 0.030% fee dated 2026-03-31 is not substituted backward. |
| ITOT | 2022-12-30 | — | blocked-source-not-established | — | — | No issuer net-fee document published by 2022-12-30 with the applicable net/gross designation and waiver/expiry terms was established in this audit. The captured 0.030% fee dated 2026-03-31 is not substituted backward. |
| SCHB | 2022-12-30 | — | blocked-source-not-established | — | — | No issuer net-fee document published by 2022-12-30 with the applicable net/gross designation and waiver/expiry terms was established in this audit. The captured 0.030% fee dated 2026-08-27 is not substituted backward. |
| VXUS | 2022-12-30 | — | blocked-source-not-established | — | — | No issuer net-fee document published by 2022-12-30 with the applicable net/gross designation and waiver/expiry terms was established in this audit. The captured 0.050% fee dated 2026-02-27 is not substituted backward. |
| VEA | 2022-12-30 | — | blocked-source-not-established | — | — | No issuer net-fee document published by 2022-12-30 with the applicable net/gross designation and waiver/expiry terms was established in this audit. The captured 0.030% fee dated 2026-04-28 is not substituted backward. |
| IXUS | 2022-12-30 | — | blocked-source-not-established | — | — | No issuer net-fee document published by 2022-12-30 with the applicable net/gross designation and waiver/expiry terms was established in this audit. The captured 0.070% fee dated 2026-07-31 is not substituted backward. |
| VOO | 2024-12-31 | — | blocked-source-not-established | — | — | No issuer net-fee document published by 2024-12-31 with the applicable net/gross designation and waiver/expiry terms was established in this audit. The captured 0.030% fee dated 2026-04-28 is not substituted backward. |
| VTI | 2024-12-31 | — | blocked-source-not-established | — | — | No issuer net-fee document published by 2024-12-31 with the applicable net/gross designation and waiver/expiry terms was established in this audit. The captured 0.030% fee dated 2026-04-28 is not substituted backward. |
| IVV | 2024-12-31 | — | blocked-source-not-established | — | — | No issuer net-fee document published by 2024-12-31 with the applicable net/gross designation and waiver/expiry terms was established in this audit. The captured 0.030% fee dated 2026-03-31 is not substituted backward. |
| ITOT | 2024-12-31 | — | blocked-source-not-established | — | — | No issuer net-fee document published by 2024-12-31 with the applicable net/gross designation and waiver/expiry terms was established in this audit. The captured 0.030% fee dated 2026-03-31 is not substituted backward. |
| SCHB | 2024-12-31 | — | blocked-source-not-established | — | — | No issuer net-fee document published by 2024-12-31 with the applicable net/gross designation and waiver/expiry terms was established in this audit. The captured 0.030% fee dated 2026-08-27 is not substituted backward. |
| VXUS | 2024-12-31 | — | blocked-source-not-established | — | — | No issuer net-fee document published by 2024-12-31 with the applicable net/gross designation and waiver/expiry terms was established in this audit. The captured 0.050% fee dated 2026-02-27 is not substituted backward. |
| VEA | 2024-12-31 | — | blocked-source-not-established | — | — | No issuer net-fee document published by 2024-12-31 with the applicable net/gross designation and waiver/expiry terms was established in this audit. The captured 0.030% fee dated 2026-04-28 is not substituted backward. |
| IXUS | 2024-12-31 | — | blocked-source-not-established | — | — | No issuer net-fee document published by 2024-12-31 with the applicable net/gross designation and waiver/expiry terms was established in this audit. The captured 0.070% fee dated 2026-07-31 is not substituted backward. |
| VOO | 2026-09-30 | 0.030% | verified-current-disclosure | 2026-04-28 | [official filing](https://advisors.vanguard.com/investments/products/voo/vanguard-sp-500-etf) | — |
| VTI | 2026-09-30 | 0.030% | verified-current-disclosure | 2026-04-28 | [official filing](https://advisors.vanguard.com/investments/products/vti/vanguard-total-stock-market-etf) | — |
| IVV | 2026-09-30 | 0.030% | verified-current-disclosure | 2026-03-31 | [official filing](https://www.ishares.com/us/literature/summary-prospectus/sp-ishares-core-s-and-p-500-etf-3-31.pdf) | — |
| ITOT | 2026-09-30 | 0.030% | verified-current-disclosure | 2026-03-31 | [official filing](https://www.ishares.com/us/literature/summary-prospectus/sp-ishares-core-s-and-p-total-us-stock-market-etf-3-31.pdf) | — |
| SCHB | 2026-09-30 | 0.030% | verified-current-disclosure | 2026-08-27 | [official filing](https://www.schwabassetmanagement.com/product-finder?producttype=mf) | — |
| VXUS | 2026-09-30 | 0.050% | verified-current-disclosure | 2026-02-27 | [official filing](https://advisors.vanguard.com/investments/products/vxus/vanguard-total-international-stock-etf) | — |
| VEA | 2026-09-30 | 0.030% | verified-current-disclosure | 2026-04-28 | [official filing](https://advisors.vanguard.com/investments/products/vea/vanguard-ftse-developed-markets-et) | — |
| IXUS | 2026-09-30 | 0.070% | verified-current-disclosure | 2026-07-31 | [official filing](https://www.ishares.com/us/literature/summary-prospectus/sp-ishares-core-msci-total-international-stock-etf-7-31.pdf) | — |

The 32 historical fee rows remain blocked; only current, dated fees at the 2026-09-30 common cutoff are treated as eligible in this audit output. Archived evidence found for VOO, VTI and VEA (2019 prospectuses) and VXUS (2020 prospectus) is recorded without treating a found document as proof that every supplement, fee designation, waiver or expiry term was resolved. The point-in-time score branch stays blocked wherever applicability is incomplete. Current-fee results at 2019–2024 market cutoffs remain sensitivity analysis only.

## M1 disposition and limitations

Passed: retained-data score replay in the supported runtime; independent calculation agreement; versioned canonical input/output manifest generation; mutation tests for price, fee, source, scoring parameters and saved scores; baseline and scenario bounds; explicit mandate-limited peer comparisons; production page verification from the built application.

Blocked or unresolved: historical point-in-time fee applicability/waiver evidence is incomplete for the 2019–2024 cutoffs; present freshness is not reassessed by this static saved-batch page. The page distinguishes capture-time validity from present freshness.

Recommendation: keep the equity-index method experimental. The independent arithmetic and display-time integrity gates pass on the retained baseline. Historical fee evidence blocks point-in-time scoring for the historical cutoffs; M2 may specify a current-fee candidate with those restrictions explicit, but do not expand or publish rankings based on the blocked branch.

Reproducible artifacts: [audit inputs and scenario results](../data/etf-equity-index-audit-2026-10-07.json), [page integrity manifest](../data/etf-equity-index-validation-integrity.json), and [audit script](../scripts/audit-etf-equity-index-validation-batch.mjs).
