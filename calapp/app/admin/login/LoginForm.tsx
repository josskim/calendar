"use client";

import { EmailIcon } from "./Icons";
import { PasswordField } from "./PasswordField";

export function LoginForm() {
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const adminId = formData.get("adminId") as string;
    const password = formData.get("password") as string;

    if (adminId === "stay" && password === "hare4828") {
      window.location.href = "/admin/calendar";
    } else {
      // No specific redirect target provided for failed login,
      // so removing the alert as per instruction.
      // A redirect to the login page with an error state could be added here.
      // e.g., window.location.href = "/login?error=true";
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label
          htmlFor="adminId"
          className="text-sm font-bold text-[#171212] dark:text-white"
        >
          Admin id
        </label>
        <div className="relative">
          <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-[#856669] dark:text-[#856669]">
            <EmailIcon className="w-5 h-5" />
          </span>
          <input
            className="block w-full rounded-lg border border-[#e4dcdd] dark:border-[#3d272a] bg-white dark:bg-[#26181a] py-4 pl-12 pr-4 text-[#171212] dark:text-white placeholder:text-[#856669]/60 focus:border-[#DB5461] focus:ring-2 focus:ring-[#DB5461]/20 outline-none transition-all duration-200"
            id="adminId"
            name="adminId"
            placeholder="Enter Admin ID"
            required
            type="text"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="password"
          className="text-sm font-bold text-[#171212] dark:text-white"
        >
          Password
        </label>
        <PasswordField />
      </div>

      <button
        type="submit"
        className="w-full rounded-lg bg-[#DB5461] py-4 text-sm font-bold text-white shadow-lg shadow-[#DB5461]/20 transition-all hover:bg-[#c44b57] active:scale-[0.98]"
      >
        Sign In to Reservation System...
      </button>
    </form>
  );
}
