# Pluang ETF research and complete public-catalogue audit

Research date: **2026-10-06 (Asia/Jakarta)**. Companion to [ETF page plan](etf-page-plan.md).

## Findings and scope

The public catalogue audit accounts for **all 1,024 records across 103 US-market catalogue pages**, including every public profile’s reported security type. The separate ETF category contains **212 unique records across 22 pages**, but is not the complete ETF universe. After reconciliation, retain **216 ETF/ETF-like candidates** (including metal trusts, commodity pools, and bitcoin trusts), track **three ETNs separately**, and exclude **three stocks/closed-end funds**. One retained candidate, FLOT, has an unresolved product-identity conflict. These are dated **catalogue-listed** records; no authenticated account order eligibility was confirmed.

This report completes the public-catalogue enumeration and provides per-product exposure research, classification, issuer source locators, discrepancies, and metric feasibility. **It does not complete a validated, matched-date financial-statistics dataset.** Source observations below are research leads, not production figures. No 5Y/10Y return, historical average distribution yield, drawdown, or recovery statistic has been calculated or certified in this audit. These limitations must remain visible in the page plan.

The census is reproducible from the saved [audit manifest](research/pluang-etf-2026-10-06/audit-manifest.json), [ETF category snapshot](research/pluang-etf-2026-10-06/inventory.json), [complete US inventory](research/pluang-etf-2026-10-06/us-inventory.json), [1,024-profile security-type audit](research/pluang-etf-2026-10-06/security-type-audit.json), and [222-record research universe](research/pluang-etf-2026-10-06/research-universe.json). Source URLs and retrieval timestamps are retained in the page/profile snapshots. Snapshot prices are raw evidence only, not a total-return series.

## How completeness was checked

1. Read the existing page plan before gathering data; use its universe, instrument-type, and missing-data rules.
2. Fetch the authoritative public [ETF Explore catalogue](https://pluang.com/explore/us-market/etf) and parse its server-rendered `__NEXT_DATA__.props.pageProps.data`. Capture pages 1–22, including reported total, total pages, page size, asset IDs, symbols, names, and original response data.
3. Verify **21 × 10 + 2 = 212**, with 212 distinct asset IDs and tickers. A page-23 request is clamped to page 22 and repeats QDTY/CTEC; it does not add products. Do not terminate a crawler solely on an empty-page assumption.
4. Fetch **every page 1–103** of [US-market Explore](https://pluang.com/explore/us-market/stocks). Verify **102 × 10 + 4 = 1,024**, with 1,024 distinct IDs and tickers, then fetch every corresponding public asset profile. The profile census yields 222 `ETF` and 802 `STOCK` labels.
5. Reconcile the ETF category against that complete security-type census, rather than only scanning names for “ETF.” Nine genuine ETF additions and ACP are outside the ETF category. Review all 222 ETF-labeled records for true structure.
6. Locate issuer material for every research record, prefer US fund documents, and retain platform identity separately from corrected exposure. Broad issuer catalogues/marketing pages are source locators rather than validated individual fact sheets. Do not substitute an overseas UCITS/ASX fund with the same ticker.
7. Account for each discovery once: **212 + 10 = 222 = 216 retained candidates + 3 ETNs + 3 exclusions**. All records remain in the research universe; exclusions are explicit.

The snapshot covers the complete **observed public US catalogue**, not undisclosed app-only listings or account-specific eligibility. Both sweeps had stable reported totals and no duplicates. Public marketing pages alone are not evidence that an omitted historical product is still offered. Re-run reconciliation when the catalogue changes; do not describe this dated snapshot as permanently exhaustive.

## Catalogue errors, additions, and identity conflicts

| Finding | Evidence and treatment |
|---|---|
| Nine ETFs omitted from the ETF category | **VTI, SPY, VWO, IWM, XLF, XLV, XLE, LQD, XLY** occur in the full US catalogue and public profiles with `securityType=ETF`. Include them in the page. Their inventory entries retain the original US catalogue page and platform asset ID. |
| Two company stocks inside the ETF category | **FCNCA** is First Citizens BancShares; **TEM** is Tempus AI. Their Pluang profiles incorrectly say ETF. Exclude from ETF results and preserve the exclusion records. [First Citizens investor relations](https://ir.firstcitizens.com/overview/default.aspx), [Tempus filings](https://investors.tempus.com/node/10361/html). |
| A closed-end fund outside the ETF category | **ACP**, abrdn Income Credit Strategies Fund, is labeled ETF in its public profile but is a closed-end fund. Exclude from ETF results; a future CEF page can handle its discount/leverage separately. [Aberdeen CEF range](https://www.aberdeeninvestments.com/en-us/investor/investment-solutions/closed-end-funds/fund-range). |
| Three ETNs labeled ETF | **FNGU, SLVO, USOI** are notes, not funds holding investor-owned ETF portfolios. Keep a separate ETN section with issuer-credit, call/redemption, maturity, and indicative-value risks. [MicroSectors](https://microsectors.com/fang/), [SLVO](https://etracs.ubs.com/product/detail/index/ussymbol/SLVO), [USOI](https://etracs.ubs.com/product/detail/overview/ussymbol/USOI). |
| FLOT cross-market identity conflict | Pluang calls it **VanEck Australian Floating Rate ETF**, and its description discusses AUD bonds. Its USD price range is approximately $51, consistent with the US **iShares Floating Rate Bond ETF**. The US issuer identifies USD investment-grade floating-rate bonds, CUSIP 46429B655. Treat the US identity as a strong inference, not confirmed contract mapping: require Pluang exchange/CUSIP confirmation before ingesting statistics. Keep visible under “Identity needs verification.” [US iShares FLOT](https://www.ishares.com/us/products/239534/ishares-floating-rate-bond-etf). |
| ROBO issuer mislabel | Pluang says “Global X Robo Global.” The US ROBO issuer page identifies **ROBO Global Robotics & Automation Index ETF**, CUSIP 301505707. Correct the issuer/source mapping; do not confuse it with Global X BOTZ. [ROBO issuer](https://www.roboglobaletfs.com/robo?hsLang=en). |
| FNGU index and series history | Pluang says “FANG and Innovation”; current issuer material maps **FNGU to NYSE FANG+**, while FANG & Innovation uses other tickers. The note has redemption/ticker/series history. Verify the current-series CUSIP and do not stitch predecessor prices into live performance without corporate-action review. [MicroSectors FANG+](https://microsectors.com/fang/), [BMO note listings](https://www.bmoetns.com/Home/FANG%20ETNs). |
| Strategy/name changes | Issuer pages use newer names for ARKF (Blockchain & Fintech), ARKW (Next Generation Technology), CTEC (ClimateTech), and several Vanguard Morningstar funds. POWR’s older inception predates its present name/mandate. Keep platform aliases and research current benchmarks/effective dates before interpreting long histories as a single unchanged strategy. |
| Misleading leveraged category | Pluang’s leveraged/inverse bucket also contains JPST and VUSB. A category membership is not proof of fund-level leverage. Use issuer mandate, leverage multiple, and reset interval. |
| Weak financial metadata | “Market Cap” is not a validated ETF AUM field. Some catalogue values use `M` where issuer assets are in billions; Vanguard total fund assets can differ from ETF-share-class assets. Do not copy these into AUM. Public `DIVIDEND_YIELD='-'` means unknown, not zero. |

## Pluang access, fees, and availability

Pluang describes US-stock/ETF access through **PT PG Berjangka and PALN**, with orders routed overseas and local JFX/KBI recording. Its current fee page explicitly distinguishes PALN from CFD. Store this platform access model separately from the underlying fund’s legal structure; do not imply direct broker custody rights without reviewing the customer agreement. [Current platform fee/access page](https://pluang.com/biaya/us-stocks?feesTab=us-stocks).

The same page lists transaction charges of **0.30% regular / 0.20% Plus**, plus **JFX/KBI 0.05% capped at $0.10**, applicable VAT, and US sell-side regulatory charges. It lists dividend deductions of **15% without platform leverage / 30% with leverage**, and daily overnight leverage fees of **0.0208% regular / 0.0125% Plus**, subject to change. These are published platform rules, not universal personal tax assumptions. FX spread and net conversion cost were not quantified. Older FAQs conflict on VAT inclusion and regulatory rates; use the dated fee page and actual order preview when building a cost calculator. [Fee schedule](https://pluang.com/biaya/us-stocks?feesTab=us-stocks).

The general product FAQ advertises ETF purchases from **US$1**. Individual public profiles may expose different technical minimum fields, and order eligibility depends on KYC, account, trading session, and product. Unauthenticated profiles expose `transactionAllowed=false` and sometimes disabled buy/sell flags alongside KYC prompts. **These flags cannot establish that the fund is suspended or removed.** No orders were placed. [Pluang product FAQ](https://pluang.com/faq/other-issues-general/about-pluang-general/produk-investasi-di-pluang).

## Category coverage

Counts below are mutually exclusive browsing groups for this research, not the final underlying-asset-class taxonomy. Leveraged/options products also need underlying-asset tags. NVDW is included in the income group but must carry a leverage badge with a **weekly** reset target.

| Research group | Count |
|---|---:|
| US broad market and styles | 19 |
| International and global equities | 34 |
| Fixed income and preferred securities | 28 |
| Sector and thematic equities | 59 |
| Physical precious metals | 7 |
| Dividend equities | 7 |
| Real estate and infrastructure equities | 5 |
| Spot digital asset trusts | 2 |
| Options income and distribution strategies | 20 |
| Leveraged and inverse ETFs | 21 |
| Exclusions | 3 |
| Commodity futures | 12 |
| Multi-asset allocation | 1 |
| ETNs — separate from ETFs | 3 |
| Digital asset futures | 1 |

## What each group contributes and what to compare

| Group | Portfolio exposure / comparison | Main risks and required extra fields |
|---|---|---|
| Broad US/style | Market growth; compare VOO/IVV/SPY, QQQ/QQQM/QQQE, and growth/value/small-cap peers | Equity drawdowns, concentration, size/style cycles; benchmark, top-ten weight, fees, total return |
| International/global | Geography beyond US holdings; VT/ACWI combine US and overseas, VXUS does not | FX, country/political concentration; index country rules, country weights, overlap |
| Dividend equities | Cash distributions from equity holdings | High yield can reflect falling prices; payout cuts, sector concentration; reinvested return and historical distributions |
| Bonds/preferreds | Interest income and duration/credit exposure | Duration, credit, mortgage prepayment, local-currency FX; SEC yield, effective duration, ratings, maturity; preferreds are not Treasury cash |
| Real estate/infrastructure | REIT/property/digital-infrastructure exposure | Rates, financing costs, geographic/tenant/sector concentration; distinguish REIT weights from technology stocks |
| Sector/theme | Targeted economic or technology exposure | Narrow exposures, valuation and thematic cycles; holdings/sector weights; miners are company shares, not physical commodities |
| Options income | Cash distribution strategies over equities/indices | Capped/altered upside, downside exposure, ELN/counterparty risk, possible return of capital; distribution composition and total return |
| Leveraged/inverse | Target multiple of a stated daily benchmark | Path-dependent compounding, resets, derivatives/counterparty and concentration risk; reset period and historical multiple changes |
| Physical metals | Bullion exposure | Metal-price volatility, custody/structure fees, no inherent interest/dividend stream; verify no-distribution status per trust |
| Commodity futures | Futures-price exposure to energy/agriculture/metals | Roll yield, curve shape, collateral, derivatives and pool expenses; do not compare directly with spot commodity prices |
| Spot bitcoin / bitcoin futures | Crypto exposure via a listed vehicle | Large drawdowns, custody/derivatives risk; futures are not spot; current holdings and mandate |
| Multi-asset | Allocation through underlying funds | Stock/bond allocation and acquired-fund expenses; underlying holdings and total effective costs |
| ETNs | Bank-issued index-linked obligations | Bank credit, acceleration/call, maturity, indicative-value versus market price; coupons are not ETF dividends |

Risk explanations are descriptive, not rankings or personal allocation recommendations. Category-level statements must be applied with each fund’s actual mandate. Peer sets below are Pluang-available only; do not present them as the entire US ETF market.

## Complete categorized product inventory

All **222 discovered ETF-labeled records** are listed below, including the three ETNs and three exclusions. Ticker links open the exact Pluang asset ID; issuer links identify the research source. “ETF pN” means the ETF-category page; “US pN” means an addition found only in the broader catalogue. Names are preserved as Pluang supplied them; exposure/structure corrections are separate. Every retained record has availability status **catalogue-listed, account tradability unchecked**.

### US broad market and styles — 19

| Ticker / Pluang name | Exposure and special treatment | Issuer research | Catalogue |
|---|---|---|---|
| [AVUV](https://pluang.com/asset/usstock/AVUV/11178) — Avantis US Small Cap Value ETF | Active US small-cap value equities | [Avantis](https://www.avantisinvestors.com/avantis-investments/avantis-us-small-cap-value-etf/AVUV/) | ETF p5 |
| [DIA](https://pluang.com/asset/usstock/DIA/10752) — Dow Jones Industrial Average ETF | Dow Jones Industrial Average price-weighted US equity trust | [State Street](https://www.ssga.com/us/en/individual/etfs/state-street-spdr-dow-jones-industrial-average-etf-trust-dia) | ETF p4 |
| [HLAL](https://pluang.com/asset/usstock/HLAL/11191) — Wahed FTSE USA Shariah ETF | US equities screened under Sharia criteria | [Wahed](https://www.wahed.com/hlal) | ETF p15 |
| [IVV](https://pluang.com/asset/usstock/IVV/11098) — iShares Core S&P 500 ETF | S&P 500 large-cap US equities | [iShares](https://www.ishares.com/us/products/239726/ishares-core-total-stock-market-etf) | ETF p1 |
| [IWM](https://pluang.com/asset/usstock/IWM/10760) — iShares Russell 2000 ETF | Russell 2000 US small-cap equities | [iShares](https://www.ishares.com/us/products/239710/ishares-russell-2000-etf) | US p83 |
| [MGK](https://pluang.com/asset/usstock/MGK/11206) — Vanguard Mega Cap Growth ETF | US mega-cap growth equities; confirm current benchmark/name | [Vanguard](https://advisors.vanguard.com/investments/products/mgk/vanguard-mega-cap-growth-etf) | ETF p4 |
| [QQQ](https://pluang.com/asset/usstock/QQQ/10738) — Nasdaq100 ETF | Nasdaq-100 nonfinancial companies | [Invesco](https://www.invesco.com/qqq-etf/en/home.html) | ETF p1 |
| [QQQE](https://pluang.com/asset/usstock/QQQE/11105) — Direxion NASDAQ 100 Equal Weighted Index Shares | Equal-weighted Nasdaq-100 | [Direxion](https://www.direxion.com/product/nasdaq-100-equal-weighted-index-etf) | ETF p14 |
| [QQQM](https://pluang.com/asset/usstock/QQQM/10986) — Invesco NASDAQ 100 ETF | Nasdaq-100 nonfinancial companies | [Invesco](https://www.invesco.com/us-rest/contentdetail?contentId=3bb2c37291215710VgnVCM1000006e36b50aRCRD&dnsName=us) | ETF p2 |
| [SCHG](https://pluang.com/asset/usstock/SCHG/11009) — Schwab US Large Cap Growth ETF | US large-cap growth equities | [Schwab](https://www.schwabassetmanagement.com/products/schg) | ETF p3 |
| [SPLV](https://pluang.com/asset/usstock/SPLV/10777) — Invesco S&P 500 Low Volatility ETF | Lower-volatility S&P 500 constituents | [Invesco](https://www.invesco.com/us/en/financial-products/etfs/invesco-sp-500-low-volatility-etf.html) | ETF p9 |
| [SPMO](https://pluang.com/asset/usstock/SPMO/11142) — Invesco S&P 500 Momentum ETF | S&P 500 momentum equities | [Invesco](https://www.invesco.com/us/financial-products/etfs/holdings?audienceType=Institutional&ticker=SPMO) | ETF p5 |
| [SPUS](https://pluang.com/asset/usstock/SPUS/11193) — SP Funds S&P 500 Sharia Industry Exclusions ETF | US equities screened under Sharia criteria | [SP Funds](https://www.sp-funds.com/SPUS/) | ETF p11 |
| [SPY](https://pluang.com/asset/usstock/SPY/10751) — S&P500 ETF | S&P 500 US equity ETF trust | [State Street](https://www.ssga.com/us/en/intermediary/etfs/state-street-spdr-sp-500-etf-trust-spy) | US p81 |
| [VOO](https://pluang.com/asset/usstock/VOO/11074) — Vanguard S&P 500 ETF | S&P 500 large-cap US equities | [Vanguard](https://advisors.vanguard.com/investments/products/voo/vanguard-sp-500-etf?fromSearch=true&source=autosuggest) | ETF p1 |
| [VOOG](https://pluang.com/asset/usstock/VOOG/11200) — Vanguard S&P 500 Growth Index Fund ETF | S&P 500 growth equities | [Vanguard](https://advisors.vanguard.com/investments/products/voog/vanguard-sp-500-growth-etf?source=content_type%3Areact%7Cfirst_level_url%3Aarticle%7Csection%3Amain_content%7Cbutton%3Abody_link) | ETF p5 |
| [VTI](https://pluang.com/asset/usstock/VTI/10761) — Vanguard Total Stock Market Index Fund ETF | Total US equity market, including smaller companies | [Vanguard](https://advisors.vanguard.com/investments/products/vti/vanguard-total-stock-market-etf) | US p81 |
| [VTV](https://pluang.com/asset/usstock/VTV/10733) — Vanguard Value Index Fund ETF | US large-cap value equities | [Vanguard](https://advisors.vanguard.com/investments/products/vtv/vanguard-value-etf) | ETF p1 |
| [VUG](https://pluang.com/asset/usstock/VUG/11171) — Vanguard Growth Index Fund ETF | US large-cap growth equities; confirm current benchmark/name | [Vanguard](https://advisors.vanguard.com/investments/products/vug/vanguard-growth-etf) | ETF p1 |

### International and global equities — 34

| Ticker / Pluang name | Exposure and special treatment | Issuer research | Catalogue |
|---|---|---|---|
| [ACWI](https://pluang.com/asset/usstock/ACWI/10775) — iShares MSCI ACWI ETF | Global developed and emerging large/mid-cap equities | [iShares](https://www.ishares.com/us/products/239600/ishares-msci-acwi-etf) | ETF p5 |
| [ARGT](https://pluang.com/asset/usstock/ARGT/11217) — Global X MSCI Argentina ETF | Argentina-related equities | [Global X](https://www.globalxetfs.com/funds/ARGT) | ETF p17 |
| [ASEA](https://pluang.com/asset/usstock/ASEA/11236) — Global X FTSE Southeast Asia ETF | Southeast Asian equities | [Global X](https://www.globalxetfs.com/funds/ASEA) | ETF p21 |
| [AVDV](https://pluang.com/asset/usstock/AVDV/11180) — Avantis International Small Cap Value ETF | Active developed ex-US small-cap value equities | [Avantis](https://www.avantisinvestors.com/avantis-investments/avantis-international-small-cap-value-etf/trading-details/) | ETF p6 |
| [EIDO](https://pluang.com/asset/usstock/EIDO/10774) — iShares MSCI Indonesia ETF | Indonesian equities listed through a US ETF | [iShares](https://www.ishares.com/us/products/239661/ishares-msci-indonesia-etf?qt=EEMS) | ETF p18 |
| [EWA](https://pluang.com/asset/usstock/EWA/11060) — iShares MSCI Australia ETF | Australian equities | [iShares](https://www.ishares.com/us/products/239607/ishares-msci-australia-etf) | ETF p15 |
| [EWC](https://pluang.com/asset/usstock/EWC/11132) — iShares MSCI Canada (TSX) | Canadian equities | [iShares](https://www.ishares.com/us/products/239615/EWC) | ETF p9 |
| [EWG](https://pluang.com/asset/usstock/EWG/11162) — iShares MSCI Germany (DAX) | German equities | [iShares](https://www.ishares.com/us/products/239650/EWG) | ETF p14 |
| [EWH](https://pluang.com/asset/usstock/EWH/11052) — iShares MSCI Hong Kong ETF | Hong Kong equities | [iShares](https://www.ishares.com/us/products/239657/ishares-msci-hong-kong-etf?fundSearch=true&qt=EEMS) | ETF p15 |
| [EWI](https://pluang.com/asset/usstock/EWI/11201) — Ishares Msci Italy ETF | Italian equities | [iShares](https://www.ishares.com/us/products/239664/EI) | ETF p15 |
| [EWJ](https://pluang.com/asset/usstock/EWJ/11050) — iShares MSCI Japan ETF | Japanese equities | [iShares](https://www.ishares.com/us/products/239665/ishares-msci-japan-etf) | ETF p5 |
| [EWM](https://pluang.com/asset/usstock/EWM/11221) — iShares MSCI Malaysia ETF | Malaysian equities | [iShares](https://www.ishares.com/us/products/239669/ishares-core-u-s-aggregate-bond-etf) | ETF p20 |
| [EWP](https://pluang.com/asset/usstock/EWP/11212) — Ishares Msci Spain ETF | Spanish equities | [iShares](https://www.ishares.com/us/products/239683/ishares-core-dividend-growth-etf) | ETF p12 |
| [EWQ](https://pluang.com/asset/usstock/EWQ/11199) — iShares MSCI France ETF | French equities | [iShares](https://www.ishares.com/us/products/239648/ishares-msci-france-etf) | ETF p19 |
| [EWS](https://pluang.com/asset/usstock/EWS/11190) — iShares MSCI Singapore ETF | Singaporean equities | [iShares](https://www.ishares.com/us/products/239678/ishares-core-aggressive-allocation-etf) | ETF p14 |
| [EWT](https://pluang.com/asset/usstock/EWT/11028) — iShares MSCI Taiwan ETF | Taiwanese equities | [iShares](https://www.ishares.com/us/products/239686/EWT?cid=blog%3Asinglecountry%3Aemergingmarkets%3Ablackrock) | ETF p7 |
| [EWU](https://pluang.com/asset/usstock/EWU/11113) — iShares MSCI United Kingdom (FTSE) | UK equities | [iShares](https://www.ishares.com/us/products/239690/ishares-msci-united-kingdom-etf) | ETF p11 |
| [EWY](https://pluang.com/asset/usstock/EWY/10966) — iShares MSCI South Korea ETF | South Korean equities | [iShares](https://www.ishares.com/us/products/239681/ishares-us-real-estate-etf) | ETF p5 |
| [EWZ](https://pluang.com/asset/usstock/EWZ/10937) — Ishares Msci Brazil ETF | Brazilian equities | [iShares](https://www.ishares.com/us/products/239612/ishares-msci-brazil-capped-etf) | ETF p8 |
| [EZA](https://pluang.com/asset/usstock/EZA/11218) — iShares MSCI South Africa ETF | South African equities | [iShares](https://www.ishares.com/us/products/239680/ishares-msci-south-africa-etf?qt=EZA) | ETF p18 |
| [FLKR](https://pluang.com/asset/usstock/FLKR/11251) — Franklin FTSE South Korea ETF | South Korean equities via FTSE index | [Franklin](https://www.franklintempleton.com/investments/options/exchange-traded-funds/products/26353/SINGLCLASS/franklin-ftse-south-korea-etf/FLKR) | ETF p13 |
| [FXI](https://pluang.com/asset/usstock/FXI/10765) — iShares China Large-Cap ETF | Large Chinese companies listed in Hong Kong | [iShares](https://www.ishares.com/us/products/overview-v3-ishares-fund-data?portfolioId=239536&seoSlug=ishares-china-largecap-etf) | ETF p10 |
| [IEFA](https://pluang.com/asset/usstock/IEFA/11022) — iShares Core MSCI EAFE ETF | Developed EAFE equities, including small caps | [iShares](https://www.ishares.com/us/products/244049/IEFA) | ETF p1 |
| [IEMG](https://pluang.com/asset/usstock/IEMG/11004) — iShares Core MSCI Emerging Markets ETF | Emerging markets including small caps | [iShares](https://www.ishares.com/us/products/244050/ishares-msci-emerging-markets-ex-china-etf) | ETF p2 |
| [INDA](https://pluang.com/asset/usstock/INDA/11122) — iShares MSCI India ETF | Indian equities | [iShares](https://www.ishares.com/us/products/239659/ishares-msci-india-etf?periodCd=m) | ETF p9 |
| [JPIN](https://pluang.com/asset/usstock/JPIN/10780) — JPMorgan Diversified Return International Eqty ETF | Developed international equities with factor selection | [JPMorgan](https://am.jpmorgan.com/content/dam/jpm-am-aem/americas/us/en/literature/fact-sheet/etfs/FS-JPIN.PDF) | ETF p19 |
| [KTEC](https://pluang.com/asset/usstock/KTEC/11226) — KraneShares Hang Seng TECH Index ETF | Hong Kong-listed technology companies | [KraneShares](https://kraneshares.com/etf/ktec/) | ETF p21 |
| [MCHI](https://pluang.com/asset/usstock/MCHI/10979) — iShares MSCI China ETF | Broad Chinese equities | [iShares](https://www.ishares.com/us/products/239619/ishares-china-largecap-etf) | ETF p9 |
| [THD](https://pluang.com/asset/usstock/THD/11205) — Ishares Msci Thailand Etf | Thai equities | [iShares](https://www.ishares.com/us/products/239688/THD) | ETF p18 |
| [VEA](https://pluang.com/asset/usstock/VEA/10772) — Vanguard Tax Managed Fund FTSE Developed Markets ETF | Developed markets outside the US | [Vanguard](https://advisors.vanguard.com/investments/products/vea/vanguard-ftse-developed-markets-et) | ETF p1 |
| [VNM](https://pluang.com/asset/usstock/VNM/11196) — VanEck Vietnam ETF | Vietnamese equities | [VanEck](https://www.vaneck.com/us/en/investments/vietnam-etf-vnm/overview/) | ETF p18 |
| [VT](https://pluang.com/asset/usstock/VT/11025) — Vanguard Total World Stock Index Fund ETF | Global developed and emerging equities | [Vanguard](https://advisors.vanguard.com/investments/products/vt/vanguard-total-world-stock-etfp) | ETF p2 |
| [VWO](https://pluang.com/asset/usstock/VWO/10766) — Vanguard Emerging Markets Stock Index Fund ETF | FTSE emerging markets; benchmark differs from IEMG | [Vanguard](https://advisors.vanguard.com/investments/products/vwo/vanguard-ftse-emerging-markets-etf) | US p82 |
| [VXUS](https://pluang.com/asset/usstock/VXUS/10934) — Vanguard Total International Stock Index Fund ETF | Developed and emerging equities outside the US | [Vanguard](https://advisors.vanguard.com/investments/products/vxus/vanguard-total-international-stock-etf) | ETF p1 |

### Dividend equities — 7

| Ticker / Pluang name | Exposure and special treatment | Issuer research | Catalogue |
|---|---|---|---|
| [HDV](https://pluang.com/asset/usstock/HDV/10776) — iShares Core High Dividend ETF | US high-dividend equities | [iShares](https://www.ishares.com/us/products/239563/ishares-high-dividend-etf?qt=HDV) | ETF p6 |
| [SCHD](https://pluang.com/asset/usstock/SCHD/10972) — Schwab US Dividend Equity ETF | US dividend equities with quality screens | [Schwab](https://www.schwabassetmanagement.com/products/schd) | ETF p2 |
| [SDIV](https://pluang.com/asset/usstock/SDIV/11204) — Global X SuperDividend ETF | Global high-dividend equities | [Global X](https://www.globalxetfs.com/funds/sdiv/) | ETF p15 |
| [SPHD](https://pluang.com/asset/usstock/SPHD/10778) — Invesco S&P 500 High Div Low Volatility ETF | US high-dividend/lower-volatility equities | [Invesco](https://www.invesco.com/content/dam/invesco/us/en/product-documents/etf/fact-sheet/sphd-invesco-s-p-500-high-dividend-low-volatility-etf-fact-sheet.pdf) | ETF p11 |
| [VIG](https://pluang.com/asset/usstock/VIG/10735) — Vanguard Dividend Appreciation Index Fund ETF | US dividend growth equities | [Vanguard](https://advisors.vanguard.com/investments/products/new/vig/vanguard-dividend-appreciation-etf) | ETF p2 |
| [VYM](https://pluang.com/asset/usstock/VYM/10769) — Vanguard High Dividend Yield ETF | US high-dividend equities | [Vanguard](https://advisors.vanguard.com/investments/products/vym/vanguard-high-dividend-yield-etf?fromsearch=true&source=autosuggest) | ETF p3 |
| [VYMI](https://pluang.com/asset/usstock/VYMI/11034) — Vanguard International High Dividend Yield ETF | International high-dividend equities | [Vanguard](https://advisors.vanguard.com/investments/products/vymi/vanguard-international-high-dividend-yield-etf?cmpgn=FAS%3AOSM%3ATSM%3A875798830694) | ETF p6 |

### Fixed income and preferred securities — 28

| Ticker / Pluang name | Exposure and special treatment | Issuer research | Catalogue |
|---|---|---|---|
| [AGG](https://pluang.com/asset/usstock/AGG/11087) — iShares Core US Aggregate Bond ETF | Broad US investment-grade bonds | [iShares](https://www.ishares.com/us/products/239458/ishares-core-u-s-aggregate-bond-etf) | ETF p2 |
| [BIL](https://pluang.com/asset/usstock/BIL/11177) — State Street SPDR Bloomberg 1-3 Month T-Bill ETF | US Treasury bills with 1–3 month maturities | [State Street](https://www.ssga.com/us/en/intermediary/etfs/state-street-spdr-bloomberg-1-3-month-t-bill-etf-bil) | ETF p3 |
| [BND](https://pluang.com/asset/usstock/BND/10737) — Vanguard Total Bond Market Index Fund ETF | Broad US investment-grade bonds | [Vanguard](https://advisors.vanguard.com/investments/products/bnd/vanguard-total-bond-market-etf?cmpgn=FAS%3APS%3AXX%3AFAS%3A09052023%3ABG%3ADM%3AVN~BG_LB~FAS_KC~BD_UN~AFIProductETF_MT~Broad%3ANOTARG%3ANONE%3ABND%3AXX) | ETF p1 |
| [BNDX](https://pluang.com/asset/usstock/BNDX/10747) — Vanguard Total International Bond Index Fund ETF | International investment-grade bonds, USD hedged | [Vanguard](https://advisors.vanguard.com/investments/products/new/bndx/vanguard-total-international-bond-etf?cmpgn=FAS%3AOSM%3ATSM%3A848219206056) | ETF p2 |
| [EMB](https://pluang.com/asset/usstock/EMB/10958) — iShares JPMorgan USD Emerging Markets Bond ETF | USD emerging-market sovereign/quasi-sovereign bonds | [iShares](https://www.ishares.com/us/products/239572/ishares-core-sp-total-us-stock-market-etf) | ETF p7 |
| [EMLC](https://pluang.com/asset/usstock/EMLC/11157) — VanEck JP Morgan EM Local Currency Bond ETF | Emerging-market bonds denominated in local currencies | [VanEck](https://www.vaneck.com/ucits/investments/emerging-markets-local-currency-bond-etf/index) | ETF p10 |
| [FLOT](https://pluang.com/asset/usstock/FLOT/11188) — VanEck Australian Floating Rate ETF | Likely US iShares floating-rate investment-grade bonds; Pluang labels Australian VanEck product | [iShares](https://www.ishares.com/us/products/239534/ishares-floating-rate-bond-etf?ihpq=true&qt=EEMS) | ETF p7 |
| [FLRN](https://pluang.com/asset/usstock/FLRN/11207) — State Street SPDR Bloomberg Invstmt Gr Fltg Rt ETF | Investment-grade floating-rate notes | [State Street](https://www.ssga.com/us/en/institutional/etfs/state-street-spdr-bloomberg-investment-grade-floating-rate-etf-flrn) | ETF p12 |
| [HYG](https://pluang.com/asset/usstock/HYG/10981) — iShares iBoxx $ High Yield Corporate Bond ETF | USD high-yield corporate bonds | [iShares](https://www.ishares.com/us/products/239565/ishares-iboxx-usd-high-yield-corporate-bond-etf) | ETF p6 |
| [IEF](https://pluang.com/asset/usstock/IEF/10740) — iShares 7-10 Year Treasury Bond ETF | US Treasuries with 7–10 year maturities | [iShares](https://www.ishares.com/us/products/239456/ishares-710-year-treasury-bond-etf?source_caller=ui) | ETF p4 |
| [IEI](https://pluang.com/asset/usstock/IEI/11003) — iShares 3 7 Year Treasury Bond ETF | US Treasuries with 3–7 year maturities | [iShares](https://www.ishares.com/us/products/239455/ishares-37-year-treasury-bond-etf?qt=IEI) | ETF p6 |
| [IGOV](https://pluang.com/asset/usstock/IGOV/10743) — iShares International Treasury Bond ETF | Developed international government bonds | [iShares](https://www.ishares.com/us/products/239830/) | ETF p14 |
| [JNK](https://pluang.com/asset/usstock/JNK/11106) — State Street SPDR Bloomberg High Yield Bond ETF | USD high-yield corporate bonds | [State Street](https://www.ssga.com/us/en/individual/etfs/state-street-spdr-bloomberg-high-yield-bond-etf-jnk) | ETF p9 |
| [JPST](https://pluang.com/asset/usstock/JPST/11151) — JPMorgan Ultra Short Income ETF | Active ultra-short income bonds; credit risk remains | [JPMorgan](https://am.jpmorgan.com/content/dam/jpm-am-aem/americas/us/en/literature/fact-sheet/etfs/FS-JPST.PDF) | ETF p4 |
| [LQD](https://pluang.com/asset/usstock/LQD/10762) — iShares iBoxx $ Inv Grade Corporate Bond ETF | USD investment-grade corporate bonds | [iShares](https://www.ishares.com/us/products/239566/ishares-iboxx-investment-grade-corporate-bond-etf) | US p86 |
| [MBB](https://pluang.com/asset/usstock/MBB/10741) — iShares MBS ETF | US agency mortgage-backed securities | [iShares](https://www.ishares.com/us/products/239465/ishares-7-10-year-treasury-bond-etf) | ETF p4 |
| [PGX](https://pluang.com/asset/usstock/PGX/10734) — Invesco Preferred ETF | Preferred securities; equity-like and credit risks | [Invesco](https://www.invesco.com/us/en/financial-products/etfs/invesco-preferred-etf.html) | ETF p11 |
| [SGOV](https://pluang.com/asset/usstock/SGOV/10924) — iShares 0 3 Month Treasury Bond ETF | US Treasury bills with 0–3 month maturities | [iShares](https://www.ishares.com/us/products/314116/ishares-0-3-month-treasury-bond-etf-sgov) | ETF p2 |
| [SHY](https://pluang.com/asset/usstock/SHY/10968) — iShares 1 3 Year Treasury Bond ETF | US Treasuries with 1–3 year maturities | [iShares](https://www.ishares.com/us/products/239452/ishares-us-real-estate-etf) | ETF p5 |
| [SJNK](https://pluang.com/asset/usstock/SJNK/11138) — State Street SPDR Bloomberg Shrt Trm Hg Yld Bd ETF | Short-term high-yield corporate bonds | [State Street](https://www.ssga.com/us/en/individual/etfs/state-street-spdr-bloomberg-short-term-high-yield-bond-etf-sjnk) | ETF p10 |
| [TIP](https://pluang.com/asset/usstock/TIP/11161) — iShares TIPS Bond ETF | US inflation-linked Treasuries | [iShares](https://www.ishares.com/us/products/239467/ishares-1020-year-treasury-bond-etf) | ETF p7 |
| [TLH](https://pluang.com/asset/usstock/TLH/11168) — iShares 10 20 Year Treasury Bond ETF | US Treasuries with 10–20 year maturities | [iShares](https://www.ishares.com/us/products/239453/ishares-3-7-year-treasury-bond-etf) | ETF p7 |
| [TLT](https://pluang.com/asset/usstock/TLT/10736) — iShares 20 Plus Year Treasury Bond ETF | US Treasuries with 20+ year maturities | [iShares](https://www.ishares.com/us/products/239454/ishares-floating-rate-bond-etf) | ETF p4 |
| [USIG](https://pluang.com/asset/usstock/USIG/11020) — iShares Broad USD Investment Grade Corporate Bond | Broad USD investment-grade corporate bonds | [iShares](https://www.ishares.com/us/products/239460/ishares-5-10-year-investment-grade-corporate-bond-etf) | ETF p6 |
| [VCIT](https://pluang.com/asset/usstock/VCIT/10933) — Vanguard Intermediate Term Corporate Bond ETF | Intermediate-term investment-grade corporate bonds | [Vanguard](https://advisors.vanguard.com/investments/products/vcit/vanguard-intermediate-term-corporate-bond-etf?cmpgn=FAS%3APS%3AXX%3ALF%3A20250101%3AGG%3ADM%3ALB~FAS_VN~GG_KC~NB_PR~LF_UN~FixedIncomeProduct_MT~Broad_AT~None_EX~None%3ANone%3ANONE%3ANONE%3AKW%3AIntermediateTermCorporateBondETF) | ETF p3 |
| [VCSH](https://pluang.com/asset/usstock/VCSH/10953) — Vanguard Short Term Corporate Bond ETF | Short-term investment-grade corporate bonds | [Vanguard](https://advisors.vanguard.com/investments/products/vcsh/vanguard-short-term-corporate-bond-etf?cmpgn=FAS%3APS%3AXX%3ALF%3A20250101%3AGG%3ADM%3ALB~FAS_VN~GG_KC~BD_PR~LF_UN~FixedIncomeProduct_MT~Exact_AT~None_EX~None%3ANone%3ANONE%3ANONE%3AKW%3AShortTermCorporateBondETF) | ETF p3 |
| [VTIP](https://pluang.com/asset/usstock/VTIP/10746) — Vanguard Sht-Term Inflation-Protected Sec Idx ETF | Short-duration US inflation-linked Treasuries | [Vanguard](https://advisors.vanguard.com/investments/products/vtip/vanguard-short-term-inflation-protected-securities-etf?cmpgn=FAS%3AOSM%3ATSM%3A346846672508) | ETF p3 |
| [VUSB](https://pluang.com/asset/usstock/VUSB/11203) — Vanguard Ultra Short Bond ETF | Active ultra-short investment-grade bonds | [Vanguard](https://advisors.vanguard.com/investments/products/vusb/vanguard-ultra-short-bond-etf.html) | ETF p8 |

### Real estate and infrastructure equities — 5

| Ticker / Pluang name | Exposure and special treatment | Issuer research | Catalogue |
|---|---|---|---|
| [DTCR](https://pluang.com/asset/usstock/DTCR/11263) — Global X Data Center & Digital Infra ETF | Data centers and digital infrastructure equities | [Global X](https://www.globalxetfs.com/funds/dtcr/) | ETF p13 |
| [SRVR](https://pluang.com/asset/usstock/SRVR/11278) — Pacer Data & Infra Real Estate ETF | Data and infrastructure real estate equities | [Pacer](https://docs.paceretfs.com/srvr) | ETF p20 |
| [VNQ](https://pluang.com/asset/usstock/VNQ/10764) — Vanguard Real Estate Index Fund ETF | US real estate equities/REITs | [Vanguard](https://advisors.vanguard.com/investments/products/vnq/vanguard-real-estate-etf?holding=true) | ETF p3 |
| [VNQI](https://pluang.com/asset/usstock/VNQI/10744) — Vanguard Global ex-US Real Estate Index Fd ETF | Global real estate equities outside the US | [Vanguard](https://advisors.vanguard.com/investments/products/vnqi/vanguard-global-ex-us-real-estate-etf) | ETF p11 |
| [XLRE](https://pluang.com/asset/usstock/XLRE/10998) — State Street Real Estate Select Sector SPDR ETF | S&P 500 real estate sector | [State Street](https://www.ssga.com/us/en/individual/etfs/state-street-real-estate-select-sector-spdr-etf-xlre) | ETF p8 |

### Sector and thematic equities — 59

| Ticker / Pluang name | Exposure and special treatment | Issuer research | Catalogue |
|---|---|---|---|
| [AIPO](https://pluang.com/asset/usstock/AIPO/11264) — Defiance AI & Power Infrastructure ETF | AI and power infrastructure companies | [Defiance](https://www.defianceetfs.com/AIPO/) | ETF p16 |
| [AIQ](https://pluang.com/asset/usstock/AIQ/11016) — Global X Artificial Intelligence & Technology ETF | Artificial intelligence and technology companies | [Global X](https://www.globalxetfs.com/funds/aiq) | ETF p8 |
| [ARKF](https://pluang.com/asset/usstock/ARKF/11209) — ARK Fintech Innovation ETF | Active blockchain and fintech; platform retains older name | [ARK](https://www.ark-funds.com/funds/arkf?_hsmi=351057657) | ETF p16 |
| [ARKG](https://pluang.com/asset/usstock/ARKG/11224) — ARK Genomic Revolution ETF | Active genomics and biotechnology equities | [ARK](https://www.ark-funds.com/funds/arkg?_hsmi=233865977) | ETF p14 |
| [ARKK](https://pluang.com/asset/usstock/ARKK/10779) — ARK Innovation ETF | Active disruptive innovation equities | [ARK](https://www.ark-funds.com/funds/arkk) | ETF p10 |
| [ARKQ](https://pluang.com/asset/usstock/ARKQ/11219) — ARK Autonomous Technology & Robotics ETF | Active autonomous technology and robotics equities | [ARK](https://www.ark-funds.com/funds/arkq?_hsmi=232302262) | ETF p13 |
| [ARKW](https://pluang.com/asset/usstock/ARKW/11194) — ARK Next Generation Internet ETF | Active next-generation technology; platform retains Internet name | [ARK](https://www.ark-funds.com/funds/arkw) | ETF p14 |
| [ARKX](https://pluang.com/asset/usstock/ARKX/11235) — ARK Space & Defense Innovation ETF | Active space and defense innovation equities | [ARK](https://www.ark-funds.com/funds/arkx?_hsmi=234041635) | ETF p16 |
| [BITQ](https://pluang.com/asset/usstock/BITQ/11210) — Bitwise Crypto Industry Innovators ETF | Crypto industry equities, not spot bitcoin | [Bitwise](https://bitqetf.com/?adid=728180898204&creative=728180898204&device=c&hsa_ad=728180898204&hsa_cam=22098707450&hsa_grp=171850199943&hsa_kw=crypto+etfs&hsa_mt=p&hsa_net=adwords&hsa_src=g&hsa_tgt=kwd-1410557950290&keyword=crypto+etfs&loc_physical_ms=9004479&matchtype=p&network=g&targetid=kwd-1410557950290) | ETF p18 |
| [BLOK](https://pluang.com/asset/usstock/BLOK/10781) — Amplify Transformational Data Sharing ETF | Active blockchain-related companies | [Amplify](https://amplifyetfs.com/BLOK/) | ETF p15 |
| [BOTZ](https://pluang.com/asset/usstock/BOTZ/10750) — Global X Robotics and Artificial Intelligence ETF | Robotics and artificial intelligence companies | [Global X](https://www.globalxetfs.com/funds/botz/) | ETF p11 |
| [BUG](https://pluang.com/asset/usstock/BUG/11005) — Global X Cybersecurity | Cybersecurity companies | [Global X](https://www.globalxetfs.com/funds/BUG) | ETF p12 |
| [CIBR](https://pluang.com/asset/usstock/CIBR/10749) — First Trust NASDAQ Cybersecurity ETF | Cybersecurity companies | [First Trust](https://www.ftportfolios.com/retail/etf/etfsummary.aspx?ticker=cibr) | ETF p6 |
| [CLOU](https://pluang.com/asset/usstock/CLOU/11163) — Global X Cloud Computing ETF | Cloud computing companies | [Global X](https://www.globalxetfs.com/funds/CLOU) | ETF p19 |
| [COPX](https://pluang.com/asset/usstock/COPX/11045) — Global X Copper Miners ETF | Copper-mining companies, not copper futures | [Global X](https://www.globalxetfs.com/funds/copx/) | ETF p9 |
| [CTEC](https://pluang.com/asset/usstock/CTEC/11232) — Global X CleanTech | Climate/clean technology; platform retains CleanTech name | [Global X](https://www.globalxetfs.com/funds/ctec/) | ETF p22 |
| [DRIV](https://pluang.com/asset/usstock/DRIV/11181) — Global X Autonomous & Electric Vehicles | Autonomous and electric-vehicle ecosystem | [Global X](https://www.globalxetfs.com/funds/driv/) | ETF p19 |
| [ESPO](https://pluang.com/asset/usstock/ESPO/11222) — VanEck Video Gaming and eSports ETF | Video gaming and esports companies | [VanEck](https://www.vaneck.com/us/en/investments/video-gaming-esports-etf-espo/documents/) | ETF p20 |
| [GDX](https://pluang.com/asset/usstock/GDX/10768) — VanEck Gold Miners ETF | Gold-mining companies, not physical gold | [VanEck](https://www.vaneck.com/us/en/investments/gold-miners-etf-gdx/overview/) | ETF p5 |
| [GDXJ](https://pluang.com/asset/usstock/GDXJ/11081) — VanEck Junior Gold Miners | Smaller gold/silver-mining companies | [VanEck](https://www.vaneck.com/us/en/investments/junior-gold-miners-etf-gdxj/overview/) | ETF p8 |
| [GRID](https://pluang.com/asset/usstock/GRID/11267) — First Trust NASDAQ Smart Grid ETF | Smart-grid infrastructure companies | [First Trust](https://www.ftportfolios.com/Retail/Etf/Etfsummary.aspx?Print=Y&Ticker=GRID) | ETF p7 |
| [HACK](https://pluang.com/asset/usstock/HACK/11215) — Amplify Cybersecurity ETF | Cybersecurity companies | [Amplify](https://amplifyetfs.com/HACK/) | ETF p11 |
| [ICLN](https://pluang.com/asset/usstock/ICLN/10742) — iShares Global Clean Energy ETF | Global clean energy companies | [iShares](https://www.ishares.com/us/products/239738/ishares-global-cle) | ETF p12 |
| [IDRV](https://pluang.com/asset/usstock/IDRV/11228) — iShares Self-Driving EV and Tech | Self-driving, EV and technology companies | [iShares](https://www.ishares.com/us/products/307332/ishares) | ETF p20 |
| [ITA](https://pluang.com/asset/usstock/ITA/11271) — iShares US Aerospace & Defense ETF | US aerospace and defense companies | [iShares](https://www.ishares.com/us/products/239502/ishares-us-aerospace--defense-etf) | ETF p7 |
| [IXN](https://pluang.com/asset/usstock/IXN/11214) — iShares Global Tech ETF | Global technology equities | [iShares](https://www.ishares.com/us/products/239750/ishares-global-tech-etf?qt=EEMS) | ETF p8 |
| [JETS](https://pluang.com/asset/usstock/JETS/11116) — US Global Jets ETF | Airlines and related aviation companies | [US Global Investors](https://usglobaletfs.com/fund/u-s-global-jets-etf/) | ETF p16 |
| [KARS](https://pluang.com/asset/usstock/KARS/11234) — KraneShares Electric Vehicles and Future Mobility | Electric vehicles and future mobility companies | [KraneShares](https://kraneshares.com/etf/kars/) | ETF p21 |
| [KWEB](https://pluang.com/asset/usstock/KWEB/10975) — KraneShares CSI China Internet ETF | Chinese internet companies | [KraneShares](https://kraneshares.com/etf/kweb/) | ETF p10 |
| [LIT](https://pluang.com/asset/usstock/LIT/11165) — Global X Lithium & Battery Tech ETF | Lithium mining and battery supply chain | [Global X](https://www.globalxetfs.com/funds/lit/) | ETF p14 |
| [MAGS](https://pluang.com/asset/usstock/MAGS/11110) — Roundhill Magnificent Seven ETF | Concentrated Magnificent Seven equity exposure | [Roundhill](https://www.roundhillinvestments.com/assets/pdfs/mags_factsheet.pdf) | ETF p9 |
| [NLR](https://pluang.com/asset/usstock/NLR/11277) — VanEck Uranium & Nuclear ETF | Nuclear energy and uranium equities | [VanEck](https://www.vaneck.com/us/en/investments/uranium-nuclear-energy-etf-nlr/fees/) | ETF p11 |
| [NUKZ](https://pluang.com/asset/usstock/NUKZ/11272) — Range Nuclear Renaissance ETF | Nuclear energy ecosystem companies | [Range](https://www.rangeetfs.com/nukz) | ETF p17 |
| [PBW](https://pluang.com/asset/usstock/PBW/11192) — Invesco WilderHill Clean Energy ETF | Clean-energy companies | [Invesco](https://www.invesco.com/us/financial-products/etfs/product-detail?audienceType=Investor&ticker=PBW) | ETF p19 |
| [POWR](https://pluang.com/asset/usstock/POWR/11275) — iShares US Power Infrastructure ETF | US power infrastructure; benchmark/name history needs review | [iShares](https://www.ishares.com/us/products/239653/ishares-u-s-power-infrastructure-etf) | ETF p18 |
| [QCLN](https://pluang.com/asset/usstock/QCLN/11186) — First Trust NASDAQ Clean Edge Green Energy Idx Fd | Clean-energy and related technology companies | [First Trust](https://www.ftportfolios.com/retail/etf/etfsummary.aspx?ticker=QCLN) | ETF p17 |
| [QTEC](https://pluang.com/asset/usstock/QTEC/11164) — First Trust NASDAQ 100 Technology Index Fund | Nasdaq-100 technology-sector companies | [First Trust](https://www.ftportfolios.com/retail/etf/etfsummary.aspx?ticker=qtec) | ETF p10 |
| [REMX](https://pluang.com/asset/usstock/REMX/11129) — VanEck Rare Earth/Strategic Metals | Rare earth and strategic-metals companies | [VanEck](https://www.vaneck.com/us/en/investments/rare-earth-strategic-metals-etf-remx?audience=retail&country=us) | ETF p13 |
| [ROBO](https://pluang.com/asset/usstock/ROBO/11197) — Global X Robo Global Robotics & Automation ETF | Global robotics and automation; US issuer is not Global X | [ROBO Global / Exchange Traded Concepts](https://www.roboglobaletfs.com/robo?hsLang=en) | ETF p12 |
| [ROKT](https://pluang.com/asset/usstock/ROKT/11286) — SPDR Kensho Final Frontiers ETF | Space/deep-sea frontier technology companies | [SPDR](https://www.ssga.com/us/en/institutional/etfs/state-street-spdr-sp-kensho-final-frontiers-etf-rokt) | ETF p20 |
| [SHLD](https://pluang.com/asset/usstock/SHLD/11146) — Global X Defense Tech ETF | Defense technology companies | [Global X](https://www.globalxetfs.com/funds/shld?trk=article-ssr-frontend-pulse_little-text-block) | ETF p9 |
| [SKYY](https://pluang.com/asset/usstock/SKYY/10745) — First Trust Cloud Computing ETF | Cloud computing companies | [First Trust](https://www.ftportfolios.com/Retail/etf/etfsummary.aspx?Ticker=SKYY) | ETF p11 |
| [SMH](https://pluang.com/asset/usstock/SMH/10739) — VanEck Semiconductor ETF | Semiconductor producers and equipment companies | [VanEck](https://www.vaneck.com/us/en/investments/semiconductor-etf-smh/) | ETF p3 |
| [SOXX](https://pluang.com/asset/usstock/SOXX/10963) — iShares Semiconductor ETF | Semiconductor equities | [iShares](https://www.ishares.com/us/products/239705/fund) | ETF p4 |
| [TAN](https://pluang.com/asset/usstock/TAN/11127) — Invesco Solar ETF | Solar energy companies | [Invesco](https://www.invesco.com/us/en/solutions/esg-sustainability.html) | ETF p16 |
| [URA](https://pluang.com/asset/usstock/URA/11056) — Global X Uranium ETF | Uranium industry and related nuclear components | [Global X](https://www.globalxetfs.com/funds/Ura) | ETF p10 |
| [URNM](https://pluang.com/asset/usstock/URNM/11125) — Sprott Uranium Miners ETF | Uranium miners and related uranium exposure | [Sprott](https://sprottetfs.com/urnm-sprott-uranium-miners-etf) | ETF p13 |
| [VGT](https://pluang.com/asset/usstock/VGT/10763) — Vanguard Information Technology Index Fund ETF | US information technology equities | [Vanguard](https://advisors.vanguard.com/investments/products/vgt/vanguard-information-technology-etf?mkwid=HU7FLMVq) | ETF p1 |
| [XBI](https://pluang.com/asset/usstock/XBI/10982) — State Street SPDR S&P Biotech ETF | US biotechnology equities | [State Street](https://www.ssga.com/us/en/individual/etfs/state-street-spdr-sp-biotech-etf-xbi) | ETF p8 |
| [XHB](https://pluang.com/asset/usstock/XHB/11071) — State Street SPDR S&P Homebuilders ETF | US homebuilding-related companies | [State Street](https://www.ssga.com/us/en/intermediary/etfs/state-street-spdr-sp-homebuilders-etf-xhb) | ETF p14 |
| [XLB](https://pluang.com/asset/usstock/XLB/10759) — Materials Select Sector SPDR Fund | S&P 500 materials sector | [State Street](https://www.ssga.com/us/en/individual/etfs/state-street-materials-select-sector-spdr-etf-xlb) | ETF p8 |
| [XLE](https://pluang.com/asset/usstock/XLE/10753) — Energy Select Sector SPDR Fund | S&P 500 energy sector | [State Street](https://www.ssga.com/us/en/individual/etfs/state-street-energy-select-sector-spdr-etf-xle) | US p85 |
| [XLF](https://pluang.com/asset/usstock/XLF/10755) — Financial Select Sector SPDR Fund | S&P 500 financial sector | [State Street](https://www.ssga.com/us/en/individual/etfs/state-street-financial-select-sector-spdr-etf-xlf) | US p84 |
| [XLK](https://pluang.com/asset/usstock/XLK/10985) — State Street Technology Select Sector SPDR ETF | S&P 500 technology sector | [State Street](https://www.ssga.com/us/en/individual/etfs/state-street-technology-select-sector-spdr-etf-xlk) | ETF p2 |
| [XLP](https://pluang.com/asset/usstock/XLP/10756) — Consumer Staples Select Sector SPDR Fund | S&P 500 consumer staples sector | [State Street](https://www.ssga.com/us/en/intermediary/etfs/state-street-consumer-staples-select-sector-spdr-etf-xlp) | ETF p7 |
| [XLU](https://pluang.com/asset/usstock/XLU/10757) — Utilities Select Sector SPDR Fund | S&P 500 utilities sector | [State Street](https://www.ssga.com/us/en/individual/etfs/state-street-utilities-select-sector-spdr-etf-xlu) | ETF p6 |
| [XLV](https://pluang.com/asset/usstock/XLV/10754) — Health Care Select Sector SPDR Fund | S&P 500 healthcare sector | [State Street](https://www.ssga.com/jp/ja/individual/etfs/state-street-health-care-select-sector-spdr-etf-xlv) | US p85 |
| [XLY](https://pluang.com/asset/usstock/XLY/10758) — Consumer Discretionary Select Sector SPDR Fund | S&P 500 consumer discretionary sector | [State Street](https://www.ssga.com/us/en/individual/etfs/state-street-consumer-discretionary-select-sector-spdr-etf-xly) | US p87 |
| [XRT](https://pluang.com/asset/usstock/XRT/11099) — State Street PDR S&P Retail ETF | US retail companies | [State Street](https://www.ssga.com/us/en/individual/etfs/state-street-spdr-sp-retail-etf-xrt) | ETF p18 |

### Options income and distribution strategies — 20

| Ticker / Pluang name | Exposure and special treatment | Issuer research | Catalogue |
|---|---|---|---|
| [AIPI](https://pluang.com/asset/usstock/AIPI/11159) — REX AI Equity Premium Income ETF | AI-related equities with covered-call income | [REX](https://www.rexshares.com/aipi/?llm_view=1) | ETF p17 |
| [AMDY](https://pluang.com/asset/usstock/AMDY/11223) — YieldMax AMD Option Income Strategy ETF | AMD-linked synthetic option income | [YieldMax](https://yieldmaxetfs.com/our-etfs/amdy/) | ETF p17 |
| [AMZY](https://pluang.com/asset/usstock/AMZY/11175) — YieldMax AMZN Option Income Strategy ETF | AMZN-linked synthetic option income | [YieldMax](https://yieldmaxetfs.com/our-etfs/amzy/) | ETF p20 |
| [CONY](https://pluang.com/asset/usstock/CONY/11187) — YieldMax COIN Option Income Strategy ETF | COIN-linked synthetic option income | [YieldMax](https://yieldmaxetfs.com/our-etfs/cony/) | ETF p19 |
| [FEPI](https://pluang.com/asset/usstock/FEPI/11126) — Rex Fang & Innovation Equity Premium Income ETF | Concentrated technology equities with covered-call income | [REX](https://www.rexshares.com/FEPI/) | ETF p16 |
| [GPTY](https://pluang.com/asset/usstock/GPTY/11238) — YieldMax AI & Tech Portfolio Option Income ETF | AI/technology equities with call-spread income | [YieldMax](https://yieldmaxetfs.com/our-etfs/gpty/) | ETF p21 |
| [JEPI](https://pluang.com/asset/usstock/JEPI/11097) — JPMorgan Equity Premium Income ETF | Active US equities plus options/ELN income overlay | [JPMorgan](https://am.jpmorgan.com/content/dam/jpm-am-aem/americas/us/en/literature/fact-sheet/etfs/fs-jepi.pdf) | ETF p4 |
| [JEPQ](https://pluang.com/asset/usstock/JEPQ/10956) — JPMorgan Nasdaq Equity Premium Income ETF | Active Nasdaq-oriented equities plus options/ELN income overlay | [JPMorgan](https://am.jpmorgan.com/content/dam/jpm-am-aem/americas/us/en/literature/fact-sheet/etfs/FS-JEPQ.PDF) | ETF p4 |
| [MSTY](https://pluang.com/asset/usstock/MSTY/11160) — YieldMax MSTR Option Income Strategy ETF | MSTR-linked synthetic option income | [YieldMax](https://yieldmaxetfs.com/our-etfs/msty/?trk=article-ssr-frontend-pulse_little-text-block) | ETF p15 |
| [NVDW](https://pluang.com/asset/usstock/NVDW/11230) — Roundhill NVDA WeeklyPay ETF | NVDA weekly 1.2× target exposure and weekly distributions | [Roundhill](https://www.roundhillinvestments.com/etf/nvdw/) | ETF p21 |
| [NVDY](https://pluang.com/asset/usstock/NVDY/11021) — YieldMax NVDA Option Income Strategy ETF | NVDA-linked synthetic option income | [YieldMax](https://yieldmaxetfs.com/our-etfs/nvdy/) | ETF p14 |
| [QDTE](https://pluang.com/asset/usstock/QDTE/11208) — Roundhill Innov-100 0DTE Covered Call Strat ETF | Nasdaq-100/Innovation-100 0DTE option income | [Roundhill](https://roundhillinvestments.com/etf/qdte/) | ETF p15 |
| [QDTY](https://pluang.com/asset/usstock/QDTY/11229) — YieldMax Nasdaq 100 0DTE Covered Call Strategy ETF | Nasdaq-100 synthetic 0DTE covered-call income | [YieldMax](https://yieldmaxetfs.com/our-etfs/qdty/) | ETF p22 |
| [QYLD](https://pluang.com/asset/usstock/QYLD/10935) — Global X NASDAQ 100 Covered Call ETF | Nasdaq-100 covered-call income | [Global X](https://www.globalxetfs.com/funds/qyld) | ETF p8 |
| [RDTE](https://pluang.com/asset/usstock/RDTE/11225) — Roundhill Russell 2000 0DTE Covered Call Strat ETF | Russell 2000 0DTE option income | [Roundhill](https://www.roundhillinvestments.com/etf/rdte/) | ETF p20 |
| [SPYI](https://pluang.com/asset/usstock/SPYI/11082) — NEOS S&P 500 High Income ETF | S&P 500 equities plus index option income | [NEOS](https://neosfunds.com/spyi/) | ETF p7 |
| [TSLY](https://pluang.com/asset/usstock/TSLY/11182) — YieldMax TSLA Option Income Strategy ETF | TSLA-linked synthetic option income | [YieldMax](https://yieldmaxetfs.com/our-etfs/TSLY/) | ETF p16 |
| [XDTE](https://pluang.com/asset/usstock/XDTE/11237) — Roundhill S&P 500 0DTE Covered Call Strategy ETF | S&P 500 0DTE option income | [Roundhill](https://www.roundhillinvestments.com/etf/xdte/) | ETF p19 |
| [YMAG](https://pluang.com/asset/usstock/YMAG/11189) — YieldMax Magnificent 7 Fund of Option Income ETFs | Fund of Magnificent Seven option-income ETFs | [YieldMax](https://yieldmaxetfs.com/our-etfs/YMAG/) | ETF p20 |
| [YMAX](https://pluang.com/asset/usstock/YMAX/11128) — YieldMax Universe Fund of Option Income ETFs | Fund of YieldMax option-income ETFs | [YieldMax](https://yieldmaxetfs.com/our-etfs/YMAX/) | ETF p19 |

### Leveraged and inverse ETFs — 21

| Ticker / Pluang name | Exposure and special treatment | Issuer research | Catalogue |
|---|---|---|---|
| [AGQ](https://pluang.com/asset/usstock/AGQ/11041) — ProShares Ultra Silver ETF | +2× daily silver futures exposure | [ProShares](https://prod.proshares.com/our-etfs/leveraged-and-inverse/agq) | ETF p15 |
| [BITU](https://pluang.com/asset/usstock/BITU/11018) — ProShares Ultra Bitcoin ETF | +2× daily bitcoin exposure through derivatives | [ProShares](https://www.proshares.com/our-etfs/leveraged-and-inverse/BITU) | ETF p17 |
| [BOIL](https://pluang.com/asset/usstock/BOIL/10993) — ProShares Ultra Bloomberg Natural Gas ETF | +2× daily natural-gas futures exposure | [ProShares](https://www.proshares.com/our-etfs/leveraged-and-inverse/boil) | ETF p19 |
| [CONL](https://pluang.com/asset/usstock/CONL/10897) — GraniteShares 2x Long COIN Daily ETF | +2× daily COIN exposure | [GraniteShares](https://graniteshares.com/etfs/conl/) | ETF p17 |
| [CWEB](https://pluang.com/asset/usstock/CWEB/11169) — Direxion Daily CSI China Internet Bull 2X Shares | +2× daily Chinese internet exposure | [Direxion](https://www.direxion.com/product/daily-csi-china-internet-index-bull-2x-etf) | ETF p21 |
| [KOLD](https://pluang.com/asset/usstock/KOLD/11001) — ProShares UltraShort Bloomberg Natural Gas ETF | −2× daily natural-gas futures exposure | [ProShares](https://www.proshares.com/our-etfs/leveraged-and-inverse/KOLD) | ETF p21 |
| [MSTU](https://pluang.com/asset/usstock/MSTU/10942) — T-Rex 2X Long MSTR Daily Target ETF | +2× daily MSTR exposure | [T-Rex](https://www.rexshares.com/mstu/) | ETF p16 |
| [MSTZ](https://pluang.com/asset/usstock/MSTZ/11007) — T-Rex 2X Inverse MSTR Daily Target ETF | −2× daily MSTR exposure | [T-Rex](https://www.rexshares.com/MSTZ/) | ETF p21 |
| [NVDL](https://pluang.com/asset/usstock/NVDL/10923) — GraniteShares 2x Long NVDA Daily ETF | +2× daily NVDA exposure | [GraniteShares](https://graniteshares.com/etfs/nvdl/) | ETF p10 |
| [QLD](https://pluang.com/asset/usstock/QLD/11077) — ProShares Ultra QQQ ETF | +2× daily Nasdaq-100 exposure | [ProShares](https://www.proshares.com/our-etfs/leveraged-and-inverse/qld) | ETF p6 |
| [SOXL](https://pluang.com/asset/usstock/SOXL/10932) — Direxion Daily Semiconductor Bull 3X Shares | +3× daily semiconductor exposure | [Direxion](https://www.direxion.com/product/daily-semiconductor-bull-bear-3x-etfs.) | ETF p5 |
| [SOXS](https://pluang.com/asset/usstock/SOXS/10898) — Direxion Daily Semiconductor Bear 3X Shares | −3× daily semiconductor exposure | [Direxion](https://www.direxion.com/product/daily-semiconductor-bull-bear-3x-etfs) | ETF p13 |
| [SPXL](https://pluang.com/asset/usstock/SPXL/11121) — Direxion Daily S&P 500 Bull 3X Shares | +3× daily S&P 500 exposure | [Direxion](https://www.direxion.com/product/daily-sp-500-bull-bear-3x-etfs?keyword=short+sp500+3x) | ETF p9 |
| [SQQQ](https://pluang.com/asset/usstock/SQQQ/10896) — ProShares UltraPro Short QQQ ETF | −3× daily Nasdaq-100 exposure | [ProShares](https://prod.proshares.com/our-etfs/leveraged-and-inverse/sqqq) | ETF p13 |
| [TMF](https://pluang.com/asset/usstock/TMF/11049) — Direxion Daily 20 Year Treasury Bull 3X Shares | +3× daily long-duration Treasury exposure | [Direxion](https://www.direxion.com/product/daily-20-year-treasury-bull-bear-3x-etfs) | ETF p12 |
| [TQQQ](https://pluang.com/asset/usstock/TQQQ/10892) — ProShares UltraPro QQQ ETF | +3× daily Nasdaq-100 exposure | [ProShares](https://www.proshares.com/our-etfs/leveraged-and-inverse/tqqq) | ETF p4 |
| [TSLL](https://pluang.com/asset/usstock/TSLL/10895) — Direxion Daily TSLA Bull 2X Shares | +2× daily TSLA exposure | [Direxion](https://www.direxion.com/product/daily-tsla-bull-and-bear-leveraged-single-stock-etfs) | ETF p11 |
| [UGL](https://pluang.com/asset/usstock/UGL/11092) — ProShares Ultra Gold ETF | +2× daily gold futures exposure | [ProShares](https://prod.proshares.com/our-etfs/leveraged-and-inverse/ugl) | ETF p16 |
| [UPRO](https://pluang.com/asset/usstock/UPRO/11114) — ProShares UltraPro S&P500 | +3× daily S&P 500 exposure | [ProShares](https://www.proshares.com/our-etfs/leveraged-and-inverse/UPRO) | ETF p10 |
| [USD](https://pluang.com/asset/usstock/USD/11155) — ProShares Ultra Semiconductors | +2× daily semiconductor exposure; ticker is not currency cash | [ProShares](https://www.proshares.com/our-etfs/leveraged-and-inverse/usd) | ETF p12 |
| [YINN](https://pluang.com/asset/usstock/YINN/11069) — Direxion Daily FTSE China Bull 3x Shares | +3× daily Chinese large-cap exposure | [Direxion](https://www.direxion.com/product/daily-ftse-china-bull-bear-3x-etfs) | ETF p17 |

### Physical precious metals — 7

| Ticker / Pluang name | Exposure and special treatment | Issuer research | Catalogue |
|---|---|---|---|
| [AAAU](https://pluang.com/asset/usstock/AAAU/11115) — Goldman Sachs Physical Gold ETF | Physical gold trust | [Goldman](https://am.gs.com/public-assets/documents/562374a8-24d6-11ef-870d-cd3a62c33790) | ETF p12 |
| [GLD](https://pluang.com/asset/usstock/GLD/10890) — SPDR Gold Trust | Physical gold grantor trust | [SPDR / World Gold Council](https://www.spdrgoldshares.com/usa/gld/) | ETF p2 |
| [IAU](https://pluang.com/asset/usstock/IAU/11040) — iShares Gold Trust | Physical gold trust | [iShares](https://www.ishares.com/us/literature/fact-sheet/iau-ishares-gold-trust-fund-fact-sheet-en-us.pdf) | ETF p3 |
| [PALL](https://pluang.com/asset/usstock/PALL/11174) — abrdn Physical Palladium Shares ETF | Physical palladium trust | [Aberdeen](https://www.aberdeeninvestments.com/docs?editionId=0f2bbbf3-25ce-4024-9343-765d2e4e3e01&elqTrack=true&elqTrackId=AFCAE9342489D489ADD06249AE5B324E) | ETF p17 |
| [PPLT](https://pluang.com/asset/usstock/PPLT/11136) — Abrdn Physical Platinum Shares ETF | Physical platinum trust | [Aberdeen](https://www.aberdeeninvestments.com/en-us/investor/funds/view-all-funds/-us0032601066) | ETF p12 |
| [SGOL](https://pluang.com/asset/usstock/SGOL/11090) — ABRDN Physical Gold Shares ETF | Physical gold trust | [Aberdeen](https://www.aberdeeninvestments.com/en-us/investor/funds/view-all-funds/abrdn-physical-gold-shares-etf-us00326a1043?subTab=keyInformationTab) | ETF p9 |
| [SLV](https://pluang.com/asset/usstock/SLV/10732) — iShares Silver Trust | Physical silver trust | [iShares](https://www.ishares.com/us/products/239855/ISHARES-SILVER-TRUST-FUND) | ETF p5 |

### Commodity futures — 12

| Ticker / Pluang name | Exposure and special treatment | Issuer research | Catalogue |
|---|---|---|---|
| [BNO](https://pluang.com/asset/usstock/BNO/11156) — United States Brent Oil Fund LP | Brent oil futures fund | [United States](https://www.uscfinvestments.com/bno) | ETF p17 |
| [CORN](https://pluang.com/asset/usstock/CORN/11231) — Teucrium Corn Fund | Corn futures fund | [Teucrium](https://etfs.teucrium.com/CORN/fund_facts) | ETF p21 |
| [CPER](https://pluang.com/asset/usstock/CPER/11166) — United States Copper Index Fund | Copper futures fund | [United States](https://www.uscfinvestments.com/cper?show=performance) | ETF p16 |
| [DBA](https://pluang.com/asset/usstock/DBA/10770) — Invesco DB Agriculture Fund | Agricultural commodity futures fund | [Invesco](https://www.invesco.com/content/dam/invesco/us/en/product-documents/etf/fact-sheet/dba-invesco-db-agriculture-fund-fact-sheet.pdf) | ETF p14 |
| [DBC](https://pluang.com/asset/usstock/DBC/11140) — Invesco DB Commodity Index Tracking Fund | Diversified commodity futures fund | [Invesco](https://www.invesco.com/us/en/financial-products/etfs/invesco-db-commodity-index-tracking-fund.html) | ETF p13 |
| [DBO](https://pluang.com/asset/usstock/DBO/11185) — Invesco DB Oil Fund | Oil futures with contract-selection methodology | [Invesco](https://www.invesco.com/us/en/financial-products/etfs/invesco-db-oil-fund.html) | ETF p20 |
| [GSG](https://pluang.com/asset/usstock/GSG/11227) — iShares S&P GSCI Commodity-Indexed Trust ETF | Broad commodity futures trust | [iShares](https://www.ishares.com/us/literature/annual-report/gsg-1231-ar.pdf?documentId=925450~2489864~2413151~2369435~2447702&iframeUrlOverride=%2Fus%2F%2Fliterature%2Fannual-report%2Fgsg-1231-ar.pdf&product=I-GSCITS&shareClass=NA&stream=reg) | ETF p15 |
| [PDBC](https://pluang.com/asset/usstock/PDBC/10748) — Invesco Optimum Yld Dvsfd Cmd Str No K 1 ETF | Active diversified commodity futures, no K-1 fund design | [Invesco](https://www.invesco.com/us/en/solutions/invesco-etfs/commodity-investing.html) | ETF p8 |
| [SOYB](https://pluang.com/asset/usstock/SOYB/11233) — Teucrium Soybean Fund | Soybean futures fund | [Teucrium](https://etfs.teucrium.com/SOYB/fund_facts) | ETF p21 |
| [UNG](https://pluang.com/asset/usstock/UNG/10996) — United States Natural Gas Fund | Natural-gas futures fund | [United States](https://www.uscfinvestments.com/ung) | ETF p18 |
| [USO](https://pluang.com/asset/usstock/USO/10767) — United States Oil ETF | WTI oil futures fund | [United States](https://www.uscfinvestments.com/uso) | ETF p13 |
| [WEAT](https://pluang.com/asset/usstock/WEAT/11213) — Teucrium Wheat Fund | Wheat futures fund | [Teucrium](https://etfs.teucrium.com/WEAT/fund_facts) | ETF p20 |

### Spot digital asset trusts — 2

| Ticker / Pluang name | Exposure and special treatment | Issuer research | Catalogue |
|---|---|---|---|
| [BTCO](https://pluang.com/asset/usstock/BTCO/11216) — Invesco Galaxy Bitcoin ETF | Spot bitcoin trust | [Invesco](https://www.invesco.com/us-rest/contentdetail?contentId=20fb58c6-0420-4fd3-9894-2d95d1aef2bb) | ETF p18 |
| [IBIT](https://pluang.com/asset/usstock/IBIT/10891) — iShares Bitcoin Trust | Spot bitcoin trust | [iShares](https://www.ishares.com/us/products/333011/isharesBitcoin-trust-etf) | ETF p3 |

### Digital asset futures — 1

| Ticker / Pluang name | Exposure and special treatment | Issuer research | Catalogue |
|---|---|---|---|
| [BITO](https://pluang.com/asset/usstock/BITO/10913) — ProShares Bitcoin ETF | Bitcoin futures and swaps; not spot bitcoin | [ProShares](https://www.proshares.com/our-etfs/strategic/bito) | ETF p13 |

### Multi-asset allocation — 1

| Ticker / Pluang name | Exposure and special treatment | Issuer research | Catalogue |
|---|---|---|---|
| [AOR](https://pluang.com/asset/usstock/AOR/10773) — iShares Core Growth Allocation ETF | Multi-asset growth allocation using underlying ETFs | [iShares](https://www.ishares.com/us/products/239756/ishares-robotics-and-artificial-intelligence-multisector-etf) | ETF p10 |

### ETNs — separate from ETFs — 3

| Ticker / Pluang name | Exposure and special treatment | Issuer research | Catalogue |
|---|---|---|---|
| [FNGU](https://pluang.com/asset/usstock/FNGU/10987) — MicroSectors FANG and Innovation 3X Leveraged ETN | NYSE FANG+ +3× daily ETN; platform incorrectly says FANG and Innovation; current-series CUSIP mapping unresolved | [MicroSectors / BMO](https://microsectors.com/fang/) | ETF p12 |
| [SLVO](https://pluang.com/asset/usstock/SLVO/11184) — Ubs Ag Etracs Silver Shares Covered Call ETN Exp 21 Apr 2033 | Silver-share covered-call ETN; UBS unsecured debt | [UBS ETRACS](https://etracs.ubs.com/product/detail/index/ussymbol/SLVO) | ETF p18 |
| [USOI](https://pluang.com/asset/usstock/USOI/11211) — Ubs Ag Etracs Crude Oil Shares Covered Call ETN Exp 24th Apr 2037 | Oil-share covered-call ETN; UBS unsecured debt | [UBS ETRACS](https://etracs.ubs.com/product/detail/overview/ussymbol/USOI) | ETF p19 |

### Exclusions — 3

| Ticker / Pluang name | Exposure and special treatment | Issuer research | Catalogue |
|---|---|---|---|
| [ACP](https://pluang.com/asset/usstock/ACP/10784) — abrdn Income Credit Strategies Fund | Aberdeen income credit closed-end fund | [Aberdeen](https://www.aberdeeninvestments.com/en-us/investor/investment-solutions/closed-end-funds/fund-range) | US p98 |
| [FCNCA](https://pluang.com/asset/usstock/FCNCA/11173) — First Citizens BancShares Inc | First Citizens BancShares operating-company stock | [First Citizens](https://ir.firstcitizens.com/overview/default.aspx?trk=public_post_comment-text) | ETF p6 |
| [TEM](https://pluang.com/asset/usstock/TEM/10928) — Tempus AI | Tempus AI operating-company stock | [Tempus](https://investors.tempus.com/node/10361/html) | ETF p7 |

## Issuer financial observations — explicitly not comparison-ready

Issuer searches located source material for all 222 records. Some are fund pages/fact sheets; some remain broader issuer catalogues or marketing pages. Searches also surfaced foreign same-ticker funds, stale factsheets, and incomplete dynamic pages. The machine-readable [issuer source index](research/pluang-etf-2026-10-06/issuer-source-index.json) preserves selected/alternative links and candidate expense, inception, frequency, CUSIP, and asset observations where present.

**The following table is an extraction/review queue, not verified current fund statistics.** `—` means not captured reliably. Dates are issuer-reported inception candidates, not observation dates. Values were observed on 2026-10-06, but their financial as-of/prospectus dates and gross/net/waiver definitions are not uniformly normalized. FLOT values are withheld until its identity is resolved. Candidate inception errors (for example a recent VXUS date inconsistent with its long history) were removed. No rankings or cost/yield illustrations should use this queue without document review.

| Ticker | Candidate expense ratio | Candidate inception | Candidate distribution frequency | Source |
|---|---:|---|---|---|
| AAAU | 0.18% | — | — | [Issuer](https://am.gs.com/public-assets/documents/562374a8-24d6-11ef-870d-cd3a62c33790) |
| ACWI | 0.32% | Mar 26, 2008 | Semi-Annual | [Issuer](https://www.ishares.com/us/products/239600/ishares-msci-acwi-etf) |
| AGG | 0.03% | Sep 22, 2003 | Monthly | [Issuer](https://www.ishares.com/us/products/239458/ishares-core-u-s-aggregate-bond-etf) |
| AGQ | 0.95% | 12/1/08 | — | [Issuer](https://prod.proshares.com/our-etfs/leveraged-and-inverse/agq) |
| AIPI | 0.65% | 06/04/2024 | — | [Issuer](https://www.rexshares.com/aipi/?llm_view=1) |
| AIPO | 0.69% | 07/24/2025 | — | [Issuer](https://www.defianceetfs.com/AIPO/) |
| AIQ | 0.68% | 05/11/18 | Semi-Annual | [Issuer](https://www.globalxetfs.com/funds/aiq) |
| AMDY | 1.00% | 9/18/2023 | — | [Issuer](https://yieldmaxetfs.com/our-etfs/amdy/) |
| AMZY | 1.09% | 7/24/2023 | — | [Issuer](https://yieldmaxetfs.com/our-etfs/amzy/) |
| AOR | 0.20% | Nov 04, 2008 | Quarterly | [Issuer](https://www.ishares.com/us/products/239756/ishares-robotics-and-artificial-intelligence-multisector-etf) |
| ARGT | 0.59% | 03/02/11 | — | [Issuer](https://www.globalxetfs.com/funds/ARGT) |
| ARKF | — | — | — | [Issuer](https://www.ark-funds.com/funds/arkf?_hsmi=351057657) |
| ARKG | 0.75% | 10/31/2014 | — | [Issuer](https://www.ark-funds.com/funds/arkg?_hsmi=233865977) |
| ARKK | 0.75% | 10/31/2014 | — | [Issuer](https://www.ark-funds.com/funds/arkk) |
| ARKQ | — | — | — | [Issuer](https://www.ark-funds.com/funds/arkq?_hsmi=232302262) |
| ARKW | 0.76% | 09/30/2014 | — | [Issuer](https://www.ark-funds.com/funds/arkw) |
| ARKX | 0.75% | 03/30/2021 | — | [Issuer](https://www.ark-funds.com/funds/arkx?_hsmi=234041635) |
| ASEA | — | — | — | [Issuer](https://www.globalxetfs.com/funds/ASEA) |
| AVDV | 0.36% | 09/24/2019 | Quarterly | [Issuer](https://www.avantisinvestors.com/avantis-investments/avantis-international-small-cap-value-etf/trading-details/) |
| AVUV | — | 09/24/2019 | — | [Issuer](https://www.avantisinvestors.com/avantis-investments/avantis-us-small-cap-value-etf/AVUV/) |
| BIL | — | — | Monthly | [Issuer](https://www.ssga.com/us/en/intermediary/etfs/state-street-spdr-bloomberg-1-3-month-t-bill-etf-bil) |
| BITO | 0.95% | 10/18/21 | Monthly | [Issuer](https://www.proshares.com/our-etfs/strategic/bito) |
| BITQ | 0.85% | May 11, 2021 | — | [Issuer](https://bitqetf.com/?adid=728180898204&creative=728180898204&device=c&hsa_ad=728180898204&hsa_cam=22098707450&hsa_grp=171850199943&hsa_kw=crypto+etfs&hsa_mt=p&hsa_net=adwords&hsa_src=g&hsa_tgt=kwd-1410557950290&keyword=crypto+etfs&loc_physical_ms=9004479&matchtype=p&network=g&targetid=kwd-1410557950290) |
| BITU | 0.98% | 4/1/24 | — | [Issuer](https://www.proshares.com/our-etfs/leveraged-and-inverse/BITU) |
| BLOK | 0.70% | — | — | [Issuer](https://amplifyetfs.com/BLOK/) |
| BND | 0.03% | 04/03/2007 | — | [Issuer](https://advisors.vanguard.com/investments/products/bnd/vanguard-total-bond-market-etf?cmpgn=FAS%3APS%3AXX%3AFAS%3A09052023%3ABG%3ADM%3AVN~BG_LB~FAS_KC~BD_UN~AFIProductETF_MT~Broad%3ANOTARG%3ANONE%3ABND%3AXX) |
| BNDX | 0.07% | 05/31/2013 | — | [Issuer](https://advisors.vanguard.com/investments/products/new/bndx/vanguard-total-international-bond-etf?cmpgn=FAS%3AOSM%3ATSM%3A848219206056) |
| BNO | — | — | — | [Issuer](https://www.uscfinvestments.com/bno) |
| BOIL | 0.95% | 10/4/11 | — | [Issuer](https://www.proshares.com/our-etfs/leveraged-and-inverse/boil) |
| BOTZ | 0.68% | 09/12/16 | — | [Issuer](https://www.globalxetfs.com/funds/botz/) |
| BTCO | 0.25% | — | — | [Issuer](https://www.invesco.com/us-rest/contentdetail?contentId=20fb58c6-0420-4fd3-9894-2d95d1aef2bb) |
| BUG | 0.50% | 10/25/19 | — | [Issuer](https://www.globalxetfs.com/funds/BUG) |
| CIBR | 0.58% | — | — | [Issuer](https://www.ftportfolios.com/retail/etf/etfsummary.aspx?ticker=cibr) |
| CLOU | 0.68% | 04/12/19 | Semi-Annual | [Issuer](https://www.globalxetfs.com/funds/CLOU) |
| CONL | — | Aug 9, 2022 | — | [Issuer](https://graniteshares.com/etfs/conl/) |
| CONY | — | — | — | [Issuer](https://yieldmaxetfs.com/our-etfs/cony/) |
| COPX | 0.65% | 04/19/10 | Semi-Annual | [Issuer](https://www.globalxetfs.com/funds/copx/) |
| CORN | 0.61% | — | — | [Issuer](https://etfs.teucrium.com/CORN/fund_facts) |
| CPER | — | — | — | [Issuer](https://www.uscfinvestments.com/cper?show=performance) |
| CTEC | 0.50% | 10/27/20 | Semi-Annual | [Issuer](https://www.globalxetfs.com/funds/ctec/) |
| CWEB | — | — | — | [Issuer](https://www.direxion.com/product/daily-csi-china-internet-index-bull-2x-etf) |
| DBA | — | — | — | [Issuer](https://www.invesco.com/content/dam/invesco/us/en/product-documents/etf/fact-sheet/dba-invesco-db-agriculture-fund-fact-sheet.pdf) |
| DBC | 0.89% | 02/03/2006 | — | [Issuer](https://www.invesco.com/us/en/financial-products/etfs/invesco-db-commodity-index-tracking-fund.html) |
| DBO | 0.81% | 01/05/2007 | — | [Issuer](https://www.invesco.com/us/en/financial-products/etfs/invesco-db-oil-fund.html) |
| DIA | 0.16% | — | Monthly | [Issuer](https://www.ssga.com/us/en/individual/etfs/state-street-spdr-dow-jones-industrial-average-etf-trust-dia) |
| DRIV | 0.68% | 04/13/18 | — | [Issuer](https://www.globalxetfs.com/funds/driv/) |
| DTCR | 0.50% | 10/27/20 | Semi-Annual | [Issuer](https://www.globalxetfs.com/funds/dtcr/) |
| EIDO | 0.59% | May 05, 2010 | Semi-Annual | [Issuer](https://www.ishares.com/us/products/239661/ishares-msci-indonesia-etf?qt=EEMS) |
| EMB | 0.39% | Dec 17, 2007 | Monthly | [Issuer](https://www.ishares.com/us/products/239572/ishares-core-sp-total-us-stock-market-etf) |
| EMLC | 0.30% | — | — | [Issuer](https://www.vaneck.com/ucits/investments/emerging-markets-local-currency-bond-etf/index) |
| ESPO | — | 10/16/2018 | Annual | [Issuer](https://www.vaneck.com/us/en/investments/video-gaming-esports-etf-espo/documents/) |
| EWA | 0.50% | Mar 12, 1996 | Semi-Annual | [Issuer](https://www.ishares.com/us/products/239607/ishares-msci-australia-etf) |
| EWC | 0.50% | Mar 12, 1996 | Semi-Annual | [Issuer](https://www.ishares.com/us/products/239615/EWC) |
| EWG | 0.49% | Mar 12, 1996 | Semi-Annual | [Issuer](https://www.ishares.com/us/products/239650/EWG) |
| EWH | 0.50% | Mar 12, 1996 | Semi-Annual | [Issuer](https://www.ishares.com/us/products/239657/ishares-msci-hong-kong-etf?fundSearch=true&qt=EEMS) |
| EWI | 0.50% | Mar 12, 1996 | Semi-Annual | [Issuer](https://www.ishares.com/us/products/239664/EI) |
| EWJ | 0.49% | Mar 12, 1996 | Semi-Annual | [Issuer](https://www.ishares.com/us/products/239665/ishares-msci-japan-etf) |
| EWM | — | — | — | [Issuer](https://www.ishares.com/us/products/239669/ishares-core-u-s-aggregate-bond-etf) |
| EWP | 0.50% | Mar 12, 1996 | Semi-Annual | [Issuer](https://www.ishares.com/us/products/239683/ishares-core-dividend-growth-etf) |
| EWQ | 0.50% | Mar 12, 1996 | Semi-Annual | [Issuer](https://www.ishares.com/us/products/239648/ishares-msci-france-etf) |
| EWS | 0.50% | Mar 12, 1996 | Semi-Annual | [Issuer](https://www.ishares.com/us/products/239678/ishares-core-aggressive-allocation-etf) |
| EWT | — | — | — | [Issuer](https://www.ishares.com/us/products/239686/EWT?cid=blog%3Asinglecountry%3Aemergingmarkets%3Ablackrock) |
| EWU | 0.50% | Mar 12, 1996 | Semi-Annual | [Issuer](https://www.ishares.com/us/products/239690/ishares-msci-united-kingdom-etf) |
| EWY | 0.59% | May 09, 2000 | Annual | [Issuer](https://www.ishares.com/us/products/239681/ishares-us-real-estate-etf) |
| EWZ | 0.59% | Jul 10, 2000 | Semi-Annual | [Issuer](https://www.ishares.com/us/products/239612/ishares-msci-brazil-capped-etf) |
| EZA | 0.59% | Feb 03, 2003 | Semi-Annual | [Issuer](https://www.ishares.com/us/products/239680/ishares-msci-south-africa-etf?qt=EZA) |
| FEPI | 0.65% | 10/11/2023 | — | [Issuer](https://www.rexshares.com/FEPI/) |
| FLKR | 0.10% | 11/02/2017 | — | [Issuer](https://www.franklintempleton.com/investments/options/exchange-traded-funds/products/26353/SINGLCLASS/franklin-ftse-south-korea-etf/FLKR) |
| FLOT | — | — | — | [Issuer](https://www.ishares.com/us/products/239534/ishares-floating-rate-bond-etf?ihpq=true&qt=EEMS) |
| FLRN | 0.15% | — | — | [Issuer](https://www.ssga.com/us/en/institutional/etfs/state-street-spdr-bloomberg-investment-grade-floating-rate-etf-flrn) |
| FNGU | — | — | — | [Issuer](https://microsectors.com/fang/) |
| FXI | 0.73% | Oct 05, 2004 | Semi-Annual | [Issuer](https://www.ishares.com/us/products/overview-v3-ishares-fund-data?portfolioId=239536&seoSlug=ishares-china-largecap-etf) |
| GDX | 0.51% | 05/16/2006 | — | [Issuer](https://www.vaneck.com/us/en/investments/gold-miners-etf-gdx/overview/) |
| GDXJ | 0.52% | 11/10/2009 | — | [Issuer](https://www.vaneck.com/us/en/investments/junior-gold-miners-etf-gdxj/overview/) |
| GLD | 0.40% | November 18, 2004 | — | [Issuer](https://www.spdrgoldshares.com/usa/gld/) |
| GPTY | 1.06% | 1/22/2025 | — | [Issuer](https://yieldmaxetfs.com/our-etfs/gpty/) |
| GRID | 0.56% | — | — | [Issuer](https://www.ftportfolios.com/Retail/Etf/Etfsummary.aspx?Print=Y&Ticker=GRID) |
| GSG | — | — | — | [Issuer](https://www.ishares.com/us/literature/annual-report/gsg-1231-ar.pdf?documentId=925450~2489864~2413151~2369435~2447702&iframeUrlOverride=%2Fus%2F%2Fliterature%2Fannual-report%2Fgsg-1231-ar.pdf&product=I-GSCITS&shareClass=NA&stream=reg) |
| HACK | 0.60% | 11/10/2014 | — | [Issuer](https://amplifyetfs.com/HACK/) |
| HDV | 0.08% | Mar 29, 2011 | Monthly | [Issuer](https://www.ishares.com/us/products/239563/ishares-high-dividend-etf?qt=HDV) |
| HLAL | — | — | — | [Issuer](https://www.wahed.com/hlal) |
| HYG | — | Apr 04, 2007 | Monthly | [Issuer](https://www.ishares.com/us/products/239565/ishares-iboxx-usd-high-yield-corporate-bond-etf) |
| IAU | — | — | — | [Issuer](https://www.ishares.com/us/literature/fact-sheet/iau-ishares-gold-trust-fund-fact-sheet-en-us.pdf) |
| IBIT | — | Jan 05, 2024 | — | [Issuer](https://www.ishares.com/us/products/333011/isharesBitcoin-trust-etf) |
| ICLN | 0.38% | Jun 24, 2008 | Semi-Annual | [Issuer](https://www.ishares.com/us/products/239738/ishares-global-cle) |
| IDRV | 0.48% | Apr 16, 2019 | Semi-Annual | [Issuer](https://www.ishares.com/us/products/307332/ishares) |
| IEF | 0.15% | Jul 22, 2002 | Monthly | [Issuer](https://www.ishares.com/us/products/239456/ishares-710-year-treasury-bond-etf?source_caller=ui) |
| IEFA | 0.07% | Oct 18, 2012 | Semi-Annual | [Issuer](https://www.ishares.com/us/products/244049/IEFA) |
| IEI | 0.15% | Jan 05, 2007 | Monthly | [Issuer](https://www.ishares.com/us/products/239455/ishares-37-year-treasury-bond-etf?qt=IEI) |
| IEMG | 0.09% | Oct 18, 2012 | Semi-Annual | [Issuer](https://www.ishares.com/us/products/244050/ishares-msci-emerging-markets-ex-china-etf) |
| IGOV | 0.35% | Jan 21, 2009 | Annual | [Issuer](https://www.ishares.com/us/products/239830/) |
| INDA | 0.61% | Feb 02, 2012 | Semi-Annual | [Issuer](https://www.ishares.com/us/products/239659/ishares-msci-india-etf?periodCd=m) |
| ITA | 0.37% | May 01, 2006 | Quarterly | [Issuer](https://www.ishares.com/us/products/239502/ishares-us-aerospace--defense-etf) |
| IVV | 0.03% | May 15, 2000 | Quarterly | [Issuer](https://www.ishares.com/us/products/239726/ishares-core-total-stock-market-etf) |
| IWM | 0.19% | May 22, 2000 | Quarterly | [Issuer](https://www.ishares.com/us/products/239710/ishares-russell-2000-etf) |
| IXN | — | — | — | [Issuer](https://www.ishares.com/us/products/239750/ishares-global-tech-etf?qt=EEMS) |
| JEPI | 0.350% | May 20, 2020 | Monthly | [Issuer](https://am.jpmorgan.com/content/dam/jpm-am-aem/americas/us/en/literature/fact-sheet/etfs/fs-jepi.pdf) |
| JEPQ | 0.350% | May 3, 2022 | Monthly | [Issuer](https://am.jpmorgan.com/content/dam/jpm-am-aem/americas/us/en/literature/fact-sheet/etfs/FS-JEPQ.PDF) |
| JETS | 0.60% | 04/28/2015 | — | [Issuer](https://usglobaletfs.com/fund/u-s-global-jets-etf/) |
| JNK | — | — | Monthly | [Issuer](https://www.ssga.com/us/en/individual/etfs/state-street-spdr-bloomberg-high-yield-bond-etf-jnk) |
| JPIN | — | — | — | [Issuer](https://am.jpmorgan.com/content/dam/jpm-am-aem/americas/us/en/literature/fact-sheet/etfs/FS-JPIN.PDF) |
| JPST | 0.180% | May 17, 2017 | Monthly | [Issuer](https://am.jpmorgan.com/content/dam/jpm-am-aem/americas/us/en/literature/fact-sheet/etfs/FS-JPST.PDF) |
| KARS | 0.69% | 01/18/2018 | Annual | [Issuer](https://kraneshares.com/etf/kars/) |
| KOLD | 0.95% | 10/4/11 | — | [Issuer](https://www.proshares.com/our-etfs/leveraged-and-inverse/KOLD) |
| KTEC | — | 6/8/2021 | Annual | [Issuer](https://kraneshares.com/etf/ktec/) |
| KWEB | — | 7/31/2013 | Annual | [Issuer](https://kraneshares.com/etf/kweb/) |
| LIT | 0.75% | 07/22/10 | Semi-Annual | [Issuer](https://www.globalxetfs.com/funds/lit/) |
| LQD | 0.14% | Jul 22, 2002 | Monthly | [Issuer](https://www.ishares.com/us/products/239566/ishares-iboxx-investment-grade-corporate-bond-etf) |
| MAGS | 0.29% | — | — | [Issuer](https://www.roundhillinvestments.com/assets/pdfs/mags_factsheet.pdf) |
| MBB | — | Mar 13, 2007 | Monthly | [Issuer](https://www.ishares.com/us/products/239465/ishares-7-10-year-treasury-bond-etf) |
| MCHI | 0.59% | Mar 29, 2011 | Semi-Annual | [Issuer](https://www.ishares.com/us/products/239619/ishares-china-largecap-etf) |
| MGK | 0.05% | 12/17/2007 | — | [Issuer](https://advisors.vanguard.com/investments/products/mgk/vanguard-mega-cap-growth-etf) |
| MSTU | 1.05% | 09/18/2024 | — | [Issuer](https://www.rexshares.com/mstu/) |
| MSTY | 1.03% | 2/21/2024 | — | [Issuer](https://yieldmaxetfs.com/our-etfs/msty/?trk=article-ssr-frontend-pulse_little-text-block) |
| MSTZ | 1.05% | 09/18/2024 | — | [Issuer](https://www.rexshares.com/MSTZ/) |
| NLR | 0.52% | 08/13/2007 | — | [Issuer](https://www.vaneck.com/us/en/investments/uranium-nuclear-energy-etf-nlr/fees/) |
| NUKZ | 0.85% | 01/23/2024 | — | [Issuer](https://www.rangeetfs.com/nukz) |
| NVDL | — | — | — | [Issuer](https://graniteshares.com/etfs/nvdl/) |
| NVDW | 0.99% | — | — | [Issuer](https://www.roundhillinvestments.com/etf/nvdw/) |
| NVDY | 1.09% | 5/10/2023 | — | [Issuer](https://yieldmaxetfs.com/our-etfs/nvdy/) |
| PALL | 0.60% | — | — | [Issuer](https://www.aberdeeninvestments.com/docs?editionId=0f2bbbf3-25ce-4024-9343-765d2e4e3e01&elqTrack=true&elqTrackId=AFCAE9342489D489ADD06249AE5B324E) |
| PBW | 0.64% | 03/03/2005 | — | [Issuer](https://www.invesco.com/us/financial-products/etfs/product-detail?audienceType=Investor&ticker=PBW) |
| PDBC | — | — | — | [Issuer](https://www.invesco.com/us/en/solutions/invesco-etfs/commodity-investing.html) |
| PGX | 0.50% | 01/31/2008 | — | [Issuer](https://www.invesco.com/us/en/financial-products/etfs/invesco-preferred-etf.html) |
| POWR | 0.39% | Jan 31, 2012 | Quarterly | [Issuer](https://www.ishares.com/us/products/239653/ishares-u-s-power-infrastructure-etf) |
| PPLT | 0.60% | — | — | [Issuer](https://www.aberdeeninvestments.com/en-us/investor/funds/view-all-funds/-us0032601066) |
| QCLN | 0.59% | — | — | [Issuer](https://www.ftportfolios.com/retail/etf/etfsummary.aspx?ticker=QCLN) |
| QDTE | — | — | — | [Issuer](https://roundhillinvestments.com/etf/qdte/) |
| QDTY | 1.17% | 2/12/2025 | — | [Issuer](https://yieldmaxetfs.com/our-etfs/qdty/) |
| QLD | 0.98% | 6/19/06 | — | [Issuer](https://www.proshares.com/our-etfs/leveraged-and-inverse/qld) |
| QQQ | 0.18% | — | — | [Issuer](https://www.invesco.com/qqq-etf/en/home.html) |
| QQQE | — | — | — | [Issuer](https://www.direxion.com/product/nasdaq-100-equal-weighted-index-etf) |
| QQQM | 0.15% | — | — | [Issuer](https://www.invesco.com/us-rest/contentdetail?contentId=3bb2c37291215710VgnVCM1000006e36b50aRCRD&dnsName=us) |
| QTEC | 0.55% | — | — | [Issuer](https://www.ftportfolios.com/retail/etf/etfsummary.aspx?ticker=qtec) |
| QYLD | 0.60% | 12/11/13 | — | [Issuer](https://www.globalxetfs.com/funds/qyld) |
| RDTE | 0.97% | — | — | [Issuer](https://www.roundhillinvestments.com/etf/rdte/) |
| REMX | — | 10/27/2010 | Annual | [Issuer](https://www.vaneck.com/us/en/investments/rare-earth-strategic-metals-etf-remx?audience=retail&country=us) |
| ROBO | 0.95% | 10/21/2013 | — | [Issuer](https://www.roboglobaletfs.com/robo?hsLang=en) |
| ROKT | — | — | Quarterly | [Issuer](https://www.ssga.com/us/en/institutional/etfs/state-street-spdr-sp-kensho-final-frontiers-etf-rokt) |
| SCHD | — | — | — | [Issuer](https://www.schwabassetmanagement.com/products/schd) |
| SCHG | 0.040% | 12/11/2009 | — | [Issuer](https://www.schwabassetmanagement.com/products/schg) |
| SDIV | 0.58% | 06/08/11 | Monthly | [Issuer](https://www.globalxetfs.com/funds/sdiv/) |
| SGOL | 0.17% | — | — | [Issuer](https://www.aberdeeninvestments.com/en-us/investor/funds/view-all-funds/abrdn-physical-gold-shares-etf-us00326a1043?subTab=keyInformationTab) |
| SGOV | 0.09% | May 26, 2020 | Monthly | [Issuer](https://www.ishares.com/us/products/314116/ishares-0-3-month-treasury-bond-etf-sgov) |
| SHLD | 0.50% | 09/11/23 | — | [Issuer](https://www.globalxetfs.com/funds/shld?trk=article-ssr-frontend-pulse_little-text-block) |
| SHY | 0.15% | Jul 22, 2002 | Monthly | [Issuer](https://www.ishares.com/us/products/239452/ishares-us-real-estate-etf) |
| SJNK | — | — | Monthly | [Issuer](https://www.ssga.com/us/en/individual/etfs/state-street-spdr-bloomberg-short-term-high-yield-bond-etf-sjnk) |
| SKYY | 0.60% | — | — | [Issuer](https://www.ftportfolios.com/Retail/etf/etfsummary.aspx?Ticker=SKYY) |
| SLV | — | Apr 21, 2006 | — | [Issuer](https://www.ishares.com/us/products/239855/ISHARES-SILVER-TRUST-FUND) |
| SLVO | — | — | — | [Issuer](https://etracs.ubs.com/product/detail/index/ussymbol/SLVO) |
| SMH | — | 12/20/2011 | Annual | [Issuer](https://www.vaneck.com/us/en/investments/semiconductor-etf-smh/) |
| SOXL | 0.71% | — | — | [Issuer](https://www.direxion.com/product/daily-semiconductor-bull-bear-3x-etfs.) |
| SOXS | 0.71% | — | — | [Issuer](https://www.direxion.com/product/daily-semiconductor-bull-bear-3x-etfs) |
| SOXX | — | Jul 10, 2001 | Quarterly | [Issuer](https://www.ishares.com/us/products/239705/fund) |
| SOYB | 0.63% | — | — | [Issuer](https://etfs.teucrium.com/SOYB/fund_facts) |
| SPHD | 0.30% | October 18, 2012 | — | [Issuer](https://www.invesco.com/content/dam/invesco/us/en/product-documents/etf/fact-sheet/sphd-invesco-s-p-500-high-dividend-low-volatility-etf-fact-sheet.pdf) |
| SPLV | 0.25% | 05/05/2011 | — | [Issuer](https://www.invesco.com/us/en/financial-products/etfs/invesco-sp-500-low-volatility-etf.html) |
| SPMO | 0.13% | 10/09/2015 | — | [Issuer](https://www.invesco.com/us/financial-products/etfs/holdings?audienceType=Institutional&ticker=SPMO) |
| SPUS | 0.45% | 12/29/2020 | — | [Issuer](https://www.sp-funds.com/SPUS/) |
| SPXL | 0.81% | — | — | [Issuer](https://www.direxion.com/product/daily-sp-500-bull-bear-3x-etfs?keyword=short+sp500+3x) |
| SPY | 0.0945% | — | — | [Issuer](https://www.ssga.com/us/en/intermediary/etfs/state-street-spdr-sp-500-etf-trust-spy) |
| SPYI | — | 8/29/2022 | Monthly | [Issuer](https://neosfunds.com/spyi/) |
| SQQQ | 0.99% | 2/9/10 | — | [Issuer](https://prod.proshares.com/our-etfs/leveraged-and-inverse/sqqq) |
| SRVR | — | — | — | [Issuer](https://docs.paceretfs.com/srvr) |
| TAN | — | — | — | [Issuer](https://www.invesco.com/us/en/solutions/esg-sustainability.html) |
| THD | 0.59% | Mar 26, 2008 | Semi-Annual | [Issuer](https://www.ishares.com/us/products/239688/THD) |
| TIP | 0.18% | Dec 04, 2003 | Monthly | [Issuer](https://www.ishares.com/us/products/239467/ishares-1020-year-treasury-bond-etf) |
| TLH | 0.15% | Jan 05, 2007 | Monthly | [Issuer](https://www.ishares.com/us/products/239453/ishares-3-7-year-treasury-bond-etf) |
| TLT | 0.15% | Jul 22, 2002 | Monthly | [Issuer](https://www.ishares.com/us/products/239454/ishares-floating-rate-bond-etf) |
| TMF | 0.76% | Apr 16, 2009 | — | [Issuer](https://www.direxion.com/product/daily-20-year-treasury-bull-bear-3x-etfs) |
| TQQQ | 0.97% | 2/9/10 | — | [Issuer](https://www.proshares.com/our-etfs/leveraged-and-inverse/tqqq) |
| TSLL | 0.73% | — | — | [Issuer](https://www.direxion.com/product/daily-tsla-bull-and-bear-leveraged-single-stock-etfs) |
| TSLY | 1.07% | 11/22/2022 | — | [Issuer](https://yieldmaxetfs.com/our-etfs/TSLY/) |
| UGL | 0.95% | 12/1/08 | — | [Issuer](https://prod.proshares.com/our-etfs/leveraged-and-inverse/ugl) |
| UNG | — | — | — | [Issuer](https://www.uscfinvestments.com/ung) |
| UPRO | 0.89% | 6/23/09 | — | [Issuer](https://www.proshares.com/our-etfs/leveraged-and-inverse/UPRO) |
| URA | 0.69% | 11/04/10 | Semi-Annual | [Issuer](https://www.globalxetfs.com/funds/Ura) |
| URNM | — | 12/3/2019 | — | [Issuer](https://sprottetfs.com/urnm-sprott-uranium-miners-etf) |
| USD | 0.95% | 1/30/07 | — | [Issuer](https://www.proshares.com/our-etfs/leveraged-and-inverse/usd) |
| USIG | 0.04% | Jan 05, 2007 | Monthly | [Issuer](https://www.ishares.com/us/products/239460/ishares-5-10-year-investment-grade-corporate-bond-etf) |
| USO | — | — | — | [Issuer](https://www.uscfinvestments.com/uso) |
| USOI | — | — | — | [Issuer](https://etracs.ubs.com/product/detail/overview/ussymbol/USOI) |
| VCIT | 0.03% | 11/19/2009 | — | [Issuer](https://advisors.vanguard.com/investments/products/vcit/vanguard-intermediate-term-corporate-bond-etf?cmpgn=FAS%3APS%3AXX%3ALF%3A20250101%3AGG%3ADM%3ALB~FAS_VN~GG_KC~NB_PR~LF_UN~FixedIncomeProduct_MT~Broad_AT~None_EX~None%3ANone%3ANONE%3ANONE%3AKW%3AIntermediateTermCorporateBondETF) |
| VCSH | 0.03% | — | — | [Issuer](https://advisors.vanguard.com/investments/products/vcsh/vanguard-short-term-corporate-bond-etf?cmpgn=FAS%3APS%3AXX%3ALF%3A20250101%3AGG%3ADM%3ALB~FAS_VN~GG_KC~BD_PR~LF_UN~FixedIncomeProduct_MT~Exact_AT~None_EX~None%3ANone%3ANONE%3ANONE%3AKW%3AShortTermCorporateBondETF) |
| VEA | 0.03% | 07/20/2007 | — | [Issuer](https://advisors.vanguard.com/investments/products/vea/vanguard-ftse-developed-markets-et) |
| VGT | 0.09% | 01/26/2004 | — | [Issuer](https://advisors.vanguard.com/investments/products/vgt/vanguard-information-technology-etf?mkwid=HU7FLMVq) |
| VIG | 0.04% | 04/21/2006 | — | [Issuer](https://advisors.vanguard.com/investments/products/new/vig/vanguard-dividend-appreciation-etf) |
| VNM | 0.66% | 08/11/2009 | — | [Issuer](https://www.vaneck.com/us/en/investments/vietnam-etf-vnm/overview/) |
| VNQ | 0.13% | — | — | [Issuer](https://advisors.vanguard.com/investments/products/vnq/vanguard-real-estate-etf?holding=true) |
| VNQI | 0.12% | 11/01/2010 | — | [Issuer](https://advisors.vanguard.com/investments/products/vnqi/vanguard-global-ex-us-real-estate-etf) |
| VOO | 0.03% | 09/07/2010 | — | [Issuer](https://advisors.vanguard.com/investments/products/voo/vanguard-sp-500-etf?fromSearch=true&source=autosuggest) |
| VOOG | 0.07% | 09/07/2010 | — | [Issuer](https://advisors.vanguard.com/investments/products/voog/vanguard-sp-500-growth-etf?source=content_type%3Areact%7Cfirst_level_url%3Aarticle%7Csection%3Amain_content%7Cbutton%3Abody_link) |
| VT | 0.06% | 06/24/2008 | — | [Issuer](https://advisors.vanguard.com/investments/products/vt/vanguard-total-world-stock-etfp) |
| VTI | 0.03% | 05/24/2001 | — | [Issuer](https://advisors.vanguard.com/investments/products/vti/vanguard-total-stock-market-etf) |
| VTIP | — | — | — | [Issuer](https://advisors.vanguard.com/investments/products/vtip/vanguard-short-term-inflation-protected-securities-etf?cmpgn=FAS%3AOSM%3ATSM%3A346846672508) |
| VTV | — | — | — | [Issuer](https://advisors.vanguard.com/investments/products/vtv/vanguard-value-etf) |
| VUG | — | — | — | [Issuer](https://advisors.vanguard.com/investments/products/vug/vanguard-growth-etf) |
| VUSB | 0.10% | 04/05/2021 | — | [Issuer](https://advisors.vanguard.com/investments/products/vusb/vanguard-ultra-short-bond-etf.html) |
| VWO | 0.06% | — | — | [Issuer](https://advisors.vanguard.com/investments/products/vwo/vanguard-ftse-emerging-markets-etf) |
| VXUS | 0.05% | — | — | [Issuer](https://advisors.vanguard.com/investments/products/vxus/vanguard-total-international-stock-etf) |
| VYM | 0.04% | 11/10/2006 | — | [Issuer](https://advisors.vanguard.com/investments/products/vym/vanguard-high-dividend-yield-etf?fromsearch=true&source=autosuggest) |
| VYMI | 0.07% | 02/25/2016 | — | [Issuer](https://advisors.vanguard.com/investments/products/vymi/vanguard-international-high-dividend-yield-etf?cmpgn=FAS%3AOSM%3ATSM%3A875798830694) |
| WEAT | 0.62% | — | — | [Issuer](https://etfs.teucrium.com/WEAT/fund_facts) |
| XBI | — | — | Quarterly | [Issuer](https://www.ssga.com/us/en/individual/etfs/state-street-spdr-sp-biotech-etf-xbi) |
| XDTE | 0.97% | — | — | [Issuer](https://www.roundhillinvestments.com/etf/xdte/) |
| XHB | — | — | Quarterly | [Issuer](https://www.ssga.com/us/en/intermediary/etfs/state-street-spdr-sp-homebuilders-etf-xhb) |
| XLB | — | — | Quarterly | [Issuer](https://www.ssga.com/us/en/individual/etfs/state-street-materials-select-sector-spdr-etf-xlb) |
| XLE | 0.08% | — | Quarterly | [Issuer](https://www.ssga.com/us/en/individual/etfs/state-street-energy-select-sector-spdr-etf-xle) |
| XLF | 0.08% | — | Quarterly | [Issuer](https://www.ssga.com/us/en/individual/etfs/state-street-financial-select-sector-spdr-etf-xlf) |
| XLK | — | — | — | [Issuer](https://www.ssga.com/us/en/individual/etfs/state-street-technology-select-sector-spdr-etf-xlk) |
| XLP | — | — | Quarterly | [Issuer](https://www.ssga.com/us/en/intermediary/etfs/state-street-consumer-staples-select-sector-spdr-etf-xlp) |
| XLRE | — | — | Quarterly | [Issuer](https://www.ssga.com/us/en/individual/etfs/state-street-real-estate-select-sector-spdr-etf-xlre) |
| XLU | 0.08% | — | — | [Issuer](https://www.ssga.com/us/en/individual/etfs/state-street-utilities-select-sector-spdr-etf-xlu) |
| XLV | — | — | — | [Issuer](https://www.ssga.com/jp/ja/individual/etfs/state-street-health-care-select-sector-spdr-etf-xlv) |
| XLY | — | — | Quarterly | [Issuer](https://www.ssga.com/us/en/individual/etfs/state-street-consumer-discretionary-select-sector-spdr-etf-xly) |
| XRT | 0.35% | — | Quarterly | [Issuer](https://www.ssga.com/us/en/individual/etfs/state-street-spdr-sp-retail-etf-xrt) |
| YINN | — | Dec 03, 2009 | — | [Issuer](https://www.direxion.com/product/daily-ftse-china-bull-bear-3x-etfs) |
| YMAG | 1.34% | 1/29/2024 | — | [Issuer](https://yieldmaxetfs.com/our-etfs/YMAG/) |
| YMAX | 1.33% | 1/16/2024 | — | [Issuer](https://yieldmaxetfs.com/our-etfs/YMAX/) |

### Verified examples that change the data contract

- **JEPQ:** the August 31, 2026 factsheet gives net/gross annual expenses of 0.35%, a May 3, 2022 launch, and monthly income. It has no live 5Y history at this research date. It reports a **12-month rolling dividend yield** based on individual ex-date NAV yields; that is a different definition from this plan’s sum-of-distributions/current-price trailing yield. Store the issuer metric under its own definition. [JEPQ factsheet](https://am.jpmorgan.com/content/dam/jpm-am-aem/americas/us/en/literature/fact-sheet/etfs/FS-JEPQ.PDF).
- **GPTY:** issuer material lists January 22, 2025 inception, 1.06% gross expenses, weekly distributions, and a focused AI/tech portfolio. Its annualized distribution rate is distinct from SEC yield and total return; some payment estimates contain substantial return of capital. Preserve notices and tax-estimate status. [GPTY](https://yieldmaxetfs.com/our-etfs/gpty/).
- **NVDW:** issuer material targets **1.2× NVDA’s calendar-week total return before fees/expenses** with weekly distributions. This is a leveraged weekly strategy, not an ordinary daily-reset fund or generic covered-call substitute. [NVDW](https://www.roundhillinvestments.com/etf/nvdw/).
- **FNGU:** issuer material identifies a **3× daily NYSE FANG+ ETN issued by BMO**, with issuer-credit and call/redemption risks. Pluang’s current name is not a reliable benchmark identifier. Current-series mapping remains unresolved. [FANG+ issuer page](https://microsectors.com/fang/).

## Historical return, distribution, risk, and holdings feasibility

| Planned field | Appropriate source / calculation | Research outcome |
|---|---|---|
| Identity, mandate, benchmark, legal structure, inception | Current US issuer prospectus/fact sheet; exchange/CUSIP/ISIN plus platform ID | Source locators cover the full census; FLOT mapping and FNGU series require confirmation; names/mandates need effective dates |
| 1Y/3Y/5Y/10Y/since-inception total return | Dated issuer NAV and market-price performance; cross-check a validated adjusted-history provider | Feasible for mature funds; not collected on a common date. Shorter fund histories must remain missing. Issuer tables may mix month-end and quarter-end periods |
| Calendar-year returns / $10k growth | Issuer standardized reports or validated daily total-return series | Issuer examples confirm reinvestment treatment; full per-fund historical dataset not collected |
| Trailing distribution yield | Complete split-adjusted payments and contemporaneous unadjusted close | Platform “dividend yield” is insufficient. Issuer trailing, rolling dividend, distribution-rate and SEC definitions differ |
| Five-year average cash yield | Five complete calendar years of payments, split adjustments and beginning-year prices | No complete distribution/split dataset validated. Younger funds cannot supply this metric |
| Distribution stability / growth / composition | Issuer distribution tables, 19a notices, tax supplements, corporate-action history | Relevant especially to options funds; notices may be estimates and final tax classification can differ |
| 30-day SEC yield | Dated issuer value with subsidized/unsubsidized labels | Often available for bonds; distinct from trailing cash payments and annualized latest payout |
| Daily drawdown / recovery / current drawdown | Continuous daily total-return observations with reinvestment and splits | Not available from catalogue prices or 52W high/low. No daily provider coverage validated across the universe |
| Five-year volatility | Complete monthly total returns | Not computed; do not replace with issuer 3Y standard deviation or since-inception volatility |
| Expense ratio / fee waiver | Current prospectus net and gross fees; acquired-fund costs, waiver expiry; ETN investor fee separate | Candidate observations captured where available; full normalization/document review outstanding |
| AUM | Dated fund/ETF-share-class net assets, with scale/currency | Candidate observations only; reject catalogue “Market Cap” as AUM; distinguish share class from total Vanguard fund |
| Holdings / top ten / country / sector | Dated issuer download with weights and fund structure | Source routes located; full downloadable holdings census and concentration/overlap not computed |
| Spread / premium-discount / volume | Dated issuer/exchange statistics; correct NAV and share class | Supplementary research; not validated across every fund |
| IDR return / platform cost / tax | Matched historical FX, actual platform charges, configurable investor inputs | FX history and effective conversion costs not collected; use published charges only with dates |

No public Pluang profile “ROI,” price sparkline, Aura AI summary, typical holding time, analyst signal, or trader buy/sell percentage qualifies as a validated annualized total return or risk statistic. The quoted total-return series must include distributions; do not add yield to CAGR or deduct already-included operating expenses again.

Issuer download routes vary: iShares fund pages include performance/distributions and holdings downloads; Vanguard advisor pages distinguish NAV/market returns and share-class assets; State Street provides factsheets and fund statistics; Invesco provides product pages and factsheets; JPMorgan factsheets identify mixed reporting dates; Global X and ARK publish holdings; YieldMax/Roundhill/REX provide strategy-specific distributions/notices; commodity issuers provide pool/fund reports; UBS/BMO provide note terms and coupons. These are source maps, not tested all-fund ingestion adapters or data-redistribution licenses.

## Peer sets the page can support

| Comparison | Available examples | Required distinction |
|---|---|---|
| S&P 500 core | VOO, IVV, SPY | Same exposure; compare matched total return, spread and fees |
| Nasdaq-100 | QQQ, QQQM, QQQE | QQQE uses equal weights; not identical portfolio exposure |
| US growth | VUG, SCHG, MGK, VOOG | Different size/index rules; review current benchmark changes |
| Global versus ex-US | VT, ACWI versus VXUS, VEA, IEFA, VWO, IEMG | US inclusion and developed/emerging split; FTSE/MSCI country rules differ |
| Dividend equities | SCHD, VIG, VYM, HDV, SPHD; VYMI/SDIV overseas/global | Dividend growth versus high payout; international and style exposures differ |
| Cash/short bonds | SGOV, BIL, SHY, JPST, VUSB, FLOT, FLRN | Treasury bills versus credit funds; FLOT identity pending |
| Investment-grade bonds | BND, AGG, VCIT, VCSH, LQD, USIG, BNDX | Duration, credit, mortgage exposure, hedging/geography |
| Technology/semiconductors | VGT, XLK, IXN; SMH, SOXX | Broad tech versus semiconductors, geography and concentration |
| Cybersecurity | CIBR, HACK, BUG | Index rules and holdings overlap |
| Robotics | BOTZ, ROBO, ARKQ | Passive thematic versus active selection; issuer correction for ROBO |
| Physical gold | GLD, IAU, SGOL, AAAU | Bullion trusts; GDX/GDXJ are miners and UGL is leveraged futures |
| Bitcoin | IBIT, BTCO versus BITO, BITU | Spot trust versus futures/swaps and daily leverage; BITQ/BLOK are equities |
| Options income | JEPI, JEPQ, SPYI, QYLD, QDTE, XDTE, RDTE, QDTY | Different benchmarks, option overlays/reset frequency and yield definitions |
| Single-stock strategies | NVDL/NVDY/NVDW; TSLL/TSLY; CONL/CONY; MSTU/MSTZ/MSTY | Leverage, inverse, option income and weekly targets are different mandates |
| Uranium/nuclear | URA, URNM, NLR, NUKZ | Miners, uranium holdings and broader nuclear infrastructure differ |

## Required plan changes and completion gates

1. Use the **reconciled 216-candidate catalogue**, not only the 212-entry ETF bucket. Keep FLOT visible with unresolved identity. Track ETNs separately; exclude FCNCA, TEM and ACP explicitly.
2. Display “Public catalogue verified 2026-10-06; account tradability not confirmed.” A buy link or anonymous disabled flag does not prove tradability/suspension.
3. Preserve platform asset ID, original name, issuer-verified name, exchange, CUSIP/ISIN, structure, mandate history, underlying asset class, leverage/reset interval, provenance and field status.
4. Record source discovery and numerical validation as different states. A candidate expense or inception value is not approved for UI comparison until the US product, units, net/gross scope and reporting date pass review.
5. Give options-income, 0DTE, single-stock, daily leveraged/inverse, weekly leveraged, physical trust, commodity pool and ETN structures distinct explanatory badges. Never infer leverage from Pluang bucket membership.
6. Keep metrics incomplete visibly. Obtain and validate adjusted price/payment/split histories before claiming complete CAGR, average cash yield, daily drawdown, recovery, or overlap coverage.
7. Require a reconciliation check before each catalogue refresh: every public profile labeled ETF is retained, separately classified, or explicitly excluded; all 1,024 census records are accounted for, not just popular tickers.

**Open data gates:** authenticated account eligibility; FLOT contract mapping; FNGU current series/corporate actions; present US legal forms and changed mandates; full current net/gross fees and waiver dates; matched-date historical returns; distributions/splits/composition; daily return-series validation; dated holdings and provider/redistribution access. These are not hidden omissions from the ticker inventory. They are explicit unfinished enrichment or identity checks, so Phase 1 of the original plan is not fully accepted yet.
