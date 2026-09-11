// Squarified treemap layout (Bruls, Huizing & van Wijk) for the heatmap.
// Pure geometry — no React, no data fetching — so the algorithm is directly
// unit-testable and the component only handles rendering/interaction.
//
// All weights must be > 0; callers map missing weights to a small epsilon so
// every stock stays visible. The layout conserves area exactly (within float
// rounding) and never produces negative or NaN rects for valid inputs.

export interface TreemapInput {
  key: string;
  weight: number;
}

export interface TreemapRect {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function worstRatio(rowWeights: number[], rowSum: number, sideLength: number): number {
  if (sideLength <= 0 || rowSum <= 0) return Number.POSITIVE_INFINITY;
  const thickness = rowSum / sideLength;
  let worst = 0;
  for (const weight of rowWeights) {
    const length = weight / thickness;
    if (!(length > 0)) return Number.POSITIVE_INFINITY;
    const ratio = Math.max(thickness / length, length / thickness);
    if (ratio > worst) worst = ratio;
  }
  return worst;
}

// Lays `items` (already sorted however the caller prefers — descending weight
// gives the classic look) into `rect`. Weights are scaled to fill the rect
// exactly. Items whose weight is <= 0 are clamped to a minimum share so they
// still receive a visible sliver.
export function squarify(items: TreemapInput[], rect: Rect): TreemapRect[] {
  const total = items.reduce((sum, item) => sum + (Number.isFinite(item.weight) ? item.weight : 0), 0);
  if (items.length === 0) return [];
  if (!(rect.width > 0) || !(rect.height > 0) || !(total > 0)) {
    // Degenerate container or weights: collapse everything to a zero-area rect
    // at the origin so callers never see NaN/Infinity geometry.
    return items.map((item) => ({ key: item.key, x: rect.x, y: rect.y, width: 0, height: 0 }));
  }

  const area = rect.width * rect.height;
  // Items the caller couldn't weight (missing market cap etc.) get a minimal
  // share so they render as a visible sliver instead of disappearing.
  const EPSILON_SHARE = 1e-4; // 0.01% of total area
  const scaled = items.map((item) => {
    const weight = Number.isFinite(item.weight) && item.weight > 0 ? item.weight : total * EPSILON_SHARE;
    return (weight / total) * area;
  });

  const result: TreemapRect[] = new Array(items.length);
  let index = 0;
  let { x, y, width, height } = rect;

  while (index < scaled.length) {
    const side = Math.min(width, height);
    // Greedily grow the row while adding the next item improves the worst
    // aspect ratio of any tile in the row.
    const row: number[] = [index];
    let rowSum = scaled[index];
    let bestRatio = worstRatio([scaled[index]], rowSum, side);
    while (index + row.length < scaled.length) {
      const candidateSum = rowSum + scaled[index + row.length];
      const candidateRow = [...row, index + row.length].map((i) => scaled[i]);
      const candidateRatio = worstRatio(candidateRow, candidateSum, side);
      if (candidateRatio > bestRatio) break;
      row.push(index + row.length);
      rowSum = candidateSum;
      bestRatio = candidateRatio;
    }

    // A row is a strip along the shorter side; thickness = strip depth.
    const thickness = rowSum / side;
    let offset = 0;
    for (const itemIndex of row) {
      const length = scaled[itemIndex] / thickness;
      if (width >= height) {
        // Vertical strip on the left edge.
        result[itemIndex] = { key: items[itemIndex].key, x, y: y + offset, width: thickness, height: length };
      } else {
        // Horizontal strip along the top edge.
        result[itemIndex] = { key: items[itemIndex].key, x: x + offset, y, width: length, height: thickness };
      }
      offset += length;
    }

    if (width >= height) {
      x += thickness;
      width -= thickness;
    } else {
      y += thickness;
      height -= thickness;
    }
    index += row.length;
  }

  return result;
}

export interface GroupInput {
  key: string;
  weight: number;
  items: TreemapInput[];
}

export interface GroupedRect {
  groupKey: string;
  // Full rect reserved for the group (header strip included).
  rect: Rect;
  // Rect minus the header strip — the area the group's items fill.
  contentRect: Rect;
  items: TreemapRect[];
}

// Two-level layout: groups are squarified into `rect`, each group draws a
// header strip of `headerHeight` px at the top of its rect, and the remaining
// content area is squarified into the group's items. Groups with tiny rects
// keep their full rect as content (a header would eat the whole tile).
export function layoutGroups(groups: GroupInput[], rect: Rect, headerHeight: number): GroupedRect[] {
  const placed = squarify(
    groups.map((group) => ({ key: group.key, weight: group.weight })),
    rect
  );
  const byKey = new Map(placed.map((entry) => [entry.key, entry]));

  return groups.map((group) => {
    const groupRect = byKey.get(group.key) ?? { key: group.key, x: rect.x, y: rect.y, width: 0, height: 0 };
    const canShowHeader = groupRect.height > headerHeight * 2 && groupRect.width >= headerHeight;
    const contentRect: Rect = canShowHeader
      ? { x: groupRect.x, y: groupRect.y + headerHeight, width: groupRect.width, height: groupRect.height - headerHeight }
      : { x: groupRect.x, y: groupRect.y, width: groupRect.width, height: groupRect.height };
    const items = squarify(group.items, contentRect);
    return { groupKey: group.key, rect: groupRect, contentRect, items };
  });
}
