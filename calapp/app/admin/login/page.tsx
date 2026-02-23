import {
  GridViewIcon,
  VerifiedUserIcon,
  PublicIcon,
} from "./Icons";
import { LoginForm } from "./LoginForm";

export default function AdminLoginPage() {

  return (
    <div className="bg-[#f8f6f6] dark:bg-[#201214] text-[#171212] dark:text-white transition-colors duration-300 min-h-screen font-['Manrope',_ui-sans-serif,_system-ui]">
      <div className="flex min-h-screen w-full flex-col lg:flex-row overflow-hidden">
        {/* Left banner */}
        <div className="relative hidden w-full lg:flex lg:w-3/5 xl:w-[65%] flex-col justify-between p-12 bg-[#DB5461] overflow-hidden">
          <div className="absolute inset-0 z-0 opacity-40">
            <img
              alt="Modern interior"
              className="h-full w-full object-cover mix-blend-multiply"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCbmBvuVsStMW0Cjs9mAqTef6VSALuT1cXngu1Zjzra9BuWweUidR7vyPnFZTucZSz37O7kOtFmWJqxlQ1Y5j7vhlLWj5L_OFlBnj_vwotLzpng8y7B9-oFqtMjxZPUoKvT-tF6MrMcDzi7LY3SEgqY4LSyqbm7fjROg5KqvOfsGiidhwd6RtxCRjdQjIsBdffKruDlkhr-ps4vSd5q_LtUdmmaU4m00C3hC20xKUh9T7oGel9iC9t7GFkw8BMyH_u0kmzQ1D7zjco"
            />
          </div>
          <div className="absolute inset-0 z-10 bg-gradient-to-br from-[#DB5461] via-[#DB5461]/80 to-transparent" />
          <div className="relative z-20 flex items-center gap-3 text-white">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 backdrop-blur-md">
              <GridViewIcon className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">
              StayNamcheon{" "}
              <span className="font-light opacity-80 italic text-sm ml-1">
                Reserve
              </span>
            </h2>
          </div>
          <div className="relative z-20 max-w-xl">
            <h1 className="text-5xl font-extrabold leading-tight text-white mb-6">
              StayNamcheon <br />
              <span className="text-white/80">reservation workflow.</span>
            </h1>
            <p className="text-lg text-white/90 font-medium leading-relaxed">
              Access high-performance tools designed for modern hospitality
              management. Monitor bookings, manage staff roles, and analyze
              performance in real-time.
            </p>
          </div>
          <div className="relative z-20 flex items-center gap-6 text-sm text-white/70">
            <span>© 2024 StayNamcheon Reserve</span>
            <span className="flex items-center gap-1">
              <PublicIcon className="w-3 h-3" />
              Global Network
            </span>
          </div>
        </div>

        {/* Right login form */}
        <div className="flex w-full flex-col items-center justify-center bg-white dark:bg-[#1a0f10] p-6 lg:w-2/5 xl:w-[35%]">
          <div className="w-full max-w-[440px] space-y-8">
            <div className="text-left">
              <div className="lg:hidden mb-8 flex items-center gap-2 text-[#DB5461]">
                <GridViewIcon className="w-8 h-8" />
                <span className="text-xl font-bold tracking-tight">
                  StayNamcheon Reserve
                </span>
              </div>
              <h2 className="text-3xl font-extrabold tracking-tight text-[#171212] dark:text-white">
                Admin Login
              </h2>
              <p className="mt-2 text-[#856669] dark:text-[#b0979a] font-medium">
                Enter your credentials to access the admin portal.
              </p>
            </div>

            <LoginForm />

            <div className="pt-8 mt-8 border-t border-[#f4f1f1] dark:border-[#3d272a]">
              <div className="flex items-start gap-3 rounded-xl bg-[#f8f6f6] dark:bg-[#201214] p-4">
                <div className="text-[#DB5461] mt-0.5">
                  <VerifiedUserIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-[#171212] dark:text-white">
                    Secure Connection
                  </p>
                  <p className="text-xs text-[#856669] dark:text-[#b0979a] leading-relaxed mt-1">
                    You are accessing a restricted area. All activities are
                    monitored. Ensure your credentials are kept private.
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 text-center">
              <p className="text-[10px] text-[#3F88C5]/20 uppercase tracking-widest">
                StayNamcheon Administration Portal
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

