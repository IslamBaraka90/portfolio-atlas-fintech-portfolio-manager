import type { InvestorFlow, MoneyWeighted } from "@portfolio-atlas/contracts";
import { BookDecimal as D } from "../accounting/decimal.js";
export function moneyWeighted(flows: InvestorFlow[], start: string, end: string): MoneyWeighted {
  const result: MoneyWeighted = {
    status: "unavailable",
    periodReturn: null,
    annualizedReturn: null,
    roots: [],
    signChanges: 0,
    iterations: 0,
    residual: null,
    reason: "Positive elapsed time and bounded investor cash flows are required.",
    bounds: [-0.999999, 1000],
  };
  const duration = Date.parse(end) - Date.parse(start);
  if (
    duration <= 0 ||
    flows.some(
      (f) =>
        !new D(f.amount).isFinite() ||
        new D(f.amount).abs().gt(1e9) ||
        Date.parse(f.at) < Date.parse(start) ||
        Date.parse(f.at) > Date.parse(end),
    )
  )
    return result;
  const groups = new Map<number, InstanceType<typeof D>>();
  for (const f of flows) {
    const t = (Date.parse(f.at) - Date.parse(start)) / duration;
    groups.set(t, (groups.get(t) ?? new D(0)).plus(f.amount));
  }
  const rows = Array.from(groups, ([t, amount]) => ({ t, amount: amount.toNumber() }))
    .filter((r) => r.amount !== 0)
    .sort((a, b) => a.t - b.t);
  if (rows.length < 2) {
    result.reason = "Fewer than two nonzero dated investor flows; no identifiable return.";
    return result;
  }
  result.signChanges = rows
    .slice(1)
    .filter((r, i) => Math.sign(r.amount) !== Math.sign(rows[i]!.amount)).length;
  const npv = (x: number) => rows.reduce((sum, r) => sum + r.amount * Math.exp(-x * r.t), 0);
  const low = Math.log1p(result.bounds[0]),
    high = Math.log1p(result.bounds[1]),
    scale = Math.max(...rows.map((r) => Math.abs(r.amount))),
    tolerance = scale * 1e-12;
  const roots: number[] = [];
  function remember(x: number) {
    const r = Math.expm1(x);
    if (!roots.some((old) => Math.abs(old - r) < 1e-7)) roots.push(r);
  }
  let previousX = low,
    previous = npv(low);
  for (let i = 1; i <= 2048; i++) {
    const x = low + ((high - low) * i) / 2048,
      value = npv(x);
    result.iterations++;
    if (Math.abs(previous) <= tolerance) remember(previousX);
    if (Math.sign(previous) !== Math.sign(value)) {
      let a = previousX,
        b = x,
        fa = previous;
      for (let j = 0; j < 100; j++) {
        const middle = (a + b) / 2,
          fm = npv(middle);
        result.iterations++;
        if (Math.abs(fm) <= tolerance || b - a < 1e-13) {
          a = middle;
          b = middle;
          break;
        }
        if (Math.sign(fa) !== Math.sign(fm)) b = middle;
        else {
          a = middle;
          fa = fm;
        }
      }
      remember((a + b) / 2);
    }
    previousX = x;
    previous = value;
  }
  if (Math.abs(previous) <= tolerance) remember(high);
  result.roots = roots.sort((a, b) => a - b);
  if (result.signChanges > 1) {
    result.status = "ambiguous";
    result.reason =
      "Nonconventional signs can have multiple or tangent roots. The bounded scan is not proof of uniqueness; no headline rate is selected.";
    return result;
  }
  if (roots.length !== 1) {
    result.status = "no_root";
    result.reason =
      "No unique root found within the declared period-rate bounds; no extrapolated rate.";
    return result;
  }
  result.status = "solved";
  result.periodReturn = roots[0]!;
  result.residual = npv(Math.log1p(roots[0]!));
  result.reason = "One sign change and a bracketed root; actual-time period money-weighted return.";
  const years = duration / (365 * 86400000);
  if (years >= 1) {
    const annual = Math.expm1(Math.log1p(roots[0]!) / years);
    if (Number.isFinite(annual)) result.annualizedReturn = annual;
  }
  return result;
}
