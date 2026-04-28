import Link from "next/link";
import { listUsers } from "@/lib/users";
import ApprovalTable from "./ApprovalTable";

// User actions write to the sheet; never serve a stale cache here.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ApprovalsPage() {
  const users = await listUsers();
  // Pending first, then suspended, then everything else — recent first.
  const ordered = [...users].sort((a, b) => {
    const rank: Record<string, number> = { pending: 0, suspended: 1, approved: 2, rejected: 3 };
    const r = (rank[a.accessStatus] ?? 9) - (rank[b.accessStatus] ?? 9);
    if (r !== 0) return r;
    return (b.createdAt || "").localeCompare(a.createdAt || "");
  });

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="max-w-6xl mx-auto">
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-crystal-900">User approvals</h1>
            <p className="text-sm text-slate-500">
              Approve signups, assign roles, and grant system access.
            </p>
          </div>
          <Link href="/dashboard" className="btn-ghost">Back to dashboard</Link>
        </header>

        <ApprovalTable initialUsers={ordered} />
      </div>
    </main>
  );
}
