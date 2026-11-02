"use client";

import { useEffect, useRef, useState } from "react";
import { dateAPI, type User } from "@/services/api";

function getCurrencySymbolFromCode(currencyCode: string): string {
  const currencyMap: Record<string, string> = {
    USD: "$", ZAR: "R", KES: "KSh", NGN: "₦", GBP: "£",
    EUR: "€", JPY: "¥", CAD: "C$", AUD: "A$", INR: "₹",
    CNY: "¥", CHF: "CHF", SEK: "kr", NOK: "kr", DKK: "kr",
    PLN: "zł", RUB: "₽", BRL: "R$", MXN: "MX$", SGD: "S$",
    HKD: "HK$", NZD: "NZ$", KRW: "₩", TRY: "₺", AED: "د.إ",
    SAR: "﷼", ILS: "₪", THB: "฿", VND: "₫", IDR: "Rp",
    PHP: "₱", PKR: "₨", BDT: "৳", LKR: "Rs", NPR: "Rs",
    EGP: "E£", MAD: "DH", GHS: "₵",
  };
  return currencyMap[currencyCode] || currencyCode;
}

interface DateRequest {
  id: number;
  inviter_id: number;
  invitee_id: number;
  inviter_username?: string;
  invitee_username?: string;
  offer?: { description?: string; price?: string; location?: string; dateTime?: string };
  created_at?: string;
  updated_at?: string;
  actual_start_time?: string;
  actual_end_time?: string;
  status?: string;
  request_currency?: string;
  invitee_currency?: string;
  inviter_currency?: string;
  [key: string]: unknown;
}

interface InvoiceBillingProps {
  dateRequest: DateRequest;
  currentUser: User;
  otherUser: User;
  onBack?: () => void;
  onPaymentComplete?: () => void;
}

interface InvoiceData {
  invoice?: { amount?: string; description?: string; status?: string };
  payee_banking_details?: {
    bank_name?: string;
    account_holder_name?: string;
    account_number?: string;
    account_number_masked?: string;
    branch_code?: string;
  };
  requires_payment?: boolean;
  payment_status?: string;
}

interface FileAttachment {
  file: File;
  name: string;
  size: number;
  type: string;
}

export default function InvoiceBillingScreen({
  dateRequest,
  currentUser,
  otherUser,
  onBack,
  onPaymentComplete,
}: InvoiceBillingProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [invoiceDetails, setInvoiceDetails] = useState<InvoiceData | null>(null);
  const [proofOfPayment, setProofOfPayment] = useState<FileAttachment | null>(null);
  const [paymentMade, setPaymentMade] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Payment roles
  const isInviter = dateRequest.inviter_id === currentUser.id;
  const currentUserIsPayer = isInviter;
  const currentUserIsPayee = !isInviter;

  // Currency
  const getOriginalRequestCurrency = (): string => {
    if (dateRequest.request_currency) return dateRequest.request_currency;
    if (dateRequest.invitee_currency) return dateRequest.invitee_currency;
    if (dateRequest.inviter_currency) return dateRequest.inviter_currency;
    if (currentUserIsPayer && (otherUser as { currency?: string }).currency) {
      return (otherUser as { currency?: string }).currency!;
    }
    if (currentUserIsPayee && (currentUser as { currency?: string }).currency) {
      return (currentUser as { currency?: string }).currency!;
    }
    return "USD";
  };

  const originalCurrencyCode = getOriginalRequestCurrency();
  const originalCurrencySymbol = getCurrencySymbolFromCode(originalCurrencyCode);

  // Fetch invoice details
  useEffect(() => {
    if (!dateRequest || !currentUser || !otherUser) return;
    (async () => {
      try {
        const res = await dateAPI.getInvoiceDetails(dateRequest.id, currentUser.id);
        if (res.data) {
          setInvoiceDetails(res.data);
          if (res.data.payment_status === "payment_submitted") {
            setPaymentMade(true);
          }
        }
      } catch (e) {
        console.error("Invoice fetch error:", e);
        setInvoiceDetails({
          invoice: {
            amount: dateRequest.offer?.price || "0",
            description: dateRequest.offer?.description || "Service/Date",
            status: "pending_payment",
          },
          requires_payment: true,
          payment_status: "pending",
        });
      }
    })();
  }, [dateRequest, currentUser, otherUser]);

  const handleBack = () => {
    if (currentUserIsPayer && !paymentMade) {
      window.alert(
        "Complete Payment First: You must submit payment proof before you can leave this screen."
      );
      return;
    }
    onBack?.();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setProofOfPayment({
      file,
      name: file.name || `payment_proof_${Date.now()}`,
      size: file.size,
      type: file.type || "application/octet-stream",
    });
  };

  const handleSubmitPayment = async () => {
    if (!proofOfPayment) {
      window.alert("Error: Please attach proof of payment first");
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("user_id", String(currentUser.id));
      formData.append("proof_of_payment[type]", "bank_transfer");
      formData.append(
        "proof_of_payment[submitted_at]",
        new Date().toISOString()
      );
      formData.append("proof_of_payment[attachment]", proofOfPayment.file);

      const res = await fetch(
        `https://api-v1.consentus.online/api/date-requests/${dateRequest.id}/submit-payment`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
          },
          body: formData,
        }
      );

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      setPaymentMade(true);
      window.alert(
        "Success! Payment proof uploaded successfully! Waiting for confirmation from the other party."
      );
    } catch (err: unknown) {
      const e = err as Error;
      window.alert(`Upload Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    setLoading(true);
    try {
      await dateAPI.confirmPayment(dateRequest.id, {
        user_id: currentUser.id,
        confirmed_at: new Date().toISOString(),
      });
      window.alert("Success! Payment confirmed! The transaction is now complete.");
      onPaymentComplete?.();
    } catch (err: unknown) {
      const e = err as Error;
      window.alert(`Error: Failed to confirm payment. ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleViewPaymentProof = async () => {
    try {
      const res = await dateAPI.getPaymentProof(dateRequest.id, currentUser.id);
      if (res.data?.proof_of_payment) {
        const submitted = res.data.submitted_at
          ? new Date(res.data.submitted_at).toLocaleString()
          : "Unknown";
        window.alert(
          `Payment Proof Details\n\nSubmitted: ${submitted}\nType: ${res.data.proof_of_payment.type || "Bank Transfer"}`
        );
      } else {
        window.alert("No proof: No payment proof has been submitted yet.");
      }
    } catch {
      window.alert("Error: Failed to load payment proof.");
    }
  };

  const invoiceData = invoiceDetails?.invoice || {
    amount: dateRequest.offer?.price || "0",
    description: dateRequest.offer?.description || "Service/Date",
  };
  const bankingDetails = invoiceDetails?.payee_banking_details;

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F9FA]">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,application/pdf"
        onChange={handleFileSelected}
      />

      {/* Header */}
      <div className="flex flex-row justify-between items-center px-5 pt-[60px] pb-5 bg-white border-b border-[#E2E8F0]">
        <button
          onClick={handleBack}
          className="text-[#6B46C1] text-[16px] font-semibold active:opacity-70"
        >
          ← Back
        </button>
        <h1 className="text-[20px] font-bold text-[#2D3748]">Invoice & Billing</h1>
        <div className="w-12" />
      </div>

      {/* Payment enforcement banner */}
      {currentUserIsPayer && !paymentMade && (
        <div className="bg-[#FEF5E7] border-l-4 border-[#ED8936] p-3">
          <p className="text-[#C05621] text-[14px] font-semibold text-center">
            🔒 Payment Required: You must complete payment to finish this transaction
          </p>
        </div>
      )}

      <main className="flex-1 overflow-y-auto p-4">
        {/* Transaction Details */}
        <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
          <h2 className="text-[18px] font-bold text-[#2D3748] mb-3">
            Transaction Details
          </h2>
          {[
            { label: "Service/Date:", value: invoiceData.description },
            { label: "Date/Time:", value: dateRequest.offer?.dateTime || "Not specified" },
            { label: "Location:", value: dateRequest.offer?.location || "Not specified" },
            { label: "Status:", value: invoiceDetails?.payment_status || "Pending Payment" },
            { label: "Your Role:", value: currentUserIsPayer ? "Payer (You pay)" : "Payee (You receive payment)" },
            { label: "Currency:", value: `${originalCurrencyCode} (${originalCurrencySymbol})` },
          ].map((row) => (
            <div
              key={row.label}
              className="flex justify-between items-center py-2 border-b border-[#F7FAFC]"
            >
              <span className="text-[14px] text-[#718096] font-semibold">{row.label}</span>
              <span className="text-[14px] text-[#2D3748] font-medium text-right max-w-[60%]">
                {row.value}
              </span>
            </div>
          ))}
          <div className="flex justify-between items-center py-2">
            <span className="text-[14px] text-[#718096] font-semibold">Amount Due:</span>
            <span className="text-[16px] font-bold text-[#319795]">
              {originalCurrencySymbol}{invoiceData.amount || "0"}
            </span>
          </div>
        </div>

        {/* Banking Details */}
        <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
          <h2 className="text-[18px] font-bold text-[#2D3748] mb-3">
            Banking Details
          </h2>
          {bankingDetails ? (
            <>
              {[
                { label: "Bank:", value: bankingDetails.bank_name },
                { label: "Account Holder:", value: bankingDetails.account_holder_name },
                {
                  label: "Account Number:",
                  value:
                    bankingDetails.account_number_masked ||
                    bankingDetails.account_number ||
                    "Not provided",
                },
                { label: "Branch Code:", value: bankingDetails.branch_code },
              ]
                .filter((r) => r.value)
                .map((row) => (
                  <div
                    key={row.label}
                    className="flex justify-between items-center py-2 border-b border-[#F7FAFC]"
                  >
                    <span className="text-[14px] text-[#718096] font-semibold">{row.label}</span>
                    <span className="text-[14px] text-[#2D3748] font-medium">{row.value}</span>
                  </div>
                ))}
              <div className="bg-[#EBF8FF] border-l-4 border-[#3182CE] rounded-lg p-3 mt-2">
                <p className="text-[#2C5282] text-[14px] font-medium">
                  💡 Please use &quot;Date #{dateRequest.id}&quot; as payment reference
                </p>
              </div>
            </>
          ) : (
            <p className="text-[14px] italic text-[#718096] text-center py-3">
              No banking details available. Please contact{" "}
              {otherUser?.username || "the user"} directly.
            </p>
          )}
        </div>

        {/* Payment Actions */}
        <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
          <h2 className="text-[18px] font-bold text-[#2D3748] mb-3">
            Payment Actions
          </h2>

          {/* Payee (receives payment) - confirm receipt */}
          {currentUserIsPayee && invoiceDetails?.payment_status === "payment_submitted" ? (
            <>
              <p className="text-[14px] text-[#4A5568] leading-5 mb-3">
                {dateRequest.inviter_username} has submitted payment proof. Please verify and confirm receipt.
              </p>
              <button
                onClick={handleViewPaymentProof}
                className="w-full bg-[#E6FFFA] border-l-4 border-[#319795] text-[#234E52] text-[14px] font-semibold rounded-lg p-3 mb-3 active:opacity-80"
              >
                📎 View Payment Proof
              </button>
              <button
                onClick={handleConfirmPayment}
                disabled={loading}
                className="w-full bg-[#38A169] text-white font-bold rounded-lg py-4 active:opacity-80 disabled:opacity-50"
              >
                {loading ? "Confirming…" : "Confirm Payment Received"}
              </button>
            </>
          ) : currentUserIsPayer ? (
            <>
              {!paymentMade ? (
                <>
                  <p className="text-[14px] text-[#4A5568] leading-5 mb-3">
                    Please transfer {originalCurrencySymbol}
                    {invoiceData.amount} to the banking details above, then attach proof below.
                  </p>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full bg-[#EDF2F7] border-2 border-dashed border-[#E2E8F0] text-[#4A5568] text-[16px] font-semibold rounded-lg p-4 mb-3 active:opacity-80"
                  >
                    {proofOfPayment ? "📎 Proof Attached" : "+ Attach Payment Proof"}
                  </button>

                  {proofOfPayment && (
                    <div className="bg-[#F7FAFC] border-l-4 border-[#48BB78] rounded-lg p-3 mb-3">
                      <p className="text-[14px] font-semibold text-[#2D3748] mb-1">
                        {proofOfPayment.name}
                      </p>
                      <p className="text-[12px] text-[#718096] mb-2">
                        {proofOfPayment.size
                          ? `Size: ${(proofOfPayment.size / 1024).toFixed(1)}KB`
                          : "File attached"}
                      </p>
                      <button
                        onClick={() => setProofOfPayment(null)}
                        className="text-[#E53E3E] text-[12px] font-semibold active:opacity-70"
                      >
                        Remove
                      </button>
                    </div>
                  )}

                  <button
                    onClick={handleSubmitPayment}
                    disabled={!proofOfPayment || loading}
                    className={`w-full text-white font-bold rounded-lg py-4 ${
                      !proofOfPayment || loading
                        ? "bg-[#CBD5E0] cursor-not-allowed"
                        : "bg-[#319795] active:opacity-80"
                    }`}
                  >
                    {loading ? "Submitting…" : "Submit Payment Proof"}
                  </button>
                </>
              ) : (
                <div className="bg-[#FFF3CD] border-l-4 border-[#FFC107] rounded-lg p-4">
                  <p className="text-[#856404] text-[14px] font-medium text-center mb-2">
                    ✅ Payment proof submitted! Waiting for {otherUser?.username || "the other user"} to confirm receipt.
                  </p>
                  <p className="text-[#856404] text-[12px] text-center italic">
                    You can now navigate away from this screen.
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="text-[14px] text-[#4A5568]">
              Payment process will begin when the service/date is completed.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}