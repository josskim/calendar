"use client";

import { useState } from "react";
import { LockIcon, VisibilityIcon, VisibilityOffIcon } from "./Icons";

export function PasswordField() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative">
      <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-[#856669] dark:text-[#856669]">
        <LockIcon className="w-5 h-5" />
      </span>
      <input
        className="block w-full rounded-lg border border-[#e4dcdd] dark:border-[#3d272a] bg-white dark:bg-[#26181a] py-4 pl-12 pr-12 text-[#171212] dark:text-white placeholder:text-[#856669]/60 focus:border-[#DB5461] focus:ring-2 focus:ring-[#DB5461]/20 outline-none transition-all duration-200"
        id="password"
        name="password"
        placeholder="••••••••"
        required
        type={showPassword ? "text" : "password"}
      />
      <button
        className="absolute inset-y-0 right-0 flex items-center pr-4 text-[#856669] hover:text-[#DB5461] transition-colors duration-200"
        type="button"
        onClick={() => setShowPassword((v) => !v)}
        aria-label={showPassword ? "Hide password" : "Show password"}
      >
        {showPassword ? (
          <VisibilityOffIcon className="w-5 h-5" />
        ) : (
          <VisibilityIcon className="w-5 h-5" />
        )}
      </button>
    </div>
  );
}

