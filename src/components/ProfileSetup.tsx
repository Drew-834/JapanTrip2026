import { useState } from "react";
import { useTrip } from "@/context/TripContext";

const PRESETS = ["#c45c48", "#2d7d46", "#2563eb", "#7c3aed", "#ca8a04", "#0d9488", "#db2777"];

export function ProfileSetup() {
  const { accentColor, saveProfileToFirestore } = useTrip();
  const [name, setName] = useState("");
  const [color, setColor] = useState(accentColor);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErr("Add your name so friends know it’s you.");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      await saveProfileToFirestore(name.trim(), color);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gate">
      <div className="card">
        <h2>Your profile</h2>
        <p className="muted">This name shows on posts, comments, and calendar.</p>
        <form className="stack" onSubmit={onSubmit} style={{ marginTop: "1rem" }}>
          <label className="muted" htmlFor="dn">
            Display name
          </label>
          <input
            id="dn"
            type="text"
            autoComplete="nickname"
            placeholder="e.g. Alex"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <span className="muted">Accent color</span>
          <div className="row">
            {PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                className="btn secondary"
                style={{
                  padding: "0.35rem",
                  background: c,
                  border: color === c ? "2px solid #0f172a" : "none",
                  minWidth: "2rem",
                }}
                aria-label={`Pick ${c}`}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
          {err && <p className="err" style={{ textAlign: "left", margin: 0 }}>{err}</p>}
          <button type="submit" className="btn" disabled={busy}>
            {busy ? "Saving…" : "Save and enter"}
          </button>
        </form>
      </div>
    </div>
  );
}
