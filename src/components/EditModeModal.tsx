import { useState } from "react";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  onConfirm: (password: string) => boolean;
};

export function EditModeModal({ open, title, onClose, onConfirm }: Props) {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const ok = onConfirm(password);
    if (!ok) {
      setErr("Wrong password.");
      return;
    }
    setPassword("");
    onClose();
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-mode-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="edit-mode-title">{title}</h3>
        <p className="muted">Enter the trip password to edit.</p>
        <form className="stack" onSubmit={submit} style={{ marginTop: "0.75rem" }}>
          <input
            type="password"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {err && <p className="err" style={{ textAlign: "left", margin: 0 }}>{err}</p>}
          <div className="row">
            <button type="button" className="btn secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn">
              Unlock editing
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
