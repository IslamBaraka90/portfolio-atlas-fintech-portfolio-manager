import type { CandidateAllocation, Lesson } from "@portfolio-atlas/contracts";

interface Props {
  value: CandidateAllocation;
  scenarios: Lesson["scenarios"];
  onChange: (value: CandidateAllocation) => void;
}
export function AllocationEditor({ value, scenarios, onChange }: Props) {
  const total = value.cashWeight + value.positions.reduce((sum, item) => sum + item.weight, 0);
  function position(index: number, patch: Partial<CandidateAllocation["positions"][number]>) {
    onChange({
      ...value,
      positions: value.positions.map((item, at) => (at === index ? { ...item, ...patch } : item)),
    });
  }
  return (
    <>
      <div className="scenario-row" aria-label="Learning scenarios">
        {scenarios.map((scenario) => (
          <button
            key={scenario.id}
            type="button"
            className="chip"
            onClick={() => onChange(structuredClone(scenario.allocation))}
          >
            {scenario.label}
          </button>
        ))}
      </div>
      <div className="allocation-caption">
        <span>TRY A SCENARIO, THEN CHANGE ONE INPUT</span>
        <span>All values in %</span>
      </div>
      <div className="holdings">
        {value.positions.map((item, index) => (
          <div className="holding" key={index}>
            <div className={"asset-mark mark-" + (index % 3)} aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </div>
            <div className="holding-identity">
              <label className="sr-only" htmlFor={"name-" + index}>
                Holding {index + 1} name
              </label>
              <input
                id={"name-" + index}
                className="plain-input"
                required
                minLength={3}
                maxLength={80}
                value={item.name}
                onChange={(event) => position(index, { name: event.target.value })}
              />
              <label className="sr-only" htmlFor={"id-" + index}>
                Holding {index + 1} ID
              </label>
              <input
                id={"id-" + index}
                className="plain-input instrument-id"
                required
                pattern="[A-Za-z0-9_-]+"
                maxLength={80}
                value={item.instrumentId}
                onChange={(event) => position(index, { instrumentId: event.target.value })}
              />
            </div>
            <label className="compact-label">
              Type
              <select
                aria-label={"Holding " + (index + 1) + " type"}
                value={item.assetType}
                onChange={(event) =>
                  position(index, { assetType: event.target.value as "equity" | "etf" })
                }
              >
                <option value="equity">Equity</option>
                <option value="etf">ETF</option>
              </select>
            </label>
            <label className="compact-label sector-field">
              Sector
              <input
                aria-label={"Holding " + (index + 1) + " sector"}
                placeholder="Unknown"
                maxLength={60}
                value={item.sector ?? ""}
                onChange={(event) => position(index, { sector: event.target.value || null })}
              />
            </label>
            <label className="compact-label weight-field">
              Weight
              <span className="number-field">
                <input
                  aria-label={"Holding " + (index + 1) + " weight"}
                  type="number"
                  required
                  min={0}
                  max={100}
                  step={0.01}
                  value={Number.isFinite(item.weight) ? Number((item.weight * 100).toFixed(2)) : ""}
                  onChange={(event) =>
                    position(index, {
                      weight: Math.round(event.target.valueAsNumber * 100) / 10000,
                    })
                  }
                />
                <span>%</span>
              </span>
            </label>
            <button
              className="remove-button"
              type="button"
              aria-label={"Remove holding " + (index + 1)}
              onClick={() =>
                onChange({ ...value, positions: value.positions.filter((_, at) => at !== index) })
              }
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="cash-row">
        <span className="cash-symbol" aria-hidden="true">
          ◎
        </span>
        <div>
          <strong>Cash reserve</strong>
          <small>Uninvested allocation</small>
        </div>
        <label className="number-field">
          <span className="sr-only">Cash weight</span>
          <input
            type="number"
            required
            min={0}
            max={100}
            step={0.01}
            value={
              Number.isFinite(value.cashWeight) ? Number((value.cashWeight * 100).toFixed(2)) : ""
            }
            onChange={(event) =>
              onChange({
                ...value,
                cashWeight: Math.round(event.target.valueAsNumber * 100) / 10000,
              })
            }
          />
          <span>%</span>
        </label>
      </div>
      <div className="allocation-footer">
        <button
          className="text-button"
          type="button"
          disabled={value.positions.length >= 100}
          onClick={() =>
            onChange({
              ...value,
              positions: [
                ...value.positions,
                {
                  instrumentId: "DEMO-" + crypto.randomUUID().slice(0, 8),
                  name: "New teaching holding",
                  assetType: "equity",
                  sector: null,
                  weight: 0,
                },
              ],
            })
          }
        >
          + Add a holding
        </button>
        <span>
          Total allocation{" "}
          <strong className={Math.round(total * 10000) === 10000 ? "" : "text-danger"}>
            {Number((total * 100).toFixed(2))}%
          </strong>
        </span>
      </div>
      <p className="field-hint">
        Sector labels are supplied for this exercise. ETF sectors do not represent underlying
        holdings. Empty sector = unknown.
      </p>
    </>
  );
}
