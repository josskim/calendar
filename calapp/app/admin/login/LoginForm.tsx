"use client";

import { useEffect, useState } from "react";
import { getAdminAuthToken, setAdminAuthToken } from "../auth-client";
import { EmailIcon } from "./Icons";
import { PasswordField } from "./PasswordField";

export function LoginForm() {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const token = getAdminAuthToken();
    if (token) {
      window.location.replace("/admin/calendar");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const adminId = formData.get("adminId") as string;
    formData.delete("adminId");
    formData.set("username", adminId);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        setError("아이디 또는 비밀번호를 확인해 주세요.");
        return;
      }

      const tokenValue = `ok:${Date.now()}`;
      setAdminAuthToken(tokenValue);
      window.location.href = "/admin/calendar";
    } catch (err) {
      console.error(err);
      setError("로그인 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600">
          {error}
        </div>
      )}
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
        disabled={submitting}
        className="w-full rounded-lg bg-[#DB5461] py-4 text-sm font-bold text-white shadow-lg shadow-[#DB5461]/20 transition-all hover:bg-[#c44b57] active:scale-[0.98]"
      >
        {submitting ? "Signing in..." : "Sign In to Reservation System..."}
      </button>
    </form>
  );
}
