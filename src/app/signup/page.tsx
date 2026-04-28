"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";

export default function SignupPage() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update<K extends keyof typeof form>(k: K, v: string) {
    setForm({ ...form, [k]: v });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null); setSuccess(null); setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || "Signup failed.");
        return;
      }
      setSuccess(json.data.message);
      setForm({ name: "", email: "", phone: "", password: "" });
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-crystal-900">Create your Crystal Core account</h1>
        <p className="text-sm text-slate-500 mt-1">
          A developer will approve your access and assign your role.
        </p>

        {error   && <div className="alert-error   mt-4">{error}</div>}
        {success && <div className="alert-success mt-4">{success}</div>}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="name">Full name</label>
            <input id="name" required minLength={2} value={form.name}
              onChange={(e) => update("name", e.target.value)} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="email">Work email</label>
            <input id="email" type="email" required value={form.email}
              onChange={(e) => update("email", e.target.value)} className="input" autoComplete="email" />
          </div>
          <div>
            <label className="label" htmlFor="phone">Phone</label>
            <input id="phone" type="tel" value={form.phone}
              onChange={(e) => update("phone", e.target.value)} className="input" autoComplete="tel" />
          </div>
          <div>
            <label className="label" htmlFor="password">Password (min 8 chars)</label>
            <input id="password" type="password" required minLength={8} value={form.password}
              onChange={(e) => update("password", e.target.value)} className="input" autoComplete="new-password" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <div className="mt-6 text-sm text-slate-600 text-center">
          Already registered? <Link href="/login" className="text-crystal-700 hover:underline">Sign in</Link>
        </div>
      </div>
    </main>
  );
}
