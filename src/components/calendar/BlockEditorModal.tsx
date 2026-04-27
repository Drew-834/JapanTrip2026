import { Timestamp } from "firebase/firestore";
import { formatJstTime, jstDateTimeToUtc, toTokyoParts } from "@/lib/time";
import { KIND_LABELS, KIND_ORDER } from "@/lib/calendarBlockFactory";
import type { ItineraryBlock, ItineraryBlockKind } from "@/types";

function minutesBetweenStartEnd(start: Date, end: Date): number {
  return Math.max(15, Math.round((end.getTime() - start.getTime()) / 60_000));
}

type Props = {
  block: ItineraryBlock;
  readOnly: boolean;
  onChange: (b: ItineraryBlock) => void;
  onSave: () => void;
  onDelete: () => void;
  onDiscard: () => void;
};

export function BlockEditorModal({
  block,
  readOnly,
  onChange,
  onSave,
  onDelete,
  onDiscard,
}: Props) {
  const durationMin = minutesBetweenStartEnd(block.start.toDate(), block.end.toDate());

  function patchTime(which: "start" | "end", hh: number, mm: number) {
    const src = which === "start" ? block.start.toDate() : block.end.toDate();
    const p = toTokyoParts(src);
    const nd = jstDateTimeToUtc(p.y, p.m, p.day, hh, mm);
    onChange({ ...block, [which]: Timestamp.fromDate(nd) });
  }

  function setDurationMin(next: number) {
    const s = block.start.toDate().getTime();
    const e = s + next * 60_000;
    if (e <= s) return;
    onChange({ ...block, end: Timestamp.fromDate(new Date(e)) });
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onDiscard}>
      <div
        className="modal modal--wide"
        role="dialog"
        aria-modal
        onClick={(e) => e.stopPropagation()}
      >
        <h3>{readOnly ? "Event" : "Edit block"}</h3>
        <div className="stack">
          <label className="muted">Title</label>
          <input
            type="text"
            value={block.title}
            disabled={readOnly}
            onChange={(e) => onChange({ ...block, title: e.target.value })}
          />
          <label className="muted">Type</label>
          <select
            value={block.kind}
            disabled={readOnly}
            onChange={(e) => onChange({ ...block, kind: e.target.value as ItineraryBlockKind })}
          >
            {KIND_ORDER.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
          <label className="muted">City</label>
          <input
            type="text"
            value={block.city}
            disabled={readOnly}
            onChange={(e) => onChange({ ...block, city: e.target.value })}
          />
          <label className="muted">Notes</label>
          <textarea
            value={block.notes}
            disabled={readOnly}
            onChange={(e) => onChange({ ...block, notes: e.target.value })}
          />
          {block.kind === "transit" && (
            <>
              <label className="muted">From station</label>
              <input
                type="text"
                value={block.stationFrom ?? ""}
                disabled={readOnly}
                onChange={(e) => onChange({ ...block, stationFrom: e.target.value })}
              />
              <label className="muted">To station</label>
              <input
                type="text"
                value={block.stationTo ?? ""}
                disabled={readOnly}
                onChange={(e) => onChange({ ...block, stationTo: e.target.value })}
              />
            </>
          )}
          <div className="row" style={{ gap: "0.75rem", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 120px" }}>
              <label className="muted">Start (JST)</label>
              <input
                type="time"
                value={formatJstTime(block.start.toDate())}
                disabled={readOnly}
                onChange={(e) => {
                  const [hh, mm] = e.target.value.split(":").map(Number);
                  patchTime("start", hh, mm);
                }}
              />
            </div>
            <div style={{ flex: "1 1 120px" }}>
              <label className="muted">Duration (min)</label>
              <input
                type="number"
                min={15}
                max={24 * 60}
                step={15}
                value={durationMin}
                disabled={readOnly}
                onChange={(e) => setDurationMin(safeInt(e.target.value, durationMin))}
              />
            </div>
            <div style={{ flex: "1 1 120px" }}>
              <label className="muted">End (JST)</label>
              <input
                type="time"
                value={formatJstTime(block.end.toDate())}
                disabled={readOnly}
                onChange={(e) => {
                  const [hh, mm] = e.target.value.split(":").map(Number);
                  patchTime("end", hh, mm);
                }}
              />
            </div>
          </div>
          <label className="muted">Color</label>
          <input
            type="color"
            value={block.color}
            disabled={readOnly}
            onChange={(e) => onChange({ ...block, color: e.target.value })}
          />
          <div className="row">
            {!readOnly && (
              <button type="button" className="btn danger" onClick={onDelete}>
                Delete
              </button>
            )}
            <button type="button" className="btn secondary" onClick={onDiscard}>
              {readOnly ? "Close" : "Cancel"}
            </button>
            {!readOnly && (
              <button type="button" className="btn" onClick={onSave}>
                Save
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function safeInt(s: string, d: number): number {
  const n = parseInt(s, 10);
  if (!Number.isFinite(n)) return d;
  return Math.max(15, Math.min(24 * 60, n));
}
