import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { COOKIE_NAME, verifyJwt } from "@/lib/auth";
import { canApproveUsers } from "@/lib/rbac";
import { SYSTEM_DISPLAY_NAMES, getSystemUrl } from "@/lib/system-urls";
import LogoutButton from "./LogoutButton";

export default async function Dashboard() {
  const token = cookies().get(COOKIE_NAME)?.value;
  const session = token ? await verifyJwt(token) : null;
  if (!session) redirect("/login?next=/dashboard");

  // Don't show a launcher tile for the app the user is currently in.
  const launchable = session.systemsAccess.filter((s) => s !== "crystal_core");

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-crystal-900">Welcome, {session.name}</h1>
            <p className="text-sm text-slate-500">
              Role: <span className="font-medium text-slate-700 capitalize">{session.role}</span>
            </p>
          </div>
          <LogoutButton />
        </header>

        <section className="mt-8 card p-6">
          <h2 className="font-semibold text-slate-800">Your systems</h2>

          {launchable.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              No systems assigned yet. Ask a developer to grant access.
            </p>
          ) : (
            <ul className="mt-3 grid sm:grid-cols-2 gap-3">
              {launchable.map((s) => {
                const url = getSystemUrl(s);
                const label = SYSTEM_DISPLAY_NAMES[s] ?? s;
                if (url) {
                  return (
                    <li key={s}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-md border border-slate-200 px-4 py-3 text-sm
                                   hover:border-crystal-600 hover:bg-crystal-50 transition"
                      >
                        <div className="font-medium text-slate-900">Open {label}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{url}</div>
                      </a>
                    </li>
                  );
                }
                return (
                  <li
                    key={s}
                    className="rounded-md border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-400"
                  >
                    <div className="font-medium">{label}</div>
                    <div className="text-xs mt-0.5">URL not configured</div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {canApproveUsers(session.role) && (
          <section className="mt-6 card p-6 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-800">Developer tools</h2>
              <p className="text-sm text-slate-500">
                Approve pending signups and manage roles.
              </p>
            </div>
            <Link href="/admin/approvals" className="btn-primary">Open approvals</Link>
          </section>
        )}
      </div>
    </main>
  );
}
