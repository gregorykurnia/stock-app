# Navigation reorganization implementation directions

Status: implementation plan only. This document does not authorize removing or merging any page.

## Goal

Replace the crowded header with four main areas: **Research**, **Portfolio**, **Markets**, and **Personal Finance**. Show a second navigation row containing the pages for the active area. Preserve every existing page, URL, feature, data source, and page-level control.

Treat this as a change to navigation presentation. Performance and Returns remain separate pages. ETF and Heatmap remain separate pages. Do not combine page implementations into a new dashboard.

## Page preservation inventory

The repository currently has 14 page routes. Before implementation, repeat the route inventory to catch any pages added after this document was written. Every existing route must remain present and directly accessible after the change.

| Existing route | Existing file | Main area | Secondary navigation label / treatment |
| --- | --- | --- | --- |
| `/` | `app/page.tsx` | Research | Master Table; Research default |
| `/screener-draft` | `app/screener-draft/page.tsx` | Research | Screener, with a visible Draft badge |
| `/notes` | `app/notes/page.tsx` | Research | Notes |
| `/watchlist` | `app/watchlist/page.tsx` | Research | Watchlist |
| `/alerts` | `app/alerts/page.tsx` | Research | Alerts |
| `/stock/[ticker]` | `app/stock/[ticker]/page.tsx` | Research | Detail route; retain existing entry links and Back link |
| `/breakout-chart/[ticker]` | `app/breakout-chart/[ticker]/page.tsx` | Research | Detail route; retain ticker navigation and Back link |
| `/portfolio` | `app/portfolio/page.tsx` | Portfolio | Holdings; Portfolio default |
| `/performance` | `app/performance/page.tsx` | Portfolio | Performance |
| `/performance-returns` | `app/performance-returns/page.tsx` | Portfolio | Returns |
| `/markets` | `app/markets/page.tsx` | Markets | Market Overview; Markets default |
| `/etf` | `app/etf/page.tsx` | Markets | ETF |
| `/heatmap` | `app/heatmap/page.tsx` | Markets | Heatmap |
| `/personal-finance` | `app/personal-finance/page.tsx` | Personal Finance | Main area opens this page; no redundant secondary row |

Watchlist and Alerts already exist even though they are absent from the current global header. Include them in Research so they remain discoverable. Dynamic detail routes need no generic secondary link because they require a ticker. Highlight Research on those routes without falsely marking Master Table as the current page.

## Required interaction

Desktop header:

```text
Stock Analysis    Research    Portfolio    Markets    Personal Finance
                 Master Table    Screener [Draft]    Notes    Watchlist    Alerts
```

The second row above is the Research example. Portfolio shows Holdings, Performance, and Returns. Markets shows Market Overview, ETF, and Heatmap.

1. Keep the Stock Analysis brand linked to `/`.
2. Clicking a main area opens its default route from the inventory. Use ordinary links, with support for opening in a new tab. No extra group landing pages are needed.
3. Derive the active area and active page from the URL. Direct entry, refresh, and browser Back/Forward must produce the same selection as clicking a link.
4. Clicking a secondary link opens the existing route. These links are navigation, not local panels that embed or conditionally render existing page components.
5. Preserve query strings and hashes in existing page links and controls. Group links may use their default URLs; they must not rewrite the current page URL on mount.
6. Give the active area and current secondary page a clear visual treatment that also works without color alone.
7. On narrow screens, keep the brand and an accessible menu button visible. Expand the menu into the same four areas, each with its page links, using a simple disclosure panel. Keep the active area's secondary row horizontally scrollable if needed. Prevent whole-page horizontal overflow and keep every destination accessible.
8. Close the mobile disclosure after a destination is selected or Escape is pressed. Give its button an accessible name, `aria-expanded`, and `aria-controls`; keep focus handling predictable.

## Strict preservation boundaries

- Do not delete, rename, relocate, or replace any existing `app/**/page.tsx` file.
- Do not change route URLs, introduce redirects, or move pages into new route folders for this task.
- Do not edit page contents, page metadata, calculations, API routes, Firebase configuration, storage keys, saved data, service worker behavior, or business logic.
- Do not remove existing in-page tabs, filters, stock links, ticker selectors, editor controls, or Back links. Global secondary navigation is an additional navigation layer.
- Navigation label changes apply only to navigation text. Keep page titles and functionality intact. The Draft state must remain visible for Screener.
- Preserve the root layout's `{children}` rendering exactly once. Do not wrap it in logic that selects or hides pages by navigation group.
- Do not clear or reseed data during development or validation. Use existing read-only page views to check loaded data.
- Do not include unrelated work in the implementation commit. Record the initial Git status and preserve any work already present.

## Implementation sequence

### 1. Establish the baseline

Read `AGENTS.md` and any applicable nested instructions. Record Git status and list all `app/**/page.*` files. Compare them with the inventory above; add any newly discovered routes to the plan before changing navigation.

Capture the current header and representative pages at desktop and mobile widths. Record any existing failures separately so the redesign is not used to conceal them.

Read the installed Next.js documentation before writing code, especially:

- `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/04-linking-and-navigating.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md`
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-pathname.md`

### 2. Define the navigation mapping

Create one small navigation configuration containing area labels, default hrefs, secondary destinations, and explicit detail-route membership. Reuse it for desktop and mobile so their destinations cannot drift apart.

Use exact matching for static routes, especially `/`. Do not use broad prefix matching that mistakes `/performance-returns` for `/performance`, or makes `/` match every URL. Only use bounded prefixes for detail routes such as `/stock/` and `/breakout-chart/`.

An unknown route must not cause a redirect or hide page content. Leave its navigation selection unset until it receives an explicit mapping.

### 3. Extract and replace the header

The current header is in `app/layout.tsx`. Create a focused client navigation component, for example `components/AppNavigation.tsx`, using `next/link` and `usePathname` in accordance with the installed documentation.

Keep `app/layout.tsx` a Server Component. Preserve its fonts, metadata, viewport, body structure, `ServiceWorkerRegister`, and `{children}`. Replace only the existing header markup with the new navigation component, and remove imports only when they become unused.

Check the actual Next.js configuration for `cacheComponents`, rewrites, and other pathname constraints. Follow the installed `usePathname` guide if a Suspense boundary or hydration handling is required. Do not modify project-wide configuration to simplify the header.

Use the existing colors, borders, typography, and content width. Keep styles local to the navigation where possible. Preserve sticky behavior with the combined header height; inspect existing sticky table headers and overlays for overlap before deciding whether any offset adjustment is needed.

### 4. Add accessible responsive behavior

Use separate labeled navigation landmarks for main areas and page links. Use anchors rather than ARIA tab widgets because selections navigate to different URLs. Mark the exact current destination with `aria-current="page"`; indicate its parent area appropriately without claiming its default link is the current page on a child route.

Support keyboard operation, visible focus, readable labels, and touch targets. Keep secondary navigation separate from any existing page tabs. Do not rely on hover-only menus. Respect reduced motion if adding transitions.

## Validation and acceptance gates

Do not commit the implementation until these gates pass:

- [ ] Before/after route inventories match, including all 14 routes listed above and any later additions.
- [ ] The diff contains no deleted, moved, renamed, or modified page implementations and no data/business-logic changes. Review any essential layout-offset edits individually.
- [ ] Every static route opens directly and through navigation, renders its existing page, and survives refresh.
- [ ] `/stock/[ticker]` and `/breakout-chart/[ticker]` are checked with valid existing tickers. Detail content, Back links, and ticker changes still work.
- [ ] Research, Portfolio, and Markets show the correct secondary links; Personal Finance opens its existing page.
- [ ] `/performance` and `/performance-returns` highlight different secondary links. Both pages retain their existing internal tabs and features.
- [ ] Browser Back/Forward, new-tab opening, existing query/hash links, and direct deep links work.
- [ ] Navigation works at approximately 375 px, 768 px, and 1440 px widths, without hidden destinations or whole-page horizontal overflow.
- [ ] Sticky header, table headers, dropdowns, dialogs, and page content do not overlap incorrectly.
- [ ] Keyboard focus, menu expansion, Escape, accessible names, and current-page indication work.
- [ ] Existing loaded data remains visible. No checks modify saved holdings, notes, alerts, or finance data.
- [ ] `npm run lint`, `npm run typecheck`, and `npm run build` pass. Resolve new failures; document any demonstrably pre-existing failures and do not claim validation passed while checks remain blocked.
- [ ] Add or run focused navigation checks where the existing test setup supports them. Verify route coverage and active matching; avoid expanding this task into unrelated test infrastructure.
- [ ] `git diff --check` passes and the final diff is reviewed for scope.

Capture desktop and mobile screenshots of the completed header and record the validation results. Commit only the validated navigation change and push the current branch to `origin`, as required by `AGENTS.md`.

## Recovery

If a route disappears, data changes, or page behavior breaks, stop rollout and fix the navigation change before proceeding. Do not recreate missing pages from simplified substitutes.

Keep the implementation in a focused commit so it can be reverted to restore the original header without touching page files or data. Never use a destructive Git reset to undo this work or discard unrelated edits.

## Definition of done

The header contains four main areas, every existing page remains reachable at its original URL, desktop and mobile navigation pass the acceptance gates, and the validated change is committed and pushed. Fewer header links must never mean fewer pages or features.
