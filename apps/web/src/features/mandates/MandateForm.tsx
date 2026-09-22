import { useEffect, useState } from "react";
import type { MandateInput } from "@portfolio-atlas/contracts";

interface Props {
  value: MandateInput;
  onChange: (value: MandateInput) => void;
  saved: boolean;
  currencyLocked: boolean;
}
export function MandateForm({ value, onChange, saved, currencyLocked }: Props) {
  const [restrictedText, setRestrictedText] = useState(value.restrictedInstrumentIds.join(", "));
  useEffect(
    () => setRestrictedText(value.restrictedInstrumentIds.join(", ")),
    [value.restrictedInstrumentIds],
  );
  function set<K extends keyof MandateInput>(key: K, item: MandateInput[K]) {
    onChange({ ...value, [key]: item });
  }
  const limits = [
    ["minCashWeight", "Cash minimum"],
    ["maxCashWeight", "Cash maximum"],
    ["maxPositionWeight", "Position cap"],
    ["maxSectorWeight", "Sector cap"],
  ] as const;
  return (
    <>
      <label>
        Mandate name
        <input
          name="mandateName"
          required
          minLength={3}
          maxLength={80}
          value={value.name}
          onChange={(event) => set("name", event.target.value)}
        />
      </label>
      <label>
        Objective
        <textarea
          required
          minLength={3}
          maxLength={240}
          rows={2}
          value={value.objective}
          onChange={(event) => set("objective", event.target.value)}
        />
      </label>
      <div className="field-pair">
        <label>
          Base currency
          <select
            value={value.baseCurrency}
            disabled={currencyLocked}
            onChange={(event) =>
              set("baseCurrency", event.target.value as MandateInput["baseCurrency"])
            }
          >
            {["USD", "EUR", "GBP", "EGP", "SAR"].map((currency) => (
              <option key={currency}>{currency}</option>
            ))}
          </select>
        </label>
        <label>
          Horizon · years
          <input
            type="number"
            min={1}
            max={50}
            step={1}
            required
            value={value.horizonYears || ""}
            onChange={(event) => set("horizonYears", event.target.valueAsNumber || 0)}
          />
        </label>
      </div>
      {currencyLocked && (
        <p className="field-hint">Currency is fixed once a portfolio uses this mandate.</p>
      )}
      <div className="form-divider">
        <span>Allocation rules</span>
        <span>Inclusive limits</span>
      </div>
      <div className="field-pair">
        {limits.map(([key, label]) => (
          <label key={key}>
            {label}
            <span className="number-field">
              <input
                aria-label={label}
                type="number"
                min={0}
                max={100}
                step={0.01}
                required
                value={Number.isFinite(value[key]) ? Number((value[key] * 100).toFixed(2)) : ""}
                onChange={(event) => set(key, Math.round(event.target.valueAsNumber * 100) / 10000)}
              />
              <span>%</span>
            </span>
          </label>
        ))}
      </div>
      <div className="field-label" id="asset-types-label">
        Allowed asset types
      </div>
      <div className="checkbox-row" role="group" aria-labelledby="asset-types-label">
        {(["equity", "etf"] as const).map((type) => (
          <label key={type}>
            <input
              type="checkbox"
              checked={value.allowedAssetTypes.includes(type)}
              onChange={(event) =>
                set(
                  "allowedAssetTypes",
                  event.target.checked
                    ? [...value.allowedAssetTypes, type]
                    : value.allowedAssetTypes.filter((item) => item !== type),
                )
              }
            />
            {type === "equity" ? "Equities" : "ETFs"}
          </label>
        ))}
      </div>
      <label>
        Restricted instrument IDs
        <input
          value={restrictedText}
          onChange={(event) => setRestrictedText(event.target.value)}
          onBlur={() =>
            set(
              "restrictedInstrumentIds",
              restrictedText
                .split(",")
                .map((id) => id.trim())
                .filter(Boolean),
            )
          }
          aria-describedby="restricted-help"
        />
      </label>
      <p className="field-hint" id="restricted-help">
        Separate IDs with commas. These are synthetic teaching IDs.
      </p>
      <button className="button primary wide" type="submit">
        {saved ? "Save mandate revision" : "Create learning portfolio"}
        <span aria-hidden="true">↗</span>
      </button>
      <p className="field-hint">
        Drafts may contain conflicting rules. The evaluation explains them.
      </p>
    </>
  );
}
