import type { CityEntry, DayCitySplit } from "@/types";

type Props = {
  dayStr: string;
  open: boolean;
  cities: CityEntry[];
  value: DayCitySplit;
  onChange: (v: DayCitySplit) => void;
  onClose: () => void;
  onSave: () => void;
};

export function DaySplitDialog({
  dayStr,
  open,
  cities,
  value,
  onChange,
  onClose,
  onSave,
}: Props) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Day in two cities (optional)</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          {dayStr} — set <strong>morning</strong> and <strong>evening</strong> to tint the day column. Leave
          as “(auto)” to infer from your events.
        </p>
        <div className="stack">
          <label className="muted">Morning (before ~2 p.m.)</label>
          <select
            value={value.morningCityId === null ? "" : value.morningCityId}
            onChange={(e) =>
              onChange({ ...value, morningCityId: e.target.value === "" ? null : e.target.value })
            }
          >
            <option value="">(auto from events)</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <label className="muted">Evening (after ~2 p.m.)</label>
          <select
            value={value.eveningCityId === null ? "" : value.eveningCityId}
            onChange={(e) =>
              onChange({ ...value, eveningCityId: e.target.value === "" ? null : e.target.value })
            }
          >
            <option value="">(auto from events)</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="row">
            <button type="button" className="btn secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn" onClick={onSave}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
