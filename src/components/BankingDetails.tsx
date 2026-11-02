"use client";

import { useEffect, useState } from "react";
import { makeAuthenticatedRequest } from "@/services/api";
import { getAllCountries, getCurrencyForCountry } from "@/lib/currency";

interface BankingDetailsProps {
  userId: number;
  visible: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

interface BankingData {
  bank_name: string;
  account_holder_name: string;
  account_number: string;
  routing_number: string;
  iban: string;
  swift_code: string;
  bank_country: string;
  currency: string;
  branch_code: string;
}

const EMPTY_FORM: BankingData = {
  bank_name: "",
  account_holder_name: "",
  account_number: "",
  routing_number: "",
  iban: "",
  swift_code: "",
  bank_country: "",
  currency: "USD",
  branch_code: "",
};

export default function BankingDetails({
  userId,
  visible,
  onClose,
  onUpdate,
}: BankingDetailsProps) {
  const [bankingData, setBankingData] = useState<BankingData>({ ...EMPTY_FORM });
  const [loading, setLoading] = useState(false);
  const [hasExistingDetails, setHasExistingDetails] = useState(false);

  useEffect(() => {
    if (visible) {
      fetchBankingDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  async function fetchBankingDetails() {
    try {
      setLoading(true);
      const response = await makeAuthenticatedRequest(
        "GET",
        `/users/${userId}/banking`
      );
      const details = response?.data?.banking_details;

      if (details && details.has_banking_details) {
        setBankingData({
          bank_name: details.bank_name || "",
          account_holder_name: details.account_holder_name || "",
          account_number: details.account_number || "",
          routing_number: details.routing_number || "",
          iban: details.iban || "",
          swift_code: details.swift_code || "",
          bank_country: details.bank_country || "",
          currency: details.currency || "USD",
          branch_code: details.branch_code || "",
        });
        setHasExistingDetails(true);
      } else {
        setBankingData({ ...EMPTY_FORM });
        setHasExistingDetails(false);
      }
    } catch (error) {
      console.error("Error fetching banking details:", error);
      setHasExistingDetails(false);
    } finally {
      setLoading(false);
    }
  }

  function handleCountryChange(country: string) {
    if (!country) {
      setBankingData((prev) => ({ ...prev, bank_country: "", currency: "" }));
      return;
    }
    setBankingData((prev) => ({
      ...prev,
      bank_country: country,
      currency: getCurrencyForCountry(country).code,
    }));
  }

  async function handleSaveBankingDetails() {
    if (bankingData.bank_country && !getAllCountries().includes(bankingData.bank_country)) {
      window.alert("Invalid Country: Please select a valid bank country from the list.");
      return;
    }

    const resolvedCurrency = bankingData.bank_country
      ? getCurrencyForCountry(bankingData.bank_country).code
      : null;

    const payload = {
      bank_name: bankingData.bank_name || null,
      account_holder_name: bankingData.account_holder_name || null,
      account_number: bankingData.account_number || null,
      routing_number: bankingData.routing_number || null,
      iban: bankingData.iban || null,
      swift_code: bankingData.swift_code || null,
      bank_country: bankingData.bank_country || null,
      currency: resolvedCurrency,
      branch_code: bankingData.branch_code || null,
    };

    try {
      setLoading(true);
      await makeAuthenticatedRequest("PUT", `/users/${userId}/banking`, payload);
      window.alert("Success: Banking details saved successfully!");
      onUpdate();
    } catch (error) {
      console.error("Error saving banking details:", error);
      window.alert("Error: Failed to save banking details. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteBankingDetails() {
    if (!window.confirm("Are you sure you want to clear all your banking information?")) {
      return;
    }
    try {
      setLoading(true);
      await makeAuthenticatedRequest("DELETE", `/users/${userId}/banking`);
      window.alert("Success: Banking details cleared successfully!");
      setBankingData({ ...EMPTY_FORM });
      setHasExistingDetails(false);
      onUpdate();
    } catch (error) {
      console.error("Error clearing banking details:", error);
      window.alert("Error: Failed to clear banking details.");
    } finally {
      setLoading(false);
    }
  }

  const hasFormData = Object.values(bankingData).some(
    (value) => value && value.trim() !== ""
  );

  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0]">
          <h2 className="text-[20px] font-bold text-[#2D3748]">
            {hasExistingDetails ? "Banking Details" : "Add Banking Details"}
          </h2>
          <button
            onClick={onClose}
            className="text-[20px] font-bold text-[#718096] p-1 active:opacity-70"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <div className="p-5 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-10 text-center">
              <p className="text-[16px] text-[#666]">
                {hasExistingDetails ? "Loading banking details…" : "Processing…"}
              </p>
            </div>
          ) : (
            <>
              <h3 className="text-[18px] font-bold text-[#2D3748] mb-2">
                Bank Information
              </h3>
              <p className="text-[14px] italic text-[#718096] text-center mb-4">
                All fields are optional. Fill in only the information relevant to your bank.
              </p>

              {hasExistingDetails && (
                <div className="bg-[#E6FFFA] border-l-4 border-[#319795] rounded-lg p-3 mb-4">
                  <p className="text-[14px] font-medium text-[#234E52]">
                    ✅ You have existing banking details. Update any information below.
                  </p>
                </div>
              )}

              <input
                className="w-full bg-[#F7FAFC] border border-[#E2E8F0] rounded-lg px-3 py-3 mb-3 text-[16px] text-[#2D3748] placeholder-[#999]"
                placeholder="Bank Name"
                value={bankingData.bank_name}
                onChange={(e) =>
                  setBankingData({ ...bankingData, bank_name: e.target.value })
                }
              />
              <input
                className="w-full bg-[#F7FAFC] border border-[#E2E8F0] rounded-lg px-3 py-3 mb-3 text-[16px] text-[#2D3748] placeholder-[#999]"
                placeholder="Account Holder Name"
                value={bankingData.account_holder_name}
                onChange={(e) =>
                  setBankingData({ ...bankingData, account_holder_name: e.target.value })
                }
              />
              <input
                className="w-full bg-[#F7FAFC] border border-[#E2E8F0] rounded-lg px-3 py-3 mb-3 text-[16px] text-[#2D3748] placeholder-[#999]"
                placeholder="Account Number"
                value={bankingData.account_number}
                onChange={(e) =>
                  setBankingData({ ...bankingData, account_number: e.target.value })
                }
              />
              <input
                className="w-full bg-[#F7FAFC] border border-[#E2E8F0] rounded-lg px-3 py-3 mb-3 text-[16px] text-[#2D3748] placeholder-[#999]"
                placeholder="Routing Number (US)"
                value={bankingData.routing_number}
                onChange={(e) =>
                  setBankingData({ ...bankingData, routing_number: e.target.value })
                }
              />
              <input
                className="w-full bg-[#F7FAFC] border border-[#E2E8F0] rounded-lg px-3 py-3 mb-3 text-[16px] text-[#2D3748] placeholder-[#999]"
                placeholder="Branch Code"
                value={bankingData.branch_code}
                onChange={(e) =>
                  setBankingData({ ...bankingData, branch_code: e.target.value })
                }
              />
              <input
                className="w-full bg-[#F7FAFC] border border-[#E2E8F0] rounded-lg px-3 py-3 mb-3 text-[16px] text-[#2D3748] placeholder-[#999] uppercase"
                placeholder="IBAN (International)"
                value={bankingData.iban}
                onChange={(e) =>
                  setBankingData({ ...bankingData, iban: e.target.value.toUpperCase() })
                }
              />
              <input
                className="w-full bg-[#F7FAFC] border border-[#E2E8F0] rounded-lg px-3 py-3 mb-3 text-[16px] text-[#2D3748] placeholder-[#999] uppercase"
                placeholder="SWIFT/BIC Code"
                value={bankingData.swift_code}
                onChange={(e) =>
                  setBankingData({ ...bankingData, swift_code: e.target.value.toUpperCase() })
                }
              />

              {/* Country Picker (native select) */}
              <label className="block text-[13px] font-semibold text-[#4A5568] mb-1 mt-1">
                Bank Country
              </label>
              <select
                className="w-full bg-[#F7FAFC] border border-[#E2E8F0] rounded-lg px-3 py-3 mb-3 text-[16px] text-[#2D3748]"
                value={bankingData.bank_country}
                onChange={(e) => handleCountryChange(e.target.value)}
              >
                <option value="">Select a country…</option>
                {getAllCountries().map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </select>

              {/* Currency (read-only) */}
              <label className="block text-[13px] font-semibold text-[#4A5568] mb-1 mt-1">
                Currency
              </label>
              <input
                className="w-full bg-[#EDF2F7] border border-[#E2E8F0] rounded-lg px-3 py-3 mb-1 text-[16px] text-[#718096]"
                value={bankingData.currency}
                readOnly
                placeholder="Auto-filled from country"
              />
              {bankingData.bank_country && (
                <p className="text-[12px] text-[#6B46C1] ml-1 mb-3">
                  Auto-set from {bankingData.bank_country}: {bankingData.currency}
                </p>
              )}

              {/* Buttons */}
              <div className="flex gap-3 mt-5">
                {(hasExistingDetails || hasFormData) && (
                  <button
                    onClick={handleDeleteBankingDetails}
                    className="flex-1 bg-[#E53E3E] text-white font-bold rounded-lg py-3 text-[14px] active:opacity-80"
                  >
                    {hasExistingDetails ? "Clear Details" : "Clear Form"}
                  </button>
                )}
                <button
                  onClick={handleSaveBankingDetails}
                  disabled={loading}
                  className="flex-[2] bg-[#6B46C1] text-white font-bold rounded-lg py-3 text-[16px] active:opacity-80"
                >
                  {hasExistingDetails ? "Update Details" : "Save Details"}
                </button>
              </div>

              <p className="text-[12px] italic text-[#718096] text-center mt-4 leading-4">
                Your banking information is encrypted and stored securely. All fields are optional —
                only fill in what&apos;s applicable to your bank.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}