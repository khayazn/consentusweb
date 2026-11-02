"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/services/api";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/auth/login", { email, password });

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));

      // Navigate to the main app dashboard
      router.push("/app");
    } catch (err: any) {
      setError(err.response?.data?.error || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F7FAFC] px-6 pt-20 pb-6">
      {/* Header matching LoginScreen.js */}
      <div className="text-center mb-10">
        <h1 className="text-[28px] font-bold text-[#FF6B6B] mb-2">
          Welcome Back! 👋
        </h1>
        <p className="text-[16px] text-[#718096]">Login to your account</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-[#E2E8F0] p-6">
        <h2 className="text-[20px] font-bold text-[#2D3748] text-center mb-6">
          Login Information
        </h2>

        {error && (
          <div className="bg-[#FFF5F5] text-[#E53E3E] p-3 rounded-lg mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value.trim())}
            className="input-field"
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-field"
            required
          />

          <button
            type="submit"
            disabled={loading || !email || !password}
            className={`btn-primary mt-2 ${
              !email || !password ? "opacity-50" : ""
            }`}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="flex flex-col gap-4 mt-6">
          <button
            className="text-[#6B46C1] text-[14px] font-medium active:opacity-70"
            onClick={() => router.push("/forgot-password")}
          >
            Forgot Password?
          </button>

          <button
            className="bg-[#EDF2F7] text-[#4A5568] w-full rounded-lg py-3 font-medium text-[16px] active:opacity-80"
            onClick={() => router.push("/register")}
          >
            Don&apos;t have an account? Sign up
          </button>
        </div>
      </div>

      <div className="mt-12 flex flex-row flex-wrap justify-center text-[12px] text-[#A0AEC0] gap-1">
        <span>By logging in, you agree to our</span>
        <a
          href="https://www.consentus.online/terms-of-service.html"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#6B46C1] font-semibold"
        >
          Terms of Service
        </a>
        <span>and</span>
        <a
          href="https://www.consentus.online/privacy-policy.html"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#6B46C1] font-semibold"
        >
          Privacy Policy
        </a>
      </div>
    </div>
  );
}