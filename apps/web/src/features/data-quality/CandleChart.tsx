import type { MarketDataset } from "@portfolio-atlas/contracts";
export function CandleChart({ dataset }: { dataset: MarketDataset }) {
  const accepted = new Set(dataset.quality.acceptedIndexes);
  const dates = [
    ...new Set([
      ...dataset.rows.map((row) => row.sessionDate).filter((v): v is string => Boolean(v)),
      ...dataset.quality.coverage.missingSessions.map((row) => row.sessionDate),
    ]),
  ].sort();
  const valid = dataset.rows.filter((_, index) => accepted.has(index));
  const prices = valid.flatMap((row) => [row.low!, row.high!]);
  const min = prices.length ? Math.min(...prices) : 0,
    max = prices.length ? Math.max(...prices) : 1;
  const x = (date: string | null) =>
    40 + (dates.indexOf(date ?? "") * 680) / Math.max(1, dates.length - 1);
  const y = (price: number) => 180 - ((price - min) * 145) / Math.max(1, max - min);
  return (
    <figure className="quality-chart">
      <svg
        viewBox="0 0 760 240"
        role="img"
        aria-label="Daily candle quality chart. Rejected and missing sessions interrupt the price series."
      >
        <line x1="30" y1="195" x2="735" y2="195" stroke="currentColor" opacity=".2" />
        {dates.map((date, index) => (
          <g key={date}>
            {index % 3 === 0 && (
              <text x={x(date)} y="225" textAnchor="middle" fontSize="11">
                {date.slice(5)}
              </text>
            )}
          </g>
        ))}
        {dataset.rows.map((row, index) => {
          if (!row.sessionDate) return null;
          if (!accepted.has(index))
            return (
              <text
                key={row.rowId}
                x={x(row.sessionDate)}
                y="194"
                fill="#b34c48"
                textAnchor="middle"
                fontSize="20"
              >
                ×
              </text>
            );
          const px = x(row.sessionDate),
            top = y(Math.max(row.open!, row.close!)),
            bottom = y(Math.min(row.open!, row.close!));
          const previous = dataset.rows[index - 1];
          const adjacent =
            previous &&
            accepted.has(index - 1) &&
            dates.indexOf(row.sessionDate) - dates.indexOf(previous.sessionDate!) === 1;
          return (
            <g key={row.rowId} data-testid="accepted-candle">
              {adjacent && (
                <line
                  x1={x(previous.sessionDate)}
                  y1={y(previous.close!)}
                  x2={px}
                  y2={y(row.close!)}
                  stroke="#205750"
                  strokeDasharray="3 5"
                  opacity=".35"
                />
              )}
              <line x1={px} y1={y(row.high!)} x2={px} y2={y(row.low!)} stroke="#205750" />
              <rect
                x={px - 6}
                y={top}
                width="12"
                height={Math.max(2, bottom - top)}
                fill="#205750"
              />
            </g>
          );
        })}
        {dataset.quality.coverage.missingSessions.map((row) => (
          <circle
            key={row.sessionDate}
            cx={x(row.sessionDate)}
            cy="192"
            r="5"
            fill="none"
            stroke="#b34c48"
          />
        ))}
        {!valid.length && (
          <text x="380" y="100" textAnchor="middle" fontSize="15">
            No accepted candles for this window
          </text>
        )}
      </svg>
      <figcaption>
        Reported price units: {dataset.quoteUnit.reported ?? "unknown"} · exchange session dates · ×
        quarantined · ○ absent. No line crosses a rejected or known missing slot.
      </figcaption>
    </figure>
  );
}
