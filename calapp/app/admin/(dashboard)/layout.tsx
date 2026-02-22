import Link from "next/link";
import {
  CalendarTodayIcon,
  NotificationsIcon,
  SettingsIcon,
} from "./calendar/CalIcons";
import { NavLinks } from "./NavLinks";

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-[#f8f6f6] dark:bg-[#201214] text-slate-900 dark:text-slate-100 font-['Manrope',_ui-sans-serif,_system-ui]">
      <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/admin/calendar" className="flex items-center gap-2">
              <div className="bg-[#DB5461] text-white p-1.5 rounded-lg flex items-center justify-center">
                <CalendarTodayIcon className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-extrabold tracking-tight text-[#DB5461]">
                StaySync
              </h1>
            </Link>
            <NavLinks />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 pr-4 border-r border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                className="p-2 text-slate-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                aria-label="알림"
              >
                <NotificationsIcon className="w-5 h-5" />
              </button>
              <button
                type="button"
                className="p-2 text-slate-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                aria-label="설정"
              >
                <SettingsIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="flex items-center gap-3 pl-2">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-800 dark:text-zinc-100">
                  관리자님
                </p>
                <p className="text-[10px] text-slate-500">StaySync</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-[#DB5461]/20 flex items-center justify-center overflow-hidden border-2 border-[#DB5461]/10">
                <div className="w-full h-full bg-[#DB5461]/30" />
              </div>
            </div>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
