// One deterministic demo price path shared by synthetic quotes and bars, so a demo
// quote and the bar covering the same minute always agree. Prices oscillate ±0.4%
// around the fixture's final lesson close; this is a teaching path, not a market model.
export const syntheticBaseClose = 112;

function seedOf(symbol: string) {
  return [...symbol].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
}

// Price in currency units at a given minute since the epoch.
export function syntheticPrice(symbol: string, minute: number) {
  return syntheticBaseClose * (1 + 0.004 * Math.sin(minute / 7 + seedOf(symbol)));
}

export const roundCents = (v: number) => Math.round(v * 100) / 100;
