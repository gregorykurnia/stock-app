import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

// 10 sequential page fetches (jina + potential direct-fetch fallback each) can exceed
// Vercel's default serverless timeout, so raise it and fetch pages in parallel instead.
export const maxDuration = 60;

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
// Finviz's own row number (#1, #2, ...) reflects its current sort (market cap desc, per
// BASE_URL's o=-marketcap) — captured as `rank` so the app can preserve that order later.
function parseJinaMarkdown(markdown: string): { ticker: string; company: string; rank: number }[] {
  const rowRe =
    /\[(\d+)\]\(https:\/\/finviz\.com\/stock\?t=([A-Z.\-]+)&ty=c&p=d&b=1\)[\s\S]*?\[\2\]\(https:\/\/finviz\.com\/stock\?t=\2&ty=c&p=d&b=1\) \| \[([^\]]+)\]\(/g;
  const results: { ticker: string; company: string; rank: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(markdown))) {
    results.push({ ticker: m[2], company: m[3], rank: Number(m[1]) });
  }
  return results;
}

function parseScreenerHtml(html: string): { ticker: string; company: string; rank: number }[] {
  const $ = cheerio.load(html);
  const table = $("table#screener-content").length ? $("table#screener-content") : $("table.screener_table");
  if (table.length === 0) return [];

  const results: { ticker: string; company: string; rank: number }[] = [];
  table.find("tr").each((_, row) => {
    const cells = $(row).find("td");
    if (cells.length < 3) return;
    const first = $(cells[0]).text().trim();
    if (!/^\d+$/.test(first)) return;

    const rawTicker = $(cells[1]).text().trim();
    const ticker = rawTicker.length > 1 ? rawTicker.slice(1) : rawTicker;
    const company = $(cells[2]).text().trim();
    results.push({ ticker, company, rank: Number(first) });
  });

  return results;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// r.jina.ai 403s intermittently when hit with a burst of concurrent requests from the same
// source (Vercel's serverless IPs) — a couple of retries with backoff clears it almost every
// time without needing to fall back to the direct fetch (which finviz blocks from Vercel).
async function fetchPageAttempt(page: number): Promise<{ ticker: string; company: string; rank: number }[]> {
  const rowOffset = (page - 1) * ROWS_PER_PAGE + 1;
  const url = `${BASE_URL}&r=${rowOffset}`;
  const errors: string[] = [];

  try {
    const resp = await fetchWithTimeout(`https://r.jina.ai/${url}`, { headers: { Accept: "text/plain" } }, 20000);
    if (resp.ok) {
      const markdown = await resp.text();
      const rows = parseJinaMarkdown(markdown);
      if (rows.length > 0) return rows;
      errors.push(`jina: parsed 0 rows (${markdown.length} chars)`);
    } else {
      errors.push(`jina: HTTP ${resp.status}`);
    }
  } catch (err) {
    errors.push(`jina: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    const resp = await fetchWithTimeout(url, { headers: HEADERS }, 15000);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return parseScreenerHtml(await resp.text());
  } catch (err) {
    errors.push(`direct: ${err instanceof Error ? err.message : String(err)}`);
  }

  throw new Error(`page ${page} failed — ${errors.join("; ")}`);
}

async function fetchPage(page: number): Promise<{ ticker: string; company: string; rank: number }[]> {
  const RETRIES = 3;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    if (attempt > 0) await sleep(800 * attempt);
    try {
      return await fetchPageAttempt(page);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`page ${page} failed`);
}

// Fetching all 10 pages at once tends to trip r.jina.ai's rate limiting; a small concurrency
// cap with a short stagger between batches avoids the burst while staying well inside maxDuration.
const CONCURRENCY = 3;

async function fetchAllPages(): Promise<{ ticker: string; company: string; rank: number }[]> {
  const results: { ticker: string; company: string; rank: number }[][] = new Array(PAGES);
  for (let i = 0; i < PAGES; i += CONCURRENCY) {
    const batch = Array.from({ length: Math.min(CONCURRENCY, PAGES - i) }, (_, j) => i + j + 1);
    const batchResults = await Promise.all(batch.map((page) => fetchPage(page)));
    batch.forEach((page, j) => { results[page - 1] = batchResults[j]; });
    if (i + CONCURRENCY < PAGES) await sleep(300);
  }
  return results.flat();
}

export async function GET() {
  try {
    const all = await fetchAllPages();
    return NextResponse.json({ results: all });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Screener fetch failed" },
      { status: 502 }
    );
  }
}
