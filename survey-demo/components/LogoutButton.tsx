"use client";

import { useAuth } from "@/lib/auth";

export default function LogoutButton({ className = "" }: { className?: string }) {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <button
      onClick={() => logout()}
      className={`text-xs font-medium text-slate-500 hover:text-red-600 transition-colors ${className}`}
      title={`Signed in as ${user.full_name}`}
    >
      {user.full_name} · Logout
    </button>
  );
}
