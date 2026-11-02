"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface TimelineRequest {
  id: number;
  inviter_id?: number;
  invitee_id?: number;
  inviter_username?: string;
  invitee_username?: string;
  invitee_user_type?: string;
  status?: string;
  offer?: { description?: string; price?: string; location?: string; dateTime?: string };
  offer_amount?: number;
  created_at?: string;
  viewed_at?: string;
  accepted_at?: string;
  declined_at?: string;
  decline_reason?: string;
  payment_required_at?: string;
  actual_start_time?: string;
  actual_end_time?: string;
  started_by?: number;
  end_requested_at?: string;
  end_requested_by?: number;
  end_approved_at?: string;
  invoice_generated_at?: string;
  payment_submitted_at?: string;
  payment_made_at?: string;
  payment_made_by?: number;
  payment_confirmed_at?: string;
  payment_confirmed_by?: number;
  completed_at?: string;
  updated_at?: string;
  payment_attempt_count?: number;
  last_payment_attempt_at?: string;
  payment_status?: string;
  request_currency?: string;
  invitee_currency?: string;
  inviter_currency?: string;
  invoice_data?: { amount?: string };
  [key: string]: unknown;
}

interface Terminology {
  base: string;
  capitalized: string;
  plural: string;
  activity: string;
  offer: string;
  request: string;
  history: string;
}

// Global timeline store (matches mobile's behavior of retaining complete data)
const timelineDataStore: Record<number, TimelineRequest> = {};

function getCurrencySymbolFromCode(currencyCode: string): string {
  const map: Record<string, string> = {
    USD: "$", ZAR: "R", KES: "KSh", NGN: "₦", GBP: "£",
    EUR: "€", JPY: "¥", CAD: "C$", AUD: "A$", INR: "₹",
    CNY: "¥", CHF: "CHF", SEK: "kr", NOK: "kr", DKK: "kr",
    PLN: "zł", RUB: "₽", BRL: "R$", MXN: "MX$", SGD: "S$",
    HKD: "HK$", NZD: "NZ$", KRW: "₩", TRY: "₺", AED: "د.إ",
    SAR: "﷼", ILS: "₪", THB: "฿", VND: "₫", IDR: "Rp",
    PHP: "₱", PKR: "₨", BDT: "৳", LKR: "Rs", NPR: "Rs",
    EGP: "E£", MAD: "DH", GHS: "₵",
  };
  return map[currencyCode] || currencyCode;
}

function getRequestCurrency(request: TimelineRequest | null): string {
  if (!request) return "USD";
  if (request.request_currency) return request.request_currency;
  if (request.invitee_currency) return request.invitee_currency;
  if (request.inviter_currency) return request.inviter_currency;
  return "USD";
}

function getStatusColor(type: string): string {
  const colors: Record<string, string> = {
    request_created: "#007AFF",
    request_viewed: "#5856D6",
    date_accepted: "#34C759",
    accepted: "#34C759",
    declined: "#FF3B30",
    payment_required: "#FF9500",
    invoice_generated: "#FF9500",
    payment_submitted: "#34C759",
    payment_made: "#34C759",
    payment_confirmed: "#34C759",
    payment_attempts: "#FF9500",
    started: "#34C759",
    end_requested: "#FF9500",
    end_approved: "#34C759",
    ended: "#FF3B30",
    completed: "#34C759",
  };
  return colors[type] || "#8E8E93";
}

function formatDateTime(timestamp?: string): string {
  if (!timestamp) return "Pending";
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

interface TimelineEvent {
  id: number;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  icon: string;
  color: string;
}

function enforceUltimateDataConsistency(requestData: TimelineRequest): TimelineRequest {
  const requestId = requestData.id;
  const normalized: TimelineRequest = { ...requestData };

  const hasCompleteData =
    normalized.completed_at &&
    normalized.payment_confirmed_at &&
    normalized.payment_submitted_at &&
    normalized.actual_start_time &&
    normalized.actual_end_time &&
    normalized.end_approved_at;

  if (hasCompleteData) {
    timelineDataStore[requestId] = { ...normalized };
  }

  const hasStoredCompleteData =
    timelineDataStore[requestId] &&
    (!normalized.completed_at ||
      !normalized.payment_confirmed_at ||
      !normalized.payment_submitted_at);

  if (hasStoredCompleteData) {
    const completeData = timelineDataStore[requestId];
    const criticalFields = [
      "completed_at", "payment_confirmed_at", "payment_submitted_at",
      "payment_made_at", "actual_start_time", "actual_end_time",
      "end_approved_at", "end_requested_at", "invoice_generated_at",
      "accepted_at", "payment_attempt_count", "payment_status",
      "started", "started_by", "in_progress", "in_progress_since",
    ] as const;

    criticalFields.forEach((field) => {
      if (completeData[field] && !normalized[field]) {
        (normalized as Record<string, unknown>)[field] = completeData[field];
      }
    });
  }

  const hasPaymentEvidence =
    normalized.status === "completed" ||
    normalized.payment_confirmed_at ||
    normalized.completed_at;

  if (hasPaymentEvidence) {
    if (!normalized.payment_status || normalized.payment_status === "pending") {
      normalized.payment_status = "completed";
    }
    if (!normalized.payment_attempt_count || normalized.payment_attempt_count === 0) {
      normalized.payment_attempt_count = 1;
    }
    if (normalized.status === "completed" && !normalized.completed_at) {
      normalized.completed_at = normalized.updated_at || new Date().toISOString();
    }
    if (normalized.status === "completed" && !normalized.payment_confirmed_at) {
      normalized.payment_confirmed_at = normalized.completed_at || normalized.updated_at;
    }
  }

  if ((!normalized.offer_amount || normalized.offer_amount === undefined) && normalized.offer?.price) {
    normalized.offer_amount = parseInt(normalized.offer.price) || 0;
  }

  if (!normalized.payment_status) normalized.payment_status = "pending";
  if (!normalized.payment_attempt_count && normalized.payment_attempt_count !== 0) {
    normalized.payment_attempt_count = 0;
  }
  if (normalized.payment_made_at && !normalized.payment_submitted_at) {
    normalized.payment_submitted_at = normalized.payment_made_at;
  }

  return normalized;
}

function getTimelineEvents(
  request: TimelineRequest,
  terminology: Terminology,
  currencySymbol: string
): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  const { base, capitalized } = terminology;

  const getOfferType = () => {
    const userType = request.invitee_user_type;
    switch (userType) {
      case "dating": return "Date Offer";
      case "service":
      case "professional": return "Service Offer";
      case "product": return "Product Offer";
      default: return "Offer";
    }
  };

  if (request.created_at) {
    events.push({
      id: 1, type: "request_created", icon: "📝",
      title: `${capitalized} Request Created`,
      description: `${request.inviter_username} created and sent ${base} request to ${request.invitee_username}`,
      timestamp: request.created_at, color: "#007AFF",
    });
  }
  if (request.viewed_at) {
    events.push({
      id: 2, type: "request_viewed", icon: "👁️",
      title: `${capitalized} Request Viewed`,
      description: `${request.invitee_username} viewed the ${base} request`,
      timestamp: request.viewed_at, color: "#5856D6",
    });
  }
  if (request.status === "accepted" || request.accepted_at) {
    events.push({
      id: 3, type: "date_accepted", icon: "✅",
      title: `${capitalized} Request Accepted`,
      description: `${request.invitee_username} accepted the ${base} request from ${request.inviter_username}`,
      timestamp: request.accepted_at || request.created_at || "",
      color: "#34C759",
    });
  }
  if (request.status === "declined" && request.declined_at) {
    events.push({
      id: 4, type: "declined", icon: "❌",
      title: `${capitalized} Declined`,
      description: `${request.invitee_username} declined the request: ${request.decline_reason || "No reason provided"}`,
      timestamp: request.declined_at, color: "#FF3B30",
    });
  }
  if (request.payment_required_at) {
    const paymentAmount = request.offer_amount || request.offer?.price || "0";
    const offerType = getOfferType();
    events.push({
      id: 5, type: "payment_required", icon: "💳",
      title: offerType,
      description: `${offerType} of ${currencySymbol}${paymentAmount} was made`,
      timestamp: request.payment_required_at, color: "#FF9500",
    });
  }
  if (request.actual_start_time) {
    events.push({
      id: 13, type: "started", icon: "▶️",
      title: `${capitalized} Started`,
      description: `${capitalized} started by ${request.started_by === request.inviter_id ? request.inviter_username : request.invitee_username}`,
      timestamp: request.actual_start_time, color: "#34C759",
    });
  }
  if (request.end_requested_at) {
    events.push({
      id: 15, type: "end_requested", icon: "🚩",
      title: "End Requested",
      description: `${request.end_requested_by === request.inviter_id ? request.inviter_username : request.invitee_username} requested to end`,
      timestamp: request.end_requested_at, color: "#FF9500",
    });
  }
  if (request.end_approved_at) {
    events.push({
      id: 16, type: "end_approved", icon: "✅",
      title: "End Approved",
      description: "End request was approved",
      timestamp: request.end_approved_at, color: "#34C759",
    });
  }
  if (request.actual_end_time) {
    events.push({
      id: 18, type: "ended", icon: "⏹️",
      title: `${capitalized} Ended`,
      description: `${capitalized} was officially ended`,
      timestamp: request.actual_end_time, color: "#FF3B30",
    });
  }
  if (request.invoice_generated_at) {
    const invoiceAmount =
      request.invoice_data?.amount || request.offer_amount || request.offer?.price || "0";
    events.push({
      id: 6, type: "invoice_generated", icon: "📄",
      title: "Invoice Generated",
      description: `Invoice created for ${currencySymbol}${invoiceAmount}`,
      timestamp: request.invoice_generated_at, color: "#FF9500",
    });
  }
  if (request.payment_submitted_at) {
    const submittedBy = request.payment_made_by === request.inviter_id ? request.inviter_username : request.invitee_username;
    events.push({
      id: 7, type: "payment_submitted", icon: "☁️",
      title: "Payment Proof Submitted",
      description: `${submittedBy} submitted payment proof`,
      timestamp: request.payment_submitted_at, color: "#34C759",
    });
  }
  if (request.payment_made_at && !request.payment_submitted_at) {
    const paidBy = request.payment_made_by === request.inviter_id ? request.inviter_username : request.invitee_username;
    events.push({
      id: 8, type: "payment_made", icon: "💳",
      title: "Payment Submitted",
      description: `${paidBy} submitted payment`,
      timestamp: request.payment_made_at, color: "#34C759",
    });
  }
  if (request.payment_confirmed_at) {
    events.push({
      id: 11, type: "payment_confirmed", icon: "✔️",
      title: "Payment Confirmed",
      description: `${request.payment_confirmed_by === request.inviter_id ? request.inviter_username : request.invitee_username} confirmed payment`,
      timestamp: request.payment_confirmed_at, color: "#34C759",
    });
  }
  if (request.payment_attempt_count && request.payment_attempt_count > 0) {
    events.push({
      id: 19, type: "payment_attempts", icon: "🔁",
      title: "Payment Attempts",
      description: `Total payment attempts: ${request.payment_attempt_count}`,
      timestamp: request.last_payment_attempt_at || request.updated_at || "",
      color: "#FF9500",
    });
  }
  if (request.status === "completed" && request.completed_at) {
    events.push({
      id: 24, type: "completed", icon: "🏆",
      title: `${capitalized} Completed`,
      description: `${capitalized} has been fully completed and closed`,
      timestamp: request.completed_at, color: "#34C759",
    });
  }

  return events.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

export default function TimelinePage() {
  const router = useRouter();
  const [request, setRequest] = useState<TimelineRequest | null>(null);
  const [terminology, setTerminology] = useState<Terminology | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("timelineRequest");
    const rawTerm = sessionStorage.getItem("timelineTerminology");
    if (!raw || !rawTerm) {
      router.back();
      return;
    }
    try {
      const parsedRequest = JSON.parse(raw) as TimelineRequest;
      const parsedTerm = JSON.parse(rawTerm) as Terminology;
      setRequest(enforceUltimateDataConsistency(parsedRequest));
      setTerminology(parsedTerm);
      setMounted(true);
    } catch {
      router.back();
    }
  }, [router]);

  if (!mounted || !request || !terminology) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F2F2F7]">
        <p className="text-[#666]">Loading timeline…</p>
      </div>
    );
  }

  const requestCurrencyCode = getRequestCurrency(request);
  const currencySymbol = getCurrencySymbolFromCode(requestCurrencyCode);
  const timelineEvents = getTimelineEvents(request, terminology, currencySymbol);

  const paymentSummary =
    request.offer_amount && request.offer_amount !== 0
      ? {
          label: "Payment",
          value: `${currencySymbol}${request.offer_amount} - ${
            request.payment_status || "Pending"
          }`,
          status: request.payment_status,
        }
      : null;

  return (
    <div className="flex flex-col min-h-screen bg-[#F2F2F7]">
      {/* Header */}
      <div className="flex flex-row justify-between items-center px-4 py-3 bg-white border-b border-[#E5E5EA] sticky top-0 z-10">
        <button
          onClick={() => router.back()}
          className="text-[#007AFF] text-[24px] p-1 active:opacity-70"
        >
          ←
        </button>
        <h1 className="text-[17px] font-semibold text-black">
          {terminology.capitalized} Timeline
        </h1>
        <div className="w-9" />
      </div>

      {/* Summary card */}
      <div className="m-4 p-4 bg-white rounded-xl shadow">
        <h2 className="text-[18px] font-semibold text-black mb-3">
          {terminology.capitalized} Details
        </h2>

        {[
          { label: "From:", value: request.inviter_username },
          { label: "To:", value: request.invitee_username },
          { label: "Currency:", value: `${requestCurrencyCode} (${currencySymbol})` },
          ...(paymentSummary
            ? [{ label: `${paymentSummary.label}:`, value: paymentSummary.value, color: paymentSummary.status === "completed" ? "#34C759" : paymentSummary.status === "rejected" ? "#FF3B30" : "#FF9500" }]
            : []),
          ...(request.offer
            ? [
                { label: "Description:", value: request.offer.description || "—" },
                { label: "Location:", value: request.offer.location || "—" },
                ...(parseFloat(request.offer.price || "0") > 0
                  ? [{ label: "Offer Price:", value: `${currencySymbol}${request.offer.price}` }]
                  : []),
              ]
            : []),
          { label: "Total Events:", value: String(timelineEvents.length) },
        ].map((row, idx) => (
          <div
            key={idx}
            className="flex justify-between items-center py-1.5 border-b border-[#F2F2F7] last:border-b-0"
          >
            <span className="text-[14px] text-[#8E8E93] font-medium">{row.label}</span>
            <span
              className="text-[14px] text-black text-right flex-1 ml-2"
              style={{ color: row.color || "#000" }}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div className="flex-1 px-4 pb-10 overflow-y-auto">
        <h2 className="text-[20px] font-bold text-black mb-4">Activity Timeline</h2>

        {timelineEvents.map((event, index) => (
          <div key={`${event.id}-${event.type}-${index}`} className="flex flex-row mb-6">
            <div className="flex flex-col items-center mr-4">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-[18px] z-[2]"
                style={{ backgroundColor: getStatusColor(event.type) }}
              >
                {event.icon}
              </div>
              {index < timelineEvents.length - 1 && (
                <div className="w-[2px] flex-1 bg-[#E5E5EA] mt-2 min-h-[40px]" />
              )}
            </div>
            <div className="flex-1 pb-2">
              <p className="text-[16px] font-semibold text-black mb-1">{event.title}</p>
              <p className="text-[14px] text-[#8E8E93] mb-1 leading-[18px]">
                {event.description}
              </p>
              <p className="text-[12px] font-medium text-[#C7C7CC]">
                {formatDateTime(event.timestamp)}
              </p>
            </div>
          </div>
        ))}

        {timelineEvents.length === 0 && (
          <div className="py-12 flex flex-col items-center">
            <span className="text-[48px] text-[#8E8E93]">🕒</span>
            <p className="text-[16px] text-[#8E8E93] mt-3 text-center">
              No timeline events available
            </p>
            <p className="text-[14px] text-[#C7C7CC] mt-2 text-center">
              Timeline events will appear as the {terminology.base} progresses
            </p>
          </div>
        )}
      </div>
    </div>
  );
}