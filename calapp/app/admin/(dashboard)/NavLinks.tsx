"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLinksProps = {
  compact?: boolean;
};

export function NavLinks({ compact = false }: NavLinksProps) {
  const pathname = usePathname();

  const navItems = [
    { name: "예약캘린더", href: "/admin/calendar" },
    { name: "예약리스트", href: "/admin/reservations" },
    { name: "년도별매출", href: "/admin/sales" },
    { name: "년도별비교매출", href: "/admin/sales/comparison" },
    { name: "공휴일관리", href: "/admin/holidays" },
  ];

  return (
    <nav
      className={
        compact
          ? "flex items-center gap-0.5 flex-1 min-w-0"
          : "flex items-center gap-1 w-full md:w-auto md:ml-4"
      }
    >
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${
              compact
                ? "flex-1 min-w-0 px-1.5 py-1 rounded-md font-bold text-[10px] text-center whitespace-nowrap"
                : "flex-1 md:flex-none px-2 py-1.5 md:px-4 md:py-2 rounded-lg font-bold text-[11px] md:text-sm text-center whitespace-nowrap"
            } transition-colors ${
              isActive
                ? "bg-[#DB5461]/10 text-[#DB5461]"
                : "text-slate-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            {item.name}
          </Link>
        );
      })}
    </nav>
  );
}
