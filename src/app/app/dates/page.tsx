"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DeclineReasonModal from "@/components/DeclineReasonModal";
import InvoiceBillingScreen from "@/components/InvoiceBillingScreen";
import PaymentProofModal from "@/components/PaymentProofModal";
import { dateAPI, userAPI, type User } from "@/services/api";
import { getCurrentUser } from "@/lib/auth";

interface DateRequest {
  id: number;
  inviter_id: number;
  invitee_id: number;
  inviter_username?: string;
  inviter_age?: number;
  inviter_photos?: string[];
  inviter_currency?: string | null;
  inviter_country?: string | null;
  inviter_user_type?: string;
  invitee_username?: string;
  invitee_age?: number;
  invitee_photos?: string[];
  invitee_currency?: string | null;
  invitee_country?: string | null;
  invitee_user_type?: string;
  request_currency?: string;
  offer?: { description?: string; price?: string; location?: string; dateTime?: string };
  offer_amount?: number;
  status?: string;
  decline_reason?: string;
  created_at?: string;
  updated_at?: string;
  pending_end_request?: boolean;
  end_requested_by?: number | null;
  started?: boolean;
  started_by?: number | null;
  confirmed?: boolean;
  in_progress?: boolean;
  payment_status?: string;
  invoice_data?: { amount?: string; currency?: string };
  [key: string]: unknown;
}

function getFullImageUrl(path?: string): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `https://api-v1.consentus.online${path}`;
}

function getCurrencySymbolFromCode(code?: string): string {
  const map: Record<string, string> = {
    USD: "$", ZAR: "R", KES: "KSh", NGN: "₦", GBP: "£", EUR: "€",
    JPY: "¥", CAD: "C$", AUD: "A$", INR: "₹", CNY: "¥", CHF: "CHF",
    SEK: "kr", NOK: "kr", DKK: "kr", PLN: "zł", RUB: "₽", BRL: "R$",
    MXN: "MX$", SGD: "S$", HKD: "HK$", NZD: "NZ$", KRW: "₩", TRY: "₺",
    AED: "د.إ", SAR: "﷼", ILS: "₪", THB: "฿", VND: "₫", IDR: "Rp",
    PHP: "₱", PKR: "₨", BDT: "৳", LKR: "Rs", NPR: "Rs", EGP: "E£",
    MAD: "DH", GHS: "₵",
  };
  return map[code || "USD"] || "$";
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

interface ButtonInfo {
  text: string;
  style: string;
  onPress: (() => void) | null;
  enabled: boolean;
  visible: boolean;
}

export default function DatesPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<"requests" | "active" | "history">("requests");
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [dateRequests, setDateRequests] = useState<DateRequest[]>([]);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [dateProgress, setDateProgress] = useState<
    Record<number, { started: boolean; startedBy: number | null; confirmed: boolean; inProgress: boolean }>
  >({});
  const [localButtonStates, setLocalButtonStates] = useState<Record<number, string>>({});
  const [pendingEndConfirmations, setPendingEndConfirmations] = useState<Record<number, boolean>>({});

  // Modals
  const [declineModalVisible, setDeclineModalVisible] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [paymentProofModalVisible, setPaymentProofModalVisible] = useState(false);
  const [selectedPaymentProof, setSelectedPaymentProof] = useState<Record<string, unknown> | null>(null);
  const [selectedPaymentProofRequestId, setSelectedPaymentProofRequestId] = useState<number | null>(null);

  const [invoiceRequest, setInvoiceRequest] = useState<DateRequest | null>(null);
  const [invoiceOtherUser, setInvoiceOtherUser] = useState<User | null>(null);

  const isSubmittingRef = useRef(false);

  // Boot
  useEffect(() => {
    const cu = getCurrentUser();
    if (!cu) {
      router.replace("/");
      return;
    }
    setCurrentUser(cu);
    setMounted(true);
  }, [router]);

  useEffect(() => {
    if (!currentUser) return;
    fetchUserProfile();
    fetchAllDateRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  async function fetchUserProfile() {
    if (!currentUser) return;
    try {
      const response = await userAPI.getProfile(currentUser.id);
      if (response.data) setUserProfile(response.data as User);
    } catch (e) {
      console.error("Profile fetch error:", e);
    }
  }

  const userAvailability =
    userProfile?.user_type !== "dormant" && userProfile?.is_available !== false;

  async function fetchAllDateRequests() {
    if (!currentUser) return;
    setLoading(true);
    try {
      const receivedResponse = await dateAPI.getPendingRequests(currentUser.id);
      const receivedRequests: DateRequest[] =
        receivedResponse.data?.requests || receivedResponse.data || [];

      let sentRequests: DateRequest[] = [];
      try {
        const sentResponse = await dateAPI.getSentRequests(currentUser.id);
        sentRequests = sentResponse.data?.requests || sentResponse.data || [];
      } catch {
        sentRequests = [];
      }

      const allRequests = [...receivedRequests, ...sentRequests];

      const enhanced: DateRequest[] = await Promise.all(
        allRequests.map(async (request) => {
          try {
            const [inviteeRes, inviterRes] = await Promise.all([
              userAPI.getProfile(request.invitee_id),
              userAPI.getProfile(request.inviter_id),
            ]);
            const invitee = inviteeRes.data as User;
            const inviter = inviterRes.data as User;
            return {
              ...request,
              pending_end_request: request.pending_end_request || false,
              end_requested_by: request.end_requested_by ?? null,
              invitee_user_type: request.invitee_user_type || invitee?.user_type || "dating",
              inviter_user_type: request.inviter_user_type || inviter?.user_type || "dating",
              invitee_country: invitee?.country || null,
              inviter_country: inviter?.country || null,
              invitee_currency: (invitee as { currency?: string })?.currency || null,
              inviter_currency: (inviter as { currency?: string })?.currency || null,
              request_currency:
                request.request_currency ||
                (invitee as { currency?: string })?.currency ||
                "USD",
            };
          } catch {
            return {
              ...request,
              pending_end_request: request.pending_end_request || false,
              end_requested_by: request.end_requested_by ?? null,
              invitee_user_type: request.invitee_user_type || "dating",
              inviter_user_type: request.inviter_user_type || "dating",
              request_currency: request.request_currency || "USD",
            };
          }
        })
      );

      const unique = enhanced.filter(
        (r, i, arr) => i === arr.findIndex((x) => x.id === r.id)
      );
      setDateRequests(unique);

      const progressUpdates: typeof dateProgress = {};
      unique.forEach((req) => {
        if (req.status === "accepted") {
          progressUpdates[req.id] = {
            started: Boolean(req.started),
            startedBy: req.started_by ?? null,
            confirmed: Boolean(req.confirmed),
            inProgress: Boolean(req.in_progress),
          };
        }
      });
      setDateProgress(progressUpdates);
    } catch (e) {
      console.error("Fetch dates error:", e);
      window.alert("Error: Failed to load date requests");
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await fetchAllDateRequests();
      await fetchUserProfile();
    } finally {
      setIsRefreshing(false);
    }
  }

  const getTerminology = (request: DateRequest): Terminology => {
    const t = request.invitee_user_type || "dating";
    if (t === "professional") {
      return { base: "service", capitalized: "Service", plural: "services",
        activity: "service", offer: "Service offer", request: "service request", history: "service history" };
    }
    if (t === "product") {
      return { base: "product", capitalized: "Product", plural: "products",
        activity: "product", offer: "Product offer", request: "product request", history: "product history" };
    }
    return { base: "date", capitalized: "Date", plural: "dates",
      activity: "date", offer: "Date offer", request: "date request", history: "date history" };
  };

  const getCurrencyForRequest = (request: DateRequest): string => {
    return getCurrencySymbolFromCode(request.request_currency);
  };

  // ---------- Accept / Decline ----------
  async function handleAcceptRequest(requestId: number) {
    if (!userAvailability) {
      window.alert("Unavailable: Please toggle your availability back on to interact with date and service requests.");
      return;
    }
    try {
      await dateAPI.respondToRequest(requestId, { response: "accept" });
      const request = dateRequests.find((r) => r.id === requestId);
      const term = request ? getTerminology(request) : { plural: "dates/services" };
      window.alert(`Request Accepted! 🎉 The request has been moved to your active ${term.plural}.`);
      await fetchAllDateRequests();
    } catch {
      window.alert("Error: Failed to accept date request");
    }
  }

  async function handleDeclineRequest(requestId: number, reason: string) {
    if (!userAvailability) {
      window.alert("Unavailable: Please toggle your availability back on to interact with date and service requests.");
      return;
    }
    try {
      await dateAPI.respondToRequest(requestId, {
        response: "decline",
        decline_reason: reason,
      });
      window.alert("Request Declined: Maybe next time!");
      await fetchAllDateRequests();
    } catch {
      window.alert("Error: Failed to decline date request");
    }
  }

  function showDeclineModal(requestId: number) {
    setSelectedRequestId(requestId);
    setDeclineModalVisible(true);
  }

  function handleReasonSelect(reason: string) {
    setDeclineModalVisible(false);
    if (selectedRequestId) handleDeclineRequest(selectedRequestId, reason);
  }

  // ---------- Start / Confirm / End ----------
  async function handleStart(requestId: number, isInviter: boolean) {
    if (!userAvailability) {
      window.alert("Unavailable: Please toggle your availability back on to interact with dates and services.");
      return;
    }
    const current = dateProgress[requestId] || { started: false, startedBy: null, confirmed: false, inProgress: false };
    try {
      if (!current.started && !current.confirmed) {
        setDateProgress((prev) => ({
          ...prev,
          [requestId]: { started: true, startedBy: currentUser!.id, confirmed: false, inProgress: false },
        }));
        await dateAPI.startDate(requestId, currentUser!.id);
        window.alert("Started! Waiting for the other person to confirm...");
        setTimeout(fetchAllDateRequests, 500);
      } else if (current.started && !current.confirmed && current.startedBy !== currentUser!.id) {
        setDateProgress((prev) => ({
          ...prev,
          [requestId]: { ...current, confirmed: true, inProgress: true },
        }));
        await dateAPI.confirmDate(requestId, currentUser!.id);
        window.alert("Confirmed! The date is now in progress!");
        setTimeout(fetchAllDateRequests, 500);
      } else if (current.started && current.confirmed && current.inProgress) {
        const req = dateRequests.find((r) => r.id === requestId);
        if (req?.invoice_data && req.payment_status === "pending") {
          openInvoiceForRequest(req);
          return;
        }
        await dateAPI.requestEndDate(requestId, currentUser!.id);
        window.alert("End Request Sent: Waiting for the other person to confirm.");
        setTimeout(fetchAllDateRequests, 500);
      }
    } catch (e) {
      console.error("handleStart error:", e);
      window.alert("Error: Failed to update status");
    }
  }

  // ---------- Invoice / Payment ----------
  function openInvoiceForRequest(request: DateRequest) {
    const isInviter = request.inviter_id === currentUser!.id;
    const otherId = isInviter ? request.invitee_id : request.inviter_id;
    const otherName = isInviter ? request.invitee_username : request.inviter_username;
    const otherAge = isInviter ? request.invitee_age : request.inviter_age;
    const otherPhotos = isInviter ? request.invitee_photos : request.inviter_photos;
    setInvoiceRequest(request);
    setInvoiceOtherUser({
      id: otherId,
      username: otherName || "User",
      age: otherAge,
      photos: otherPhotos || [],
    } as User);
  }

  async function handleViewPaymentProof(request: DateRequest) {
    try {
      const response = await dateAPI.getPaymentProof(request.id, currentUser!.id);
      if (response.data?.proof_of_payment) {
        setSelectedPaymentProof(response.data as Record<string, unknown>);
        setSelectedPaymentProofRequestId(request.id);
        setPaymentProofModalVisible(true);
      } else {
        window.alert("No Proof Available: No payment proof has been submitted yet.");
      }
    } catch {
      window.alert("Error: Failed to load payment proof.");
    }
  }

  async function handleConfirmPayment(request: DateRequest) {
    try {
      await dateAPI.confirmPayment(request.id, {
        user_id: currentUser!.id,
        confirmed_at: new Date().toISOString(),
      });
      const term = getTerminology(request);
      window.alert(`Payment Confirmed! Transaction completed! This ${term.activity} has been moved to history.`);
      setTimeout(fetchAllDateRequests, 1000);
    } catch {
      window.alert("Error: Failed to confirm payment.");
    }
  }

  async function handleRejectPaymentProof(request: DateRequest) {
    if (!window.confirm("Reject Payment Proof: Are you sure? This will reset the date back to 'End Request Pending' status.")) return;
    try {
      await dateAPI.rejectPaymentProof(request.id, {
        user_id: currentUser!.id,
        reason: "Payment proof rejected by payee",
      });
      window.alert("Payment Proof Rejected: The date has been reset to 'End Request Pending' status.");
      setPaymentProofModalVisible(false);
      setSelectedPaymentProof(null);
      setTimeout(fetchAllDateRequests, 1000);
    } catch {
      window.alert("Error: Failed to reject payment proof.");
    }
  }

  async function handleRequestEnd(request: DateRequest, isInviter: boolean) {
    setLocalButtonStates((prev) => ({ ...prev, [request.id]: "awaiting_end_confirmation" }));
    try {
      await dateAPI.requestEndDate(request.id, currentUser!.id);
      window.alert("End Request Sent: Waiting for the other person to confirm the end request.");
      setTimeout(fetchAllDateRequests, 1000);
    } catch {
      setLocalButtonStates((prev) => {
        const next = { ...prev };
        delete next[request.id];
        return next;
      });
      window.alert("Error: Failed to send end request");
    }
  }

  async function handleConfirmEnd(request: DateRequest, isInviter: boolean) {
    setPendingEndConfirmations((prev) => ({ ...prev, [request.id]: true }));
    setLocalButtonStates((prev) => ({ ...prev, [request.id]: "awaiting_payment_confirmation" }));
    try {
      const res = await dateAPI.confirmEndDate(request.id, currentUser!.id);
      if (res.data?.requires_payment) {
        const term = getTerminology(request);
        window.alert(`${term.capitalized} Ended: Invoice generated. Please proceed with payment.`);
        openInvoiceForRequest(request);
      } else {
        window.alert("Completed!");
        setTimeout(fetchAllDateRequests, 3000);
      }
    } catch {
      setPendingEndConfirmations((prev) => {
        const next = { ...prev };
        delete next[request.id];
        return next;
      });
      window.alert("Error: Failed to confirm end");
    }
  }

  // ---------- Buttons ----------
  const getButtonInfo = (request: DateRequest, isInviter: boolean): ButtonInfo | ButtonInfo[] => {
    const progress = dateProgress[request.id] || { started: false, startedBy: null, confirmed: false, inProgress: false };
    const term = getTerminology(request);

    if (localButtonStates[request.id] === "awaiting_end_confirmation" && !pendingEndConfirmations[request.id]) {
      return { text: "Waiting for Confirmation...", style: "bg-[#8E8E93] text-white", onPress: null, enabled: false, visible: true };
    }

    if ((pendingEndConfirmations[request.id] || localButtonStates[request.id] === "awaiting_payment_confirmation") && isInviter) {
      return { text: "Awaiting POP Confirmation", style: "bg-[#8E8E93] text-white", onPress: null, enabled: false, visible: true };
    }

    if (request.payment_status === "payment_submitted") {
      if (!isInviter) {
        return [
          { text: "View Proof of Payment", style: "bg-[#007AFF] text-white", onPress: () => handleViewPaymentProof(request), enabled: true, visible: true },
          { text: "Payment Received", style: "bg-[#34C759] text-white", onPress: () => handleConfirmPayment(request), enabled: true, visible: true },
          { text: "Reject Proof of Payment", style: "bg-[#FF3B30] text-white", onPress: () => handleRejectPaymentProof(request), enabled: true, visible: true },
        ];
      }
      return { text: "Payment Submitted - Waiting Confirmation", style: "bg-[#8E8E93] text-white", onPress: null, enabled: false, visible: true };
    }

    if ((request.payment_status === "rejected" || (request.payment_status === "pending" && request.pending_end_request)) &&
        localButtonStates[request.id] !== "awaiting_payment_confirmation") {
      if (isInviter) {
        return {
          text: `Confirm End ${term.capitalized}`,
          style: "bg-black text-white",
          onPress: () => handleConfirmEnd(request, isInviter),
          enabled: true,
          visible: true,
        };
      }
      return { text: "Waiting for Confirmation...", style: "bg-[#8E8E93] text-white", onPress: null, enabled: false, visible: true };
    }

    if (request.invoice_data && request.payment_status === "pending" && !request.in_progress) {
      if (isInviter) {
        return { text: "View Invoice & Pay", style: "bg-[#FF9500] text-white", onPress: () => openInvoiceForRequest(request), enabled: true, visible: true };
      }
      return { text: "Awaiting Payment", style: "bg-[#8E8E93] text-white", onPress: null, enabled: false, visible: true };
    }

    if (request.status === "completed") {
      return { text: `${term.capitalized} Ended`, style: "bg-[#8E8E93] text-white", onPress: null, enabled: false, visible: true };
    }

    if (progress.inProgress) {
      if (request.pending_end_request) {
        if (isInviter) {
          return {
            text: `Confirm End ${term.capitalized}`,
            style: "bg-black text-white",
            onPress: () => handleConfirmEnd(request, isInviter),
            enabled: true,
            visible: true,
          };
        }
        return { text: "Waiting for Confirmation...", style: "bg-[#8E8E93] text-white", onPress: null, enabled: false, visible: true };
      }
      if (!isInviter) {
        return { text: `Request to End ${term.capitalized}`, style: "bg-[#FF3B30] text-white", onPress: () => handleRequestEnd(request, isInviter), enabled: true, visible: true };
      }
      return { text: `${term.capitalized} in Progress`, style: "bg-[#8E8E93] text-white", onPress: null, enabled: false, visible: true };
    }

    if (progress.started === false || progress.startedBy === null) {
      return { text: `Start ${term.capitalized}`, style: "bg-[#34C759] text-white", onPress: () => handleStart(request.id, isInviter), enabled: true, visible: true };
    }
    if (progress.started === true && progress.confirmed === false) {
      if (progress.startedBy === currentUser!.id) {
        return { text: "Waiting for Confirmation...", style: "bg-[#8E8E93] text-white", onPress: null, enabled: false, visible: true };
      }
      return { text: "Confirm Start", style: "bg-[#FF9500] text-white", onPress: () => handleStart(request.id, isInviter), enabled: true, visible: true };
    }

    return { text: `Start ${term.capitalized}`, style: "bg-[#34C759] text-white", onPress: () => handleStart(request.id, isInviter), enabled: true, visible: true };
  };

  // ---------- Status helpers ----------
  const getStatusText = (request: DateRequest): string => {
    const progress = dateProgress[request.id] || { started: false, confirmed: false, inProgress: false };
    const term = getTerminology(request);
    if (request.payment_status === "payment_submitted") return "Payment Confirmation";
    if (request.payment_status === "rejected") return "Payment Proof Rejected";
    if (request.status === "completed") return `${term.capitalized} Ended`;
    if (progress.inProgress) {
      return request.pending_end_request ? "End Request Pending" : `${term.capitalized} in Progress`;
    }
    if (progress.started && !progress.confirmed) return "Waiting to Start";
    return "Confirmed";
  };

  const getStatusEmoji = (request: DateRequest): string => {
    const progress = dateProgress[request.id] || { started: false, confirmed: false, inProgress: false };
    if (request.payment_status === "payment_submitted") return "💰";
    if (request.payment_status === "rejected") return "❌";
    if (request.status === "completed") {
      const term = getTerminology(request);
      return term.base === "service" ? "🔧" : term.base === "product" ? "📦" : "🎉";
    }
    if (progress.inProgress) return request.pending_end_request ? "⏳" : "🟢";
    if (progress.started && !progress.confirmed) return "🟡";
    const term = getTerminology(request);
    return term.base === "service" ? "🔧" : term.base === "product" ? "📦" : "🎉";
  };

  // ---------- Derived lists ----------
  const pendingRequests = dateRequests.filter((r) => r.status === "pending");
  const activeDates = dateRequests.filter((r) => r.status === "accepted");
  const declinedRequests = dateRequests.filter((r) => r.status === "declined");
  const completedDates = dateRequests.filter((r) => r.status === "completed");

  // ---------- Timeline navigation ----------
  function handleViewTimeline(request: DateRequest) {
    sessionStorage.setItem("timelineRequest", JSON.stringify(request));
    sessionStorage.setItem("timelineTerminology", JSON.stringify(getTerminology(request)));
    router.push("/app/timeline");
  }

  // ---------- Rating navigation ----------
  function handleRateRequest(request: DateRequest) {
    sessionStorage.setItem(
      "ratingState",
      JSON.stringify({
        requestId: request.id,
        ratedUserId: request.invitee_id,
        ratedUserName: request.invitee_username || "User",
        offerType: request.invitee_user_type === "professional" ? "service" : "product",
      })
    );
    router.push("/app/rating");
  }

  // ---------- Chat navigation ----------
  function handleStartChat(request: DateRequest) {
    if (!userAvailability) {
      window.alert("Unavailable: Please toggle your availability back on.");
      return;
    }
    const isInviter = request.inviter_id === currentUser!.id;

    const otherUser = {
      id: isInviter ? request.invitee_id : request.inviter_id,
      username: (isInviter ? request.invitee_username : request.inviter_username) || "User",
      age: isInviter ? request.invitee_age : request.inviter_age,
      photos: (isInviter ? request.invitee_photos : request.inviter_photos) || [],
      user_type: (isInviter ? request.invitee_user_type : request.inviter_user_type) || "dating",
    };

    // ✅ FIX: Use the exact shape Chat expects ({ user, dateInfo, status })
    sessionStorage.setItem(
      "chatConversation",
      JSON.stringify({
        id: request.id,
        user: otherUser,
        dateInfo: {
          offer: request.offer,
          status: request.status,
          invitee_currency: request.invitee_currency,
          inviter_currency: request.inviter_currency,
          request_currency: request.request_currency,
        },
        status: request.status,
      })
    );

    router.push(`/app/chat/${request.id}`);
  }

  // ---------- Sub-renderers ----------
  function renderDateRequestCard(item: DateRequest) {
    const isInviter = item.inviter_id === currentUser!.id;
    const otherName = isInviter ? item.invitee_username : item.inviter_username;
    const otherAge = isInviter ? item.invitee_age : item.inviter_age;
    const otherPhoto = isInviter ? item.invitee_photos?.[0] : item.inviter_photos?.[0];
    const term = getTerminology(item);
    const currencySymbol = getCurrencyForRequest(item);

    return (
      <div
        key={item.id}
        className={`bg-white rounded-xl p-4 mb-3 shadow-sm ${
          !userAvailability ? "opacity-70 bg-[#F5F5F5]" : ""
        }`}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-[#E2E8F0] flex items-center justify-center shrink-0">
            {otherPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={getFullImageUrl(otherPhoto) || "https://picsum.photos/100/100"}
                alt={otherName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[20px] font-bold text-[#A0AEC0]">
                {otherName?.charAt(0)?.toUpperCase() || "?"}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[18px] font-bold text-[#FF6B6B] mb-1">
              {otherName}
              {otherAge ? `, ${otherAge}` : ""}
            </p>
            <p className="text-[14px] text-[#666]">
              Status: {item.status} • {isInviter ? "You invited" : "They invited you"}
            </p>
          </div>
        </div>

        <p className="text-[16px] font-semibold text-[#333] mb-2">
          {term.offer}:
        </p>
        <p className="text-[14px] text-[#666] mb-1 leading-5">
          {item.offer?.description || "No description"}
        </p>
        <p className="text-[14px] text-[#666] mb-1 leading-5">
          Location: {item.offer?.location || "Not specified"}
        </p>
        <p className="text-[14px] text-[#666] mb-1 leading-5">
          When: {item.offer?.dateTime || "Not specified"}
        </p>
        <p className="text-[14px] text-[#666] mb-1 leading-5">
          Price: {currencySymbol}
          {item.offer?.price || "0"}
        </p>

        {item.status === "declined" && item.decline_reason && (
          <div className="bg-[#FFF3CD] border-l-4 border-[#FFC107] rounded-lg p-3 mt-2">
            <p className="text-[14px] font-bold text-[#856404] mb-1">
              Decline Reason:
            </p>
            <p className="text-[14px] italic text-[#856404]">
              {item.decline_reason}
            </p>
          </div>
        )}

        {activeTab === "history" && item.status === "completed" && (
          <button
            onClick={() => handleViewTimeline(item)}
            className="w-full bg-[#F0F8FF] text-[#007AFF] text-[14px] font-medium rounded-lg py-2 mt-2 flex items-center justify-center gap-1 active:opacity-80"
          >
            ⏱️ View Timeline
          </button>
        )}

        {!userAvailability && (
          <div className="bg-[rgba(245,245,245,0.8)] rounded-xl p-3 mt-2 flex flex-col items-center">
            <span className="bg-[#FF6B6B] text-white text-[12px] font-bold px-3 py-1 rounded-full mb-2">
              UNAVAILABLE
            </span>
            <p className="text-[14px] text-[#666] text-center">
              Toggle availability back on to interact
            </p>
          </div>
        )}

        {item.status === "pending" && !isInviter ? (
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => handleAcceptRequest(item.id)}
              disabled={!userAvailability}
              className={`flex-1 py-3 rounded-lg text-white font-bold ${
                !userAvailability
                  ? "bg-[#CCC] cursor-not-allowed"
                  : "bg-[#4CAF50] active:opacity-80"
              }`}
            >
              {userAvailability ? "Accept" : "Unavailable"}
            </button>
            <button
              onClick={() => showDeclineModal(item.id)}
              disabled={!userAvailability}
              className={`flex-1 py-3 rounded-lg text-white font-bold ${
                !userAvailability
                  ? "bg-[#CCC] cursor-not-allowed"
                  : "bg-[#FF6B6B] active:opacity-80"
              }`}
            >
              {userAvailability ? "Decline" : "Unavailable"}
            </button>
          </div>
        ) : item.status === "pending" && isInviter ? (
          <p className="text-center text-[14px] font-bold text-[#FFA500] bg-[#FFF3CD] rounded-lg py-2 mt-3">
            ⏳ Waiting for response from {otherName}
          </p>
        ) : (
          <p
            className={`text-center font-bold text-[16px] py-2 mt-3 rounded-lg ${
              item.status === "accepted"
                ? "text-[#4CAF50] bg-[#E8F5E8]"
                : "text-[#FF6B6B] bg-[#FFE8E8]"
            }`}
          >
            {item.status?.toUpperCase()}
            {item.status === "declined" && item.decline_reason && ` • ${item.decline_reason}`}
          </p>
        )}
      </div>
    );
  }

  function renderHistoryCard(item: DateRequest) {
    const isInviter = item.inviter_id === currentUser!.id;
    const otherName = isInviter ? item.invitee_username : item.inviter_username;
    const otherAge = isInviter ? item.invitee_age : item.inviter_age;
    const otherPhoto = isInviter ? item.invitee_photos?.[0] : item.inviter_photos?.[0];
    const term = getTerminology(item);
    const currencySymbol = getCurrencyForRequest(item);
    const canRate =
      item.status === "completed" &&
      item.invitee_user_type !== "dating" &&
      isInviter;

    return (
      <div key={item.id} className="bg-white rounded-xl p-4 mb-3 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-[#E2E8F0] flex items-center justify-center shrink-0">
            {otherPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={getFullImageUrl(otherPhoto) || "https://picsum.photos/100/100"}
                alt={otherName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[20px] font-bold text-[#A0AEC0]">
                {otherName?.charAt(0)?.toUpperCase() || "?"}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[18px] font-bold text-[#FF6B6B] mb-1">
              {otherName}
              {otherAge ? `, ${otherAge}` : ""}
            </p>
            <p className="text-[14px] text-[#666]">
              {item.status === "completed" ? "COMPLETED" : "DECLINED"} •{" "}
              {isInviter ? "You invited" : "They invited you"}
            </p>
          </div>
        </div>

        <p className="text-[16px] font-semibold text-[#333] mb-2">
          {term.offer}:
        </p>
        <p className="text-[14px] text-[#666] mb-1 leading-5">
          {item.offer?.description || "No description"}
        </p>
        <p className="text-[14px] text-[#666] mb-1 leading-5">
          Location: {item.offer?.location || "Not specified"}
        </p>
        <p className="text-[14px] text-[#666] mb-1 leading-5">
          When: {item.offer?.dateTime || "Not specified"}
        </p>
        <p className="text-[14px] text-[#666] mb-1 leading-5">
          Price: {currencySymbol}
          {item.offer?.price || "0"}
        </p>

        {item.status === "declined" && item.decline_reason && (
          <div className="bg-[#FFF3CD] border-l-4 border-[#FFC107] rounded-lg p-3 mt-2">
            <p className="text-[14px] font-bold text-[#856404] mb-1">
              Decline Reason:
            </p>
            <p className="text-[14px] italic text-[#856404]">
              {item.decline_reason}
            </p>
          </div>
        )}

        {item.status === "completed" && (
          <button
            onClick={() => handleViewTimeline(item)}
            className="w-full bg-[#F0F8FF] text-[#007AFF] text-[14px] font-medium rounded-lg py-2 mt-2 flex items-center justify-center gap-1 active:opacity-80"
          >
            ⏱️ View Timeline
          </button>
        )}

        {canRate && (
          <button
            onClick={() => handleRateRequest(item)}
            className="w-full bg-[#FFF3E0] border border-[#FFB74D] text-[#FF9800] text-[14px] font-semibold rounded-lg py-3 mt-2 flex items-center justify-center gap-1 active:opacity-80"
          >
            ⭐ Rate {item.invitee_user_type === "professional" ? "Service" : "Product"}
          </button>
        )}

        {item.status === "completed" && (!isInviter || item.invitee_user_type === "dating") && (
          <div className="bg-[#E8F5E9] border border-[#81C784] rounded-lg py-3 mt-2 flex items-center justify-center">
            <span className="text-[14px] font-semibold text-[#2E7D32]">
              ✓ COMPLETED
            </span>
          </div>
        )}
      </div>
    );
  }

  function renderActiveCard(item: DateRequest) {
    const isInviter = item.inviter_id === currentUser!.id;
    const otherName = isInviter ? item.invitee_username : item.inviter_username;
    const otherAge = isInviter ? item.invitee_age : item.inviter_age;
    const otherPhoto = isInviter ? item.invitee_photos?.[0] : item.inviter_photos?.[0];
    const term = getTerminology(item);
    const currencySymbol = getCurrencyForRequest(item);
    const buttonInfo = getButtonInfo(item, isInviter);
    const statusText = getStatusText(item);
    const statusEmoji = getStatusEmoji(item);
    const isPaymentConfirmation = item.payment_status === "payment_submitted";

    return (
      <div
        key={item.id}
        className={`bg-white rounded-2xl p-5 mb-4 shadow ${
          !userAvailability ? "opacity-70 bg-[#F5F5F5]" : ""
        }`}
      >
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-[#E2E8F0] flex items-center justify-center shrink-0">
            {otherPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={getFullImageUrl(otherPhoto) || "https://picsum.photos/100/100"}
                alt={otherName}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[24px] font-bold text-[#A0AEC0]">
                {otherName?.charAt(0)?.toUpperCase() || "?"}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[18px] font-bold text-[#FF6B6B] mb-1">
              {otherName}
              {otherAge ? `, ${otherAge}` : ""}
            </p>
            <p className="text-[14px] font-semibold text-[#4CAF50]">
              {statusText} {statusEmoji}
            </p>
            <p className="text-[12px] italic text-[#666]">
              {isInviter ? "You invited them" : "They invited you"}
            </p>
          </div>
        </div>

        <p className="text-[16px] font-medium text-[#333] mb-2 leading-6">
          {item.offer?.description}
        </p>
        <p className="text-[14px] text-[#666] mb-1">
          {item.offer?.dateTime} • {item.offer?.location}
        </p>
        <p className="text-[14px] font-medium text-[#666] mb-4">
          Budget: {currencySymbol}
          {item.offer?.price || "0"}
        </p>

        {!userAvailability && (
          <div className="bg-[rgba(245,245,245,0.8)] rounded-xl p-3 mb-3 flex flex-col items-center">
            <span className="bg-[#FF6B6B] text-white text-[12px] font-bold px-3 py-1 rounded-full mb-2">
              UNAVAILABLE
            </span>
            <p className="text-[14px] text-[#666] text-center">
              Toggle availability back on to interact
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {!isPaymentConfirmation && (
            <button
              onClick={() => handleStartChat(item)}
              disabled={!userAvailability}
              className={`flex-1 min-h-[44px] rounded-lg text-white text-[12px] font-bold ${
                !userAvailability
                  ? "bg-[#CCC] cursor-not-allowed"
                  : "bg-[#6B46C1] active:opacity-80"
              }`}
            >
              {userAvailability ? "💬 Message" : "💬 Unavailable"}
            </button>
          )}
          {!isPaymentConfirmation && (
            <button
              onClick={() => {
                if (!userAvailability) {
                  window.alert("Unavailable: Please toggle your availability back on.");
                  return;
                }
                window.alert(
                  `${term.capitalized} with: ${otherName}\n\nPlan: ${item.offer?.description}\nWhen: ${item.offer?.dateTime}\nWhere: ${item.offer?.location}\nBudget: ${currencySymbol}${item.offer?.price || "0"}`
                );
              }}
              disabled={!userAvailability}
              className={`flex-1 min-h-[44px] rounded-lg bg-[#F7FAFC] border border-[#E2E8F0] text-[#6B46C1] text-[12px] font-bold ${
                !userAvailability ? "opacity-50 cursor-not-allowed" : "active:opacity-80"
              }`}
            >
              {userAvailability ? "View Details" : "Unavailable"}
            </button>
          )}

          {Array.isArray(buttonInfo)
            ? buttonInfo.map(
                (btn, idx) =>
                  btn.visible && (
                    <button
                      key={idx}
                      onClick={() => {
                        if (btn.onPress) btn.onPress();
                      }}
                      disabled={!btn.enabled || !userAvailability}
                      className={`flex-1 min-h-[44px] rounded-lg text-[12px] font-bold ${btn.style} ${
                        !btn.enabled || !userAvailability ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                    >
                      {userAvailability ? btn.text : "Unavailable"}
                    </button>
                  )
              )
            : buttonInfo.visible && (
                <button
                  onClick={() => {
                    if (buttonInfo.onPress) buttonInfo.onPress();
                  }}
                  disabled={!buttonInfo.enabled || !userAvailability}
                  className={`flex-1 min-h-[44px] rounded-lg text-[12px] font-bold ${buttonInfo.style} ${
                    !buttonInfo.enabled || !userAvailability ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {userAvailability ? buttonInfo.text : "Unavailable"}
                </button>
              )}
        </div>
      </div>
    );
  }

  // ---------- Loading state ----------
  if (!mounted || !currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA]">
        <p className="text-[#666]">Loading…</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-[#F8F9FA]">
        <div className="flex flex-row justify-between items-center px-5 pt-[60px] pb-5 bg-white border-b border-[#E2E8F0]">
          <button
            onClick={() => router.back()}
            className="text-[#6B46C1] text-[16px] font-semibold"
          >
            ← Back
          </button>
          <h1 className="text-[20px] font-bold text-[#2D3748]">D/S/P</h1>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="text-[#6B46C1] text-[24px] p-1"
          >
            🔄
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center">
          <p className="text-[#FF6B6B] font-semibold">Loading your dates and services…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F9FA]">
      {/* Header */}
      <div className="flex flex-row justify-between items-center px-5 pt-[60px] pb-5 bg-white border-b border-[#E2E8F0]">
        <button
          onClick={() => router.back()}
          className="text-[#6B46C1] text-[16px] font-semibold active:opacity-70"
        >
          ← Back
        </button>
        <h1 className="text-[20px] font-bold text-[#2D3748]">D/S/P</h1>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="text-[#6B46C1] text-[24px] p-1 active:opacity-70 disabled:opacity-40"
        >
          {isRefreshing ? "⏳" : "🔄"}
        </button>
      </div>

      {/* Availability banner */}
      {!userAvailability && userProfile && (
        <div className="bg-[#FFF3CD] border-l-4 border-[#FFC107] p-3 mx-4 mt-2 mb-2 rounded-lg">
          <p className="text-[#856404] text-[14px] font-medium text-center">
            {userProfile.user_type === "dormant"
              ? "🔒 Your account is dormant. You are hidden from discovery and all date and service activities are frozen."
              : "⚠️ You are currently not available for dates and services. All requests are frozen."}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-row bg-white border-b border-[#E2E8F0] px-2">
        {[
          { key: "requests", label: `Requests (${pendingRequests.length})` },
          { key: "active", label: `Active (${activeDates.length})` },
          {
            key: "history",
            label: `History (${declinedRequests.length + completedDates.length})`,
          },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`flex-1 py-4 text-center border-b-[3px] transition-colors ${
              activeTab === tab.key
                ? "border-[#FF6B6B]"
                : "border-transparent"
            }`}
          >
            <span
              className={`text-[14px] ${
                activeTab === tab.key
                  ? "text-[#FF6B6B] font-bold"
                  : "text-[#718096] font-medium"
              }`}
            >
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-4">
        {activeTab === "requests" && (
          <>
            {pendingRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6">
                <p className="text-[18px] text-[#666] mb-2 text-center">
                  No pending requests
                </p>
                <p className="text-[14px] text-[#999] text-center leading-5">
                  When someone asks you out or invites you to a service, you&apos;ll see it here!
                </p>
              </div>
            ) : (
              pendingRequests.map(renderDateRequestCard)
            )}
          </>
        )}

        {activeTab === "active" && (
          <>
            {activeDates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6">
                <p className="text-[18px] text-[#666] mb-2 text-center">
                  No active dates or services yet
                </p>
                <p className="text-[14px] text-[#999] text-center leading-5">
                  Accepted date and service requests will appear here!
                </p>
              </div>
            ) : (
              activeDates.map(renderActiveCard)
            )}
          </>
        )}

        {activeTab === "history" && (
          <>
            {declinedRequests.length === 0 && completedDates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6">
                <p className="text-[18px] text-[#666] mb-2 text-center">
                  No date or service history
                </p>
                <p className="text-[14px] text-[#999] text-center leading-5">
                  Declined or completed dates and services will appear here.
                </p>
              </div>
            ) : (
              [...declinedRequests, ...completedDates].map(renderHistoryCard)
            )}
          </>
        )}
      </main>

      {/* Modals */}
      <DeclineReasonModal
        visible={declineModalVisible}
        onClose={() => setDeclineModalVisible(false)}
        onReasonSelect={handleReasonSelect}
      />

      <PaymentProofModal
        visible={paymentProofModalVisible}
        paymentProof={selectedPaymentProof as never}
        requestCurrency={
          dateRequests.find((r) => r.id === selectedPaymentProofRequestId)
            ?.request_currency
        }
        onClose={() => {
          setPaymentProofModalVisible(false);
          setSelectedPaymentProof(null);
          setSelectedPaymentProofRequestId(null);
        }}
      />

      {invoiceRequest && invoiceOtherUser && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
          <InvoiceBillingScreen
            dateRequest={invoiceRequest as never}
            currentUser={currentUser}
            otherUser={invoiceOtherUser}
            onBack={() => {
              setInvoiceRequest(null);
              setInvoiceOtherUser(null);
            }}
            onPaymentComplete={() => {
              setInvoiceRequest(null);
              setInvoiceOtherUser(null);
              fetchAllDateRequests();
            }}
          />
        </div>
      )}
    </div>
  );
}