import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "./LogoutButton";

export default async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
        <Link href={user ? "/app" : "/"} className="text-lg font-bold text-slate-900">
          Crunch<span className="text-teal-700">Map</span>
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              <span className="hidden max-w-[14rem] truncate text-slate-600 sm:inline">{user.email}</span>
              <LogoutButton />
            </>
          ) : (
            <Link href="/login" className="font-medium text-slate-700 underline-offset-4 hover:underline">
              Log in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
