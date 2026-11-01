import { useEffect, useState, type FormEvent } from "react";
import { Activity, UserPlus } from "lucide-react";

type OperatorUser = { id: string; username: string; full_name: string; role: string; created_at: string };
type AuditEntry = { operator_name: string; action: string; entity_type: string; entity_id: string; detail: string; created_at: string };

export function OperatorGovernance({ isOwner }: { isOwner: boolean }) {
  const [operators, setOperators] = useState<OperatorUser[]>([]);
  const [events, setEvents] = useState<AuditEntry[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setError("");
    const auditResponse = await fetch("/api/operator/audit");
    const audit = await auditResponse.json().catch(() => ({}));
    if (!auditResponse.ok) throw new Error(audit.detail || "Could not load the operations history.");
    setEvents(audit.events || []);
    if (isOwner) {
      const usersResponse = await fetch("/api/operator/users");
      const users = await usersResponse.json().catch(() => ({}));
      if (!usersResponse.ok) throw new Error(users.detail || "Could not load operator accounts.");
      setOperators(users.operators || []);
    }
  }

  useEffect(() => { refresh().catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load operations history.")); }, [isOwner]);

  async function createOperator(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/operator/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ full_name: String(form.get("full_name")), username: String(form.get("username")), password: String(form.get("password")) }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not create operator account.");
      formElement.reset(); setNotice("Operator account created."); await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not create operator account."); }
    setBusy(false);
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/operator/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current_password: String(form.get("current_password")), new_password: String(form.get("new_password")) }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not change the password.");
      formElement.reset(); setNotice("Password updated. Other active sessions for your account were signed out."); await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not change the password."); }
    setBusy(false);
  }

  return <section className="phase-six-governance panel">
    <div className="operator-queue-heading"><div><span className="eyebrow">Phase 6 · Accountable operations</span><h2>Operations history <small>{events.length}</small></h2></div><span className="status-pill status-moving"><Activity size={12} /> Attributed actions</span></div>
    {error && <div className="operator-error" role="alert">{error}</div>}{notice && <div className="phase-five-notice">{notice}</div>}
    <form className="phase-six-password" onSubmit={changePassword}><div><b>Change your password</b><small>Changing it revokes your other active sessions.</small></div><label>Current password<input name="current_password" type="password" required autoComplete="current-password" /></label><label>New password<input name="new_password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label><button className="subtle-button" type="submit" disabled={busy}>Update password</button></form>
    {isOwner && <div className="phase-six-users"><div><h3>Operator accounts <small>{operators.length}</small></h3><p>Named accounts make each review and handling update attributable.</p></div><div className="phase-six-user-list">{operators.map((user) => <article key={user.id}><span><b>{user.full_name}</b><small>@{user.username} · {user.role}</small></span><small>{new Date(user.created_at).toLocaleDateString("en-IN")}</small></article>)}</div><form className="phase-six-add-operator" onSubmit={createOperator}><label>Operator name<input name="full_name" required minLength={2} maxLength={80} /></label><label>Username<input name="username" required minLength={3} maxLength={32} pattern="[a-zA-Z0-9_.-]{3,32}" /></label><label>Temporary password<input name="password" required type="password" minLength={12} maxLength={128} autoComplete="new-password" /></label><button className="button button-dark" type="submit" disabled={busy}><UserPlus size={14} /> {busy ? "Creating…" : "Add operator"}</button></form><p className="phase-six-note">Share temporary credentials directly with the operator; they should change them through the local account administration process before broader use. Password change and account suspension are not available yet.</p></div>}
    <div className="phase-six-audit-list">{events.length ? events.map((item, index) => <article key={`${item.created_at}-${index}`}><span className="phase-six-audit-dot" /><div><b>{item.action.replace(/_/g, " ")}</b><small>{item.operator_name} · {item.entity_type} {item.entity_id} · {new Date(item.created_at).toLocaleString("en-IN")}</small><p>{item.detail}</p></div></article>) : <div className="passport-empty">Operator decisions and handling changes will appear here.</div>}</div>
    <p className="phase-six-note">This is an application-level history in the local database. It is not tamper-proof, externally backed up, or a substitute for a production audit service.</p>
  </section>;
}

