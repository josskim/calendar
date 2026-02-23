"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const AUTH_KEY = "staysync_admin_auth";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (pathname === "/admin/login") {
      setAuthed(true);
      setReady(true);
      return;
    }

    const token = window.localStorage.getItem(AUTH_KEY);
    if (!token) {
      router.replace("/admin/login");
      setAuthed(false);
      setReady(true);
      return;
    }

    setAuthed(true);
    setReady(true);
  }, [pathname, router]);

  if (!ready) {
    return null;
  }

  if (!authed) {
    return null;
  }

  return <>{children}</>;
}

export function setAdminAuthToken(value: string) {
  window.localStorage.setItem(AUTH_KEY, value);
}

export function getAdminAuthToken() {
  return window.localStorage.getItem(AUTH_KEY);
}

export function clearAdminAuthToken() {
  window.localStorage.removeItem(AUTH_KEY);
}
