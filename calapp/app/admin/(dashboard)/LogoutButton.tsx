"use client";
import { useRouter } from "next/navigation";
import { clearAdminAuthToken } from "../auth-client";

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = () => {
    if (confirm("로그아웃 하시겠습니까?")) {
      clearAdminAuthToken();
      router.replace("/admin/login");
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="text-[10px] md:text-sm font-bold text-slate-500 hover:text-red-500 transition-colors px-2 py-1 border border-slate-200 dark:border-zinc-800 rounded-md hover:border-red-500"
    >
      로그아웃
    </button>
  );
}
