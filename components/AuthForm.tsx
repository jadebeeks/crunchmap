"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const CONFIRMATION_MESSAGE =
  "Your account was created, but this Supabase project requires email confirmation. Check your inbox and confirm, or ask the app owner to turn off “Confirm email” in Supabase (Authentication → Sign In / Providers → Email).";

export default function AuthForm({ mode }: { mode: "signup" | "login" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isSignup = mode === "signup";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();

    if (isSignup) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else if (!data.session) {
        setError(CONFIRMATION_MESSAGE);
      } else {
        window.location.assign("/app");
        return;
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(/email not confirmed/i.test(error.message) ? CONFIRMATION_MESSAGE : error.message);
      } else {
        window.location.assign("/app");
        return;
      }
    }
    setBusy(false);
  }

  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-bold text-slate-900">{isSignup ? "Create your account" : "Log in"}</h1>
      <p className="mt-1 text-slate-700">
        {isSignup ? "Free. Email and password, no confirmation step." : "Welcome back."}
      </p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-800">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid={`${mode}-email`}
            aria-describedby={isSignup ? "email-help" : undefined}
            className="mt-1 w-full rounded-md border border-slate-400 px-3 py-2 text-slate-900"
          />
          {isSignup && (
            <p id="email-help" className="mt-1 text-xs text-slate-600">
              Any email works — your IE email is fine.
            </p>
          )}
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-800">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            data-testid={`${mode}-password`}
            aria-describedby={isSignup ? "password-help" : undefined}
            className="mt-1 w-full rounded-md border border-slate-400 px-3 py-2 text-slate-900"
          />
          {isSignup && (
            <p id="password-help" className="mt-1 text-xs text-slate-600">
              At least 6 characters.
            </p>
          )}
        </div>
        {error && (
          <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy}
          data-testid={`${mode}-submit`}
          className="w-full rounded-md bg-teal-700 px-4 py-2.5 font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {busy ? "Please wait…" : isSignup ? "Sign up" : "Log in"}
        </button>
      </form>
      <p className="mt-4 text-sm text-slate-700">
        {isSignup ? "Already have an account? " : "New here? "}
        <Link href={isSignup ? "/login" : "/signup"} className="font-medium text-teal-800 underline">
          {isSignup ? "Log in" : "Sign up"}
        </Link>
      </p>
    </main>
  );
}
