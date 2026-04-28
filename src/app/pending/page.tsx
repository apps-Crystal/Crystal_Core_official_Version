import Link from "next/link";

export default function PendingPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="card max-w-md w-full p-8 text-center">
        <h1 className="text-xl font-semibold text-crystal-900">Awaiting approval</h1>
        <p className="mt-2 text-sm text-slate-600">
          Your Crystal Core account has been created, but a developer needs to
          approve your access and assign your role before you can sign in.
          You&rsquo;ll be notified once approved.
        </p>
        <Link href="/login" className="btn-ghost mt-6 inline-block">Back to sign in</Link>
      </div>
    </main>
  );
}
