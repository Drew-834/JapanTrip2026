import { useState } from "react";
import { useTrip } from "@/context/TripContext";

export function Gate() {
  const { unlock } = useTrip();
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const ok = await unlock(password);
      if (!ok) setErr("That didn’t match. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gate">
      <div className="card">
        <h2>Japan Trip Hub</h2>
        <p className="muted">Enter the trip password to continue.</p>
        <form className="stack" onSubmit={onSubmit} style={{ marginTop: "1rem" }}>
          <input
            type="password"
            autoComplete="off"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {err && <p className="err" style={{ textAlign: "left", margin: 0 }}>{err}</p>}
          <button type="submit" className="btn" disabled={busy || !password.trim()}>
            {busy ? "Checking…" : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}
