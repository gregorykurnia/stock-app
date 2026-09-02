import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

// Mirrors finviz-screener-ca's screener.py: Market Cap >= $1B, 0-3% below 50-Day High,
// sorted by Market Cap desc, 10 pages of 20 rows (200 tickers max).
const BASE_URL =
  "https://finviz.com/screener.ashx?v=111&f=cap_1000to,ta_highlow50d_b0to3h&ft=3&o=-marketcap";
const ROWS_PER_PAGE = 20;
const PAGES = 10;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  Referer: "https://finviz.com/",
};

async function fetchPage(page: number): Promise<{ ticker: string; company: string }[]> {
  const rowOffset = (page - 1) * ROWS_PER_PAGE + 1;
  const url = `${BASE_URL}&r=${rowOffset}`;
  const resp = await fetch(url, { headers: HEADERS });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

  const html = await resp.text();
  const $ = cheerio.load(html);
  const table = $("table#screener-content").length ? $("table#screener-content") : $("table.screener_table");
  if (table.length === 0) return [];

  const results: { ticker: string; company: string }[] = [];
  table.find("tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 3) return;
    const first = $(cells[0]).text().trim();
    if (!/^\d+$/.test(first)) return;

    const rawTicker = $(cells[1]).text().trim();
    const ticker = rawTicker.length > 1 ? rawTicker.slice(1) : rawTicker;
    const company = $(cells[2]).text().trim();
    results.push({ ticker, company });
  });

  return results;
}

export async function GET() {
  const all: { ticker: string; company: string }[] = [];
  try {
    for (let page = 1; page <= PAGES; page++) {
      const rows = await fetchPage(page);
      if (rows.length === 0) break;
      all.push(...rows);
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Screener fetch failed", partial: all },
      { status: 502 }
    );
  }

  return NextResponse.json({ results: all });
}
