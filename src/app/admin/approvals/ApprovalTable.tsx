"use client";

import { useMemo, useState } from "react";
import { ROLES, SYSTEMS, type Role, type SystemCode, type User } from "@/lib/types";
import { DEFAULT_SYSTEMS_BY_ROLE } from "@/lib/rbac";

interface Props {
  initialUsers: User[];
}

const STATUS_BADGE: Record<User["accessStatus"], string> = {
  pending:   "bg-amber-100 text-amber-800",
  approved:  "bg-emerald-100 text-emerald-800",
  rejected:  "bg-red-100 text-red-800",
  suspended: "bg-slate-200 text-slate-700",
};

export default function ApprovalTable({ initialUsers }: Props) {
  const [users, setUsers] = useState(initialUsers);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const visible = useMemo(
    () => (filter === "pending" ? users.filter((u) => u.accessStatus === "pending") : users),
    [users, filter],
  );

  async function patch(userId: string, body: Record<string, unknown>) {
    setBusyId(userId);
    setToast(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setToast({ kind: "err", msg: json.error || "Update failed." });
        return;
      }
      setUsers((prev) => prev.map((u) => (u.userId === userId ? json.data.user : u)));
      setToast({ kind: "ok", msg: "Saved." });
    } catch {
      setToast({ kind: "err", msg: "Network error." });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter("pending")}
          className={`btn ${filter === "pending" ? "bg-crystal-600 text-white" : "bg-white border border-slate-300 text-slate-700"}`}
        >
          Pending only
        </button>
        <button
          onClick={() => setFilter("all")}
          className={`btn ${filter === "all" ? "bg-crystal-600 text-white" : "bg-white border border-slate-300 text-slate-700"}`}
        >
          All users
        </button>
        <span className="ml-auto text-sm text-slate-500">{visible.length} shown</span>
      </div>

      {toast && (
        <div className={toast.kind === "ok" ? "alert-success" : "alert-error"}>{toast.msg}</div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-left">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Systems</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((u) => (
              <Row
                key={u.userId}
                user={u}
                busy={busyId === u.userId}
                onPatch={(body) => patch(u.userId, body)}
              />
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                  Nothing here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({
  user,
  busy,
  onPatch,
}: {
  user: User;
  busy: boolean;
  onPatch: (body: Record<string, unknown>) => void;
}) {
  // Local draft state so the dev can pick role + systems before approving.
  const [role, setRole] = useState<Role>(user.role ?? "manager");
  const [systems, setSystems] = useState<SystemCode[]>(
    user.systemsAccess.length ? user.systemsAccess : DEFAULT_SYSTEMS_BY_ROLE[user.role ?? "manager"],
  );

  function toggleSystem(code: SystemCode) {
    setSystems((prev) => (prev.includes(code) ? prev.filter((s) => s !== code) : [...prev, code]));
  }

  function changeRole(next: Role) {
    setRole(next);
    // Re-seed systems with the new role's defaults if the dev hasn't customised yet.
    if (user.systemsAccess.length === 0) setSystems(DEFAULT_SYSTEMS_BY_ROLE[next]);
  }

  const canApprove = user.accessStatus !== "approved";
  const canReject  = user.accessStatus !== "rejected";

  return (
    <tr className="border-t border-slate-100 align-top">
      <td className="px-4 py-3">
        <div className="font-medium text-slate-900">{user.name}</div>
        <div className="text-slate-500">{user.email}</div>
        {user.phone && <div className="text-xs text-slate-400">{user.phone}</div>}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_BADGE[user.accessStatus]}`}>
          {user.accessStatus}
        </span>
      </td>
      <td className="px-4 py-3">
        <select
          value={role}
          onChange={(e) => changeRole(e.target.value as Role)}
          className="input py-1"
          disabled={busy}
        >
          {ROLES.map((r) => (
            <option key={r} value={r} className="capitalize">{r}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          {SYSTEMS.map((s) => {
            const on = systems.includes(s);
            return (
              <button
                key={s}
                type="button"
                disabled={busy}
                onClick={() => toggleSystem(s)}
                className={`text-xs rounded-full px-2 py-1 border ${
                  on
                    ? "bg-crystal-600 text-white border-crystal-600"
                    : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
                }`}
              >
                {s.replace(/_/g, " ")}
              </button>
            );
          })}
        </div>
      </td>
      <td className="px-4 py-3 text-right whitespace-nowrap">
        <div className="inline-flex gap-2">
          {canApprove && (
            <button
              disabled={busy}
              onClick={() => onPatch({ decision: "approve", role, systemsAccess: systems })}
              className="btn bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Approve
            </button>
          )}
          {user.accessStatus === "approved" && (
            <button
              disabled={busy}
              onClick={() => onPatch({ role, systemsAccess: systems })}
              className="btn-ghost"
            >
              Save changes
            </button>
          )}
          {canReject && user.accessStatus !== "approved" && (
            <button
              disabled={busy}
              onClick={() => onPatch({ decision: "reject" })}
              className="btn bg-red-600 text-white hover:bg-red-700"
            >
              Reject
            </button>
          )}
          {user.accessStatus === "approved" && (
            <button
              disabled={busy}
              onClick={() => onPatch({ decision: "suspend" })}
              className="btn bg-slate-600 text-white hover:bg-slate-700"
            >
              Suspend
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
