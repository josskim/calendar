"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks() {
    const pathname = usePathname();

    const navItems = [
        { name: "예약캘린더", href: "/admin/calendar" },
        { name: "예약리스트", href: "/admin/reservations" },
        { name: "년도별매출", href: "/admin/sales" },
    ];

    return (
        <nav className="hidden md:flex items-center gap-1 ml-4">
            {navItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`px-4 py-2 rounded-lg font-bold text-sm transition-colors ${isActive
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
