"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { makeUnauthenticatedRequest } from "@/services/api";

// Next.js requires components using useSearchParams to be wrapped in Suspense
function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setError("Invalid reset link. Missing token.");
        setVerifying(false);
        return;
      }

      try {
        const response = await makeUnauthenticatedRequest("GET", `/auth/verify-reset-token/${token}`);
        
        if (response.data.valid) {
          setTokenValid(true);
        } else {
          setError("This reset link is invalid or has expired.");
        }
      } catch (err: any) {
        setError(err.response?.data?.error || "Invalid or expired reset link.");
      } finally {
        setVerifying(false);
      }
    };

    verifyToken();
  }, [token]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!newPassword || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await makeUnauthenticatedRequest("POST", "/auth/reset-password", {
        token,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      setResetComplete(true);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="flex flex-col min-h-screen bg-[#F7FAFC] items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#6B46C1] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-[#718096]">Verifying reset link...</p>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="flex flex-col min-h-screen bg-[#F7FAFC] items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-[22px] font-bold text-[#2D3748] mb-2">Link Invalid</h2>
          <p className="text-[14px] text-[#718096] mb-6">{error}</p>
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

  if (resetComplete) {
    return (
      <div className="flex flex-col min-h-screen bg-[#F7FAFC] items-center justify-center p-6">
        <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-8 max-w-md w-full text-center">
          <div className="w-24 h-24 bg-[#C6F6D5] rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl text-[#38A169]">✓</span>
          </div>
          <h2 className="text-[24px] font-bold text-[#2D3748] mb-3">Password Reset Complete!</h2>
          <p className="text-[16px] text-[#718096] leading-relaxed mb-8">
            Your password has been successfully reset. You can now log in with your new password.
          </p>
          <button
            onClick={() => router.push("/")}
            className="w-full bg-[#6B46C1] text-white py-3 rounded-lg font-semibold active:opacity-80"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F7FAFC] px-6 pt-20 pb-6">
      <div className="max-w-md w-full mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-[28px] font-bold text-[#FF6B6B] mb-2">Reset Password</h1>
          <p className="text-[16px] text-[#718096]">Enter your new password below</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6">
          {error && (
            <div className="bg-[#FFF5F5] text-[#E53E3E] p-3 rounded-lg mb-4 text-sm text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleResetPassword} className="flex flex-col gap-4">
            <div>
              <label className="block text-[14px] font-semibold text-[#2D3748] mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-[#F7FAFC] border border-[#E2E8F0] rounded-lg p-3 pr-12 text-[16px] text-[#2D3748] focus:outline-none focus:border-[#6B46C1]"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xl"
                >
                  {showPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
              <p className="text-[12px] text-[#A0AEC0] mt-1">Minimum 6 characters</p>
            </div>

            <div>
              <label className="block text-[14px] font-semibold text-[#2D3748] mb-2 mt-2">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-[#F7FAFC] border border-[#E2E8F0] rounded-lg p-3 pr-12 text-[16px] text-[#2D3748] focus:outline-none focus:border-[#6B46C1]"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xl"
                >
                  {showConfirmPassword ? "👁️" : "👁️‍🗨️"}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !newPassword || !confirmPassword}
              className={`w-full py-3 rounded-lg font-bold text-white mt-4 ${
                loading || !newPassword || !confirmPassword
                  ? "bg-[#CBD5E0] opacity-70 cursor-not-allowed"
                  : "bg-[#6B46C1] active:opacity-80"
              }`}
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// Main export wrapping the content in Suspense to fix build errors with useSearchParams
export default function ResetPasswordScreen() {
  return (
    <Suspense fallback={<div className="flex min-h-screen bg-[#F7FAFC] items-center justify-center text-[#718096]">Loading...</div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}