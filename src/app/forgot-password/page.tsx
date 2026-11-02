"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { makeUnauthenticatedRequest } from "@/services/api";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Assuming your backend endpoint for this is /auth/forgot-password
      await makeUnauthenticatedRequest("POST", "/auth/forgot-password", { email });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to send reset link. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col min-h-screen bg-[#F7FAFC] items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">📧</div>
          <h2 className="text-[22px] font-bold text-[#2D3748] mb-2">Check your email</h2>
          <p className="text-[14px] text-[#718096] mb-6 leading-relaxed">
            We&apos;ve sent a password reset link to <strong>{email}</strong>. Please check your inbox and follow the instructions.
          </p>
          <button
            onClick={() => router.push("/")}
            className="w-full bg-[#6B46C1] text-white py-3 rounded-lg font-semibold active:opacity-80"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F7FAFC] px-6 pt-20 pb-6">
      <div className="text-center mb-10">
        <h1 className="text-[28px] font-bold text-[#FF6B6B] mb-2">
          Reset Password 🔑
        </h1>
        <p className="text-[16px] text-[#718096]">
          Enter your email to receive a reset link
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6 max-w-md w-full mx-auto">
        {error && (
          <div className="bg-[#FFF5F5] text-[#E53E3E] p-3 rounded-lg mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value.trim())}
            className="w-full bg-[#F7FAFC] border border-[#E2E8F0] rounded-lg p-3 text-[16px] text-[#2D3748] focus:outline-none focus:border-[#6B46C1]"
            required
          />

          <button
            type="submit"
            disabled={loading || !email}
            className={`w-full py-3 rounded-lg font-bold text-white mt-2 ${
              loading || !email ? "bg-[#CBD5E0] opacity-70 cursor-not-allowed" : "bg-[#6B46C1] active:opacity-80"
            }`}
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

        <button
          onClick={() => router.push("/")}
          className="w-full mt-4 text-[#6B46C1] text-[14px] font-medium active:opacity-70"
        >
          Back to Login
        </button>
      </div>
    </div>
  );
}