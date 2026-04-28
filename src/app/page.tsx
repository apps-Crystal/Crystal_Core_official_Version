import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="card max-w-xl w-full p-8 text-center">
        <h1 className="text-3xl font-bold text-crystal-900">Crystal Core</h1>
        <p className="mt-3 text-slate-600">
          Single sign-on and access control for the Crystal Group system family
          — Procurement, Warehouse Management, and more.
        </p>
        <div className="mt-6 flex gap-3 justify-center">
          <Link href="/login" className="btn-primary">Log in</Link>
          <Link href="/signup" className="btn-ghost">Create account</Link>
        </div>
      </div>
    </main>
  );
}
