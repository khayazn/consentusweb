"use client";

import { useEffect, useState } from "react";
import { subscriptionAPI, type User } from "@/services/api";

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  currentUser: User;
  onUpgradeSuccess?: () => void;
}

export default function PaywallModal({
  visible,
  onClose,
  currentUser,
  onUpgradeSuccess,
}: PaywallModalProps) {
  const [loading, setLoading] = useState(false);
  const [displayPrice, setDisplayPrice] = useState<string | null>(null);
  const [displayCurrency, setDisplayCurrency] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && currentUser) {
      setError(null);
      setDisplayPrice(null);
      setDisplayCurrency(null);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, currentUser.id]);

  async function handleUpgrade() {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const initRes = await subscriptionAPI.initializePayment();
      const data = initRes.data as {
        authorization_url?: string | null;
        access_code?: string;
        reference?: string;
        display_price?: string;
        display_currency?: string;
        error?: string;
        message?: string;
        mock?: boolean;
      };

      if (data.display_price) setDisplayPrice(data.display_price);
      if (data.display_currency) setDisplayCurrency(data.display_currency);

      if (data.error || !data.authorization_url) {
        throw new Error(
          data.error || data.message || "Payment initialization failed"
        );
      }

      if (data.mock) {
        throw new Error(
          "Payment gateway is not configured. Please try again later or contact support."
        );
      }

      // Store the reference so the callback page knows what to verify
      // (though the backend marks the user paid directly when it hits verify-payment)
      if (data.reference) {
        sessionStorage.setItem("paystack_reference", data.reference);
      }

      // Redirect the browser to Paystack's hosted checkout page.
      // We append &platform=web so the backend knows to send the user
      // back to the web app after payment, instead of the mobile deep link.
      const url = new URL(data.authorization_url);
      url.searchParams.set("platform", "web");
      window.location.href = url.toString();
      
    } catch (e) {
      const msg = (e as Error).message || "Payment failed";
      setError(msg);
      setLoading(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[28px] w-full max-w-[420px] max-h-[90vh] relative overflow-hidden shadow-2xl">
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 z-10 bg-black/20 text-white rounded-full p-2 w-10 h-10 flex items-center justify-center active:opacity-70 disabled:opacity-40"
        >
          ✕
        </button>

        <div className="px-6 pb-8 overflow-y-auto max-h-[90vh]">
          <div className="flex flex-col items-center pt-10 pb-6">
            <div className="w-20 h-20 rounded-full bg-[#F0F4FF] flex items-center justify-center mb-4 text-[40px]">
              🚀
            </div>
            <h2 className="text-[28px] font-bold text-[#2D3748] mb-1">
              Go Unlimited
            </h2>
            <p className="text-[16px] text-[#718096] text-center">
              Unlock everything with one simple payment
            </p>
          </div>

          <div className="flex flex-col items-center mb-6">
            <div className="relative bg-[#F0F4FF] border-2 border-[#6B46C1] rounded-2xl px-8 py-5 flex flex-col items-center min-w-[70%]">
              <span className="text-[40px] font-bold text-[#6B46C1] leading-none">
                {displayPrice || "R40.99"}
              </span>
              <span className="text-[16px] text-[#718096] mt-1">/ month</span>
              <span className="absolute -top-3 -right-2 bg-[#FF6B6B] text-white text-[11px] font-bold px-2.5 py-1 rounded-xl">
                🔥 Best Value
              </span>
            </div>
            <p className="text-[13px] text-[#A0AEC0] mt-2">
              Subscription • Cancel anytime
            </p>
            {displayCurrency && displayCurrency !== "ZAR" && (
              <p className="text-[11px] italic text-[#718096] mt-1">
                ≈ R40.99 ZAR (converted to {displayCurrency})
              </p>
            )}
          </div>

          <div className="mb-6">
            <p className="text-[18px] font-bold text-[#2D3748] mb-4">
              🏆 What you&apos;ll get:
            </p>

            {[
              { icon: "∞", title: "Unlimited Pinches", desc: "Send as many pinches as you want. No more limits!" },
              { icon: "📅", title: "Unlimited Date Requests", desc: "Ask out anyone, anytime. Unlimited date requests." },
              { icon: "💼", title: "Unlimited Service Requests", desc: "Book services without restrictions. Unlimited bookings." },
              { icon: "🔄", title: "Restore Rejected Pinches", desc: "Made a mistake? Restore any rejected pinch instantly." },
              { icon: "👤", title: "General User Mode", desc: "Browse profiles without being discovered. Premium feature." },
            ].map((f) => (
              <div key={f.title} className="flex items-start gap-3.5 mb-3.5 px-1">
                <div className="w-9 h-9 rounded-full bg-[#F0F4FF] flex items-center justify-center text-[#6B46C1] text-[18px] shrink-0 mt-0.5">
                  {f.icon}
                </div>
                <div className="flex-1">
                  <p className="text-[15px] font-semibold text-[#2D3748] mb-0.5">
                    {f.title}
                  </p>
                  <p className="text-[13px] text-[#718096] leading-[18px]">
                    {f.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex bg-[#F7FAFC] rounded-xl py-4 mb-6">
            <div className="flex-1 flex flex-col items-center">
              <span className="text-[18px] font-bold text-[#2D3748]">1,200+</span>
              <span className="text-[12px] text-[#718096] mt-0.5">Active Subscribers</span>
            </div>
            <div className="w-px bg-[#E2E8F0]" />
            <div className="flex-1 flex flex-col items-center">
              <span className="text-[18px] font-bold text-[#2D3748]">4.8★</span>
              <span className="text-[12px] text-[#718096] mt-0.5">Average Rating</span>
            </div>
            <div className="w-px bg-[#E2E8F0]" />
            <div className="flex-1 flex flex-col items-center">
              <span className="text-[18px] font-bold text-[#2D3748]">99%</span>
              <span className="text-[12px] text-[#718096] mt-0.5">Satisfaction</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-[#48BB78] text-[16px]">🔒</span>
            <span className="text-[13px] text-[#718096]">
              Payment processed securely by Paystack
            </span>
          </div>

          <button
            onClick={handleUpgrade}
            disabled={loading}
            className={`w-full rounded-2xl py-4 flex items-center justify-center gap-2 text-white font-bold text-[18px] shadow-lg active:opacity-80 ${
              loading ? "bg-[#CBD5E0] cursor-not-allowed" : "bg-[#6B46C1]"
            }`}
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Redirecting to Paystack…
              </>
            ) : (
              <>
                💳 Subscribe Now — {displayPrice || "R40.99"}
                <span className="text-xl">→</span>
              </>
            )}
          </button>

          <p className="text-[12px] text-[#A0AEC0] text-center leading-[18px] mt-3">
            By upgrading, you agree to our Terms of Service and Privacy Policy.
            You can cancel your subscription anytime.
          </p>

          {error && (
            <div className="flex items-center gap-2 bg-[#FFF5F5] rounded-lg p-3 mt-3">
              <span className="text-[#E53E3E] text-[20px]">⚠️</span>
              <p className="text-[13px] text-[#E53E3E] flex-1">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}