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

// Finviz blocks requests from cloud/datacenter IP ranges (Vercel's included), so a direct
// fetch works locally but 502s in production. Route through r.jina.ai's reader proxy first —
// it fetches the page from its own IPs and returns readable markdown instead of raw HTML —
// falling back to a direct fetch (e.g. for local dev, where Finviz isn't blocking us anyway).
function parseJinaMarkdown(markdown: string): { ticker: string; company: string }[] {
  const rowRe =
    /\[(\d+)\]\(https:\/\/finviz\.com\/stock\?t=([A-Z.\-]+)&ty=c&p=d&b=1\)[\s\S]*?\[\2\]\(https:\/\/finviz\.com\/stock\?t=\2&ty=c&p=d&b=1\) \| \[([^\]]+)\]\(/g;
  const results: { ticker: string; company: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(markdown))) {
    results.push({ ticker: m[2], company: m[3] });
  }
  return results;
}

function parseScreenerHtml(html: string): { ticker: string; company: string }[] {
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

async function fetchPage(page: number): Promise<{ ticker: string; company: string }[]> {
  const rowOffset = (page - 1) * ROWS_PER_PAGE + 1;
  const url = `${BASE_URL}&r=${rowOffset}`;

  try {
    const resp = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: "text/plain" },
    });
    if (resp.ok) {
      const markdown = await resp.text();
      const rows = parseJinaMarkdown(markdown);
      if (rows.length > 0) return rows;
    }
  } catch {
    // fall through to direct fetch
  }

  const resp = await fetch(url, { headers: HEADERS });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return parseScreenerHtml(await resp.text());
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
