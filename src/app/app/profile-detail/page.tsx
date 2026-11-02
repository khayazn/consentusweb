"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PhotoCarousel from "@/components/PhotoCarousel";
import RichBio from "@/components/RichBio";
import PaywallModal from "@/components/PaywallModal";
import { pinchAPI, ratingAPI, reportAPI, type User } from "@/services/api";
import { getCurrentUser } from "@/lib/auth";
import { getCurrencySymbol } from "@/lib/currency";

function getFullImageUrl(path?: string): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `https://api-v1.consentus.online${path}`;
}

function StarRating({
  rating,
  size = 16,
  showNumber = true,
}: {
  rating: number;
  size?: number;
  showNumber?: boolean;
}) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  return (
    <div className="flex items-center">
      {[...Array(fullStars)].map((_, i) => (
        <span key={`full-${i}`} style={{ fontSize: size, color: "#FFD700" }}>★</span>
      ))}
      {hasHalfStar && <span style={{ fontSize: size, color: "#FFD700" }}>★</span>}
      {[...Array(emptyStars)].map((_, i) => (
        <span key={`empty-${i}`} style={{ fontSize: size, color: "#E2E8F0" }}>★</span>
      ))}
      {showNumber && (
        <span style={{ fontSize: size - 2, color: "#666", marginLeft: 4 }}>
          {rating?.toFixed(1) || "0.0"}
        </span>
      )}
    </div>
  );
}

interface OfferData {
  description: string;
  price: string;
  location: string;
  dateTime: string;
}

interface UserRating {
  id?: number;
  rating: number;
  comment?: string;
  created_at?: string;
  rater_details?: { username?: string; photos?: string[] };
  date_request_details?: { description?: string };
}

export default function ProfileDetailPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [fullProfile, setFullProfile] = useState<User | null>(null);

  // Pinch
  const [hasPinched, setHasPinched] = useState(false);
  const [showPinchAlert, setShowPinchAlert] = useState(false);
  const [pincherUser] = useState<User | null>(null);
  const [pincherPinchId] = useState<number | null>(null);
  const [showMessageButton, setShowMessageButton] = useState(false);

  // Paywall
  const [showPaywall, setShowPaywall] = useState(false);

  // Caption modal
  const [showCaptionModal, setShowCaptionModal] = useState(false);
  const [captionText, setCaptionText] = useState("");
  const [isSendingPinch, setIsSendingPinch] = useState(false);

  // Reviews
  const [userRatings, setUserRatings] = useState<UserRating[]>([]);
  const [loadingRatings, setLoadingRatings] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);

  // Report
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [isReporting, setIsReporting] = useState(false);

  // Full-screen request
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [offerData, setOfferData] = useState<OfferData>({
    description: "",
    price: "",
    location: "",
    dateTime: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ---- Load user ----
  useEffect(() => {
    const cu = getCurrentUser();
    if (!cu) {
      router.replace("/");
      return;
    }
    setCurrentUser(cu);

    const raw = sessionStorage.getItem("viewingUser");
    if (!raw) {
      router.back();
      return;
    }
    try {
      const parsed = JSON.parse(raw) as User;
      setUser(parsed);
      setMounted(true);
    } catch {
      router.back();
    }
  }, [router]);

  // ---- Fetch full profile ----
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const res = await fetch(
          `https://api-v1.consentus.online/api/profile/${user.id}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const profile = (data.profile || data) as User;
        if (profile) setFullProfile(profile);
      } catch {
        setFullProfile(user);
      }
    })();
  }, [user]);

  // ---- Fetch ratings ----
  useEffect(() => {
    if (!user) return;
    if (user.user_type !== "professional" && user.user_type !== "product") return;
    (async () => {
      setLoadingRatings(true);
      try {
        const res = await ratingAPI.getUserRatings(user.id);
        setUserRatings(res.data?.ratings || []);
      } catch {
        setUserRatings([]);
      } finally {
        setLoadingRatings(false);
      }
    })();
  }, [user]);

  // ---- Helpers ----
  const getDistanceDisplay = () => {
    if (!user) return "—";
    if (user.distance_km !== undefined && user.distance_km !== null) {
      return `${user.distance_km} km away`;
    }
    if (user.user_type === "general") return "GU";
    return "Distance unavailable";
  };

  const getStatDistanceDisplay = () => {
    if (!user) return "—";
    if (user.distance_km !== undefined && user.distance_km !== null) {
      return user.distance_km;
    }
    if (user.user_type === "general") return "GU";
    return "?";
  };

  const getInviteeCurrency = () => {
    if (!user?.country) return "$";
    return getCurrencySymbol(user.country);
  };

  const shouldShowRating = () => {
    if (!user) return false;
    return (
      (user.user_type === "professional" || user.user_type === "product") &&
      ((user.average_rating || 0) > 0 || (user.total_ratings || 0) > 0)
    );
  };

  const getUserTypeDisplay = (u: User) => {
    switch (u.user_type) {
      case "professional":
        return "Service Provider";
      case "product":
        return "Product Seller";
      case "general":
        return "General User";
      case "dormant":
        return "Dormant";
      case "dating":
      default:
        return "Dating Profile";
    }
  };

  const getUserStatusText = (u: User) => {
    if (u.user_type === "dormant") return "Dormant";
    switch (u.user_type) {
      case "general":
        return "Cannot Receive Requests";
      case "dating":
        return "Available for Dates";
      case "professional":
        return "Available for Bookings";
      case "product":
        return "Available for Product Offers";
      default:
        return "Available";
    }
  };

  const getActionButtonText = (u: User) => {
    if (u.user_type === "dormant") return "Dormant";
    if (u.user_type === "general") return "General User";
    switch (u.user_type) {
      case "professional":
        return "Book Service";
      case "product":
        return "Make Offer";
      case "dating":
      default:
        return "Ask Out";
    }
  };

  const canSendRequestToUser = (u: User) => {
    if (u.user_type === "dormant") return false;
    if (u.user_type === "general") return false;
    if (u.user_type === "dating" && !u.is_available) return false;
    return true;
  };

  // ---- Pinch handlers ----
  const handleProfessionalPinch = () => {
    if (!currentUser) {
      window.alert("Authentication Required: Please log in again.");
      return;
    }
    if (currentUser.id === user!.id) {
      window.alert("Oops: You cannot pinch yourself!");
      return;
    }
    setCaptionText("");
    setShowCaptionModal(true);
  };

  const sendProfessionalPinch = async () => {
    setIsSendingPinch(true);
    try {
      const response = await pinchAPI.sendPinch(
        user!.id,
        captionText.trim() || null
      );
      if (response.status === 201) {
        setHasPinched(true);
        setShowCaptionModal(false);
        const hadCaption = captionText.trim().length > 0;
        setCaptionText("");
        window.alert(hadCaption ? "Pinch sent with note! 👌📝" : "Pinch sent! 👌");
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { requires_upgrade?: boolean; error?: string; message?: string } } };
      if (e.response?.data?.requires_upgrade) {
        setShowPaywall(true);
        window.alert(e.response.data.message || "You have reached your limit. Upgrade to unlimited!");
      } else {
        window.alert(e.response?.data?.error || "Failed to send pinch. Please try again.");
      }
    } finally {
      setIsSendingPinch(false);
    }
  };

  const handlePinch = async () => {
    if (!currentUser) {
      window.alert("Authentication Required: Please log in again.");
      return;
    }
    if (currentUser.id === user!.id) {
      window.alert("Oops: You cannot pinch yourself!");
      return;
    }
    try {
      const response = await pinchAPI.sendPinch(user!.id);
      if (response.status === 201) {
        setHasPinched(true);
        window.alert("Pinch sent! 👌");
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { requires_upgrade?: boolean; error?: string; message?: string } } };
      if (e.response?.data?.requires_upgrade) {
        setShowPaywall(true);
        window.alert(e.response?.data?.message || "You have reached your limit. Upgrade to unlimited!");
      } else {
        window.alert(e.response?.data?.error || "Failed to send pinch. Please try again.");
      }
    }
  };

  // ---- Request handlers ----
  const handleSendRequest = () => {
    if (!currentUser) {
      window.alert("Authentication Required");
      return;
    }
    if (user!.user_type === "dormant") {
      window.alert("User Dormant: This user is currently dormant.");
      return;
    }
    if (user!.user_type === "general") {
      window.alert("General User: This user cannot receive requests");
      return;
    }
    if (user!.user_type === "dating" && !user!.is_available) {
      window.alert("Not Available: This user is not currently available for dates");
      return;
    }
    setShowRequestModal(true);
    setOfferData({ description: "", price: "", location: "", dateTime: "" });
  };

  const handleInputChange = (field: keyof OfferData, value: string) => {
    setOfferData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmitRequest = async () => {
    if (!currentUser) return;
    if (!offerData.description.trim()) return window.alert("Please enter a description");
    if (!offerData.price.trim()) return window.alert("Please enter a price");
    if (!offerData.location.trim()) return window.alert("Please enter a location");

    setIsSubmitting(true);
    try {
      const body = {
        inviter_id: currentUser.id,
        invitee_id: user!.id,
        offer: {
          description: offerData.description,
          price: offerData.price,
          location: offerData.location,
          dateTime: offerData.dateTime || "ASAP",
        },
      };
      const res = await fetch(
        "https://api-v1.consentus.online/api/date-requests",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const errData = await res.json();
        if (errData.requires_upgrade) {
          setShowPaywall(true);
          window.alert(
            errData.message || "You have reached your limit. Upgrade to unlimited!"
          );
          setIsSubmitting(false);
          return;
        }
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      window.alert(`Success 🎉 Your request has been sent to ${user!.username}!`);
      setShowRequestModal(false);
      setOfferData({ description: "", price: "", location: "", dateTime: "" });
    } catch (err: unknown) {
      const e = err as Error;
      window.alert(`Failed to send request: ${e.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---- Report handlers ----
  const handleReportUser = () => {
    if (!currentUser) {
      window.alert("Authentication Required");
      return;
    }
    if (currentUser.id === user!.id) {
      window.alert("Oops: You cannot report yourself.");
      return;
    }
    setReportReason("");
    setShowReportModal(true);
  };

  const submitReport = async () => {
    setIsReporting(true);
    try {
      await reportAPI.reportUser(user!.id, reportReason.trim() || null);
      setShowReportModal(false);
      setReportReason("");
      window.alert(
        "Report Submitted: Thank you. Our moderation team will review this user."
      );
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      window.alert(
        e.response?.data?.error || "Failed to submit report. Please try again."
      );
    } finally {
      setIsReporting(false);
    }
  };

  // ---- Loading ----
  if (!mounted || !user || !currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7FAFC]">
        <p className="text-[#666]">Loading profile…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F7FAFC]">
      {/* Header */}
      <div className="flex flex-row justify-between items-center px-5 pt-[60px] pb-4 bg-white border-b border-[#E2E8F0] shadow-sm sticky top-0 z-20">
        <button
          onClick={() => router.back()}
          className="text-[#6B46C1] text-[24px] p-2 active:opacity-70"
        >
          ←
        </button>
        <h1 className="text-[18px] font-bold text-[#2D3748]">Profile</h1>
        <div className="w-10" />
      </div>

      <main className="flex-1 pb-10">
        <PhotoCarousel photos={user.photos || []} username={user.username} />

        <div className="p-6">
          {/* Name */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <h2 className="text-[28px] font-extrabold text-[#2D3748] tracking-tight">
              {user.username}
              {user.age ? `, ${user.age}` : ""}
            </h2>
            <div className="w-8 h-8 rounded-full bg-[#6B46C1] text-white flex items-center justify-center text-sm">
              {user.gender === "female" ? "♀" : "♂"}
            </div>
          </div>

          {/* Verification + pinch */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {user.is_verified && (
              <div className="flex items-center bg-[#F0FFF4] border border-[#48BB78] rounded-full px-2.5 py-1">
                <span className="text-[#48BB78] text-sm">✓</span>
                <span className="text-[12px] font-semibold text-[#22543D] ml-1">
                  Verified
                </span>
              </div>
            )}

            {(user.user_type === "dating" || user.user_type === "professional") && (
              <>
                {hasPinched ? (
                  <button className="bg-[#48BB78] text-white text-[14px] font-semibold px-4 py-2 rounded-full" disabled>
                    ✓ Pinch Sent
                  </button>
                ) : user.user_type === "professional" ? (
                  <button
                    onClick={handleProfessionalPinch}
                    disabled={currentUser.id === user.id || isSendingPinch}
                    className="bg-[#6B46C1] text-white text-[14px] font-semibold px-4 py-2 rounded-full active:opacity-80"
                  >
                    {isSendingPinch ? "Sending…" : "👌 Pinch"}
                  </button>
                ) : (
                  <button
                    onClick={handlePinch}
                    disabled={currentUser.id === user.id}
                    className="bg-[#6B46C1] text-white text-[14px] font-semibold px-4 py-2 rounded-full active:opacity-80"
                  >
                    👌 Pinch
                  </button>
                )}
              </>
            )}
          </div>

          {/* Distance */}
          <div className="flex items-center gap-1.5 mb-4">
            <span className="text-[14px] text-[#999]">📍</span>
            <span className="text-[14px] text-[#999]">{getDistanceDisplay()}</span>
          </div>

          {/* Rating */}
          {shouldShowRating() && (
            <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
              <div className="flex items-center mb-2">
                <span className="text-[#FFD700] text-[18px]">★</span>
                <span className="text-[16px] font-semibold text-[#2D3748] ml-2">
                  Rating
                </span>
              </div>
              <div className="flex items-center justify-between">
                <StarRating rating={user.average_rating || 0} size={16} showNumber={true} />
                <span className="text-[14px] italic text-[#718096]">
                  ({user.total_ratings || 0} rating
                  {(user.total_ratings || 0) !== 1 ? "s" : ""})
                </span>
              </div>
            </div>
          )}

          {/* Type + status */}
          <div className="bg-white rounded-xl p-4 mb-6 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[#6B46C1] text-[20px]">👤</span>
              <span className="text-[16px] font-semibold text-[#2D3748]">
                {getUserTypeDisplay(user)}
              </span>
            </div>
            <div
              className={`inline-flex items-center gap-1 text-white text-[12px] font-semibold px-3 py-1 rounded-full ${
                user.user_type === "general"
                  ? "bg-[#6B46C1]"
                  : user.user_type === "dormant"
                    ? "bg-[#F44336]"
                    : user.is_available
                      ? "bg-[#4CAF50]"
                      : "bg-[#FF9800]"
              }`}
            >
              <span>
                {user.user_type === "dormant"
                  ? "🛏️"
                  : user.is_available
                    ? "✅"
                    : "⏱️"}
              </span>
              {getUserStatusText(user)}
            </div>
          </div>

          {/* About Me */}
          <h3 className="text-[18px] font-bold text-[#2D3748] mb-3">ℹ️ About Me</h3>
          <p className="text-[16px] text-[#666] leading-6 mb-6">
            {fullProfile?.description || user.description || "No description provided."}
          </p>

          {/* Bio */}
          {fullProfile?.bio && (
            <div className="mb-4">
              <h3 className="text-[18px] font-bold text-[#2D3748] mb-3">📄 Bio</h3>
              <RichBio text={fullProfile.bio} />
            </div>
          )}

          {/* Interests */}
          {fullProfile?.interests && (
            <div className="mb-4">
              <h3 className="text-[18px] font-bold text-[#2D3748] mb-3">❤️ Interests</h3>
              <p className="text-[16px] text-[#666] leading-6">{fullProfile.interests}</p>
            </div>
          )}

          {/* Reviews */}
          {(user.user_type === "professional" || user.user_type === "product") && (
            <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-[#6B46C1] text-[22px]">💬</span>
                  <h3 className="text-[18px] font-bold text-[#2D3748]">Client Reviews</h3>
                </div>
                {(user.average_rating || 0) > 0 && (
                  <StarRating rating={user.average_rating || 0} size={18} showNumber={true} />
                )}
              </div>

              {loadingRatings ? (
                <p className="text-[14px] text-[#718096] text-center py-4">Loading reviews…</p>
              ) : userRatings.length > 0 ? (
                <>
                  {(showAllReviews ? userRatings : userRatings.slice(0, 3)).map((review, idx) => (
                    <div key={review.id || idx} className="py-3 border-t border-[#E2E8F0] first:border-t-0">
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-[#6B46C1] flex items-center justify-center">
                            {review.rater_details?.photos?.[0] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={getFullImageUrl(review.rater_details.photos[0])}
                                alt={review.rater_details?.username || "User"}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-white font-semibold">
                                {review.rater_details?.username?.charAt(0)?.toUpperCase() || "U"}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="text-[15px] font-semibold text-[#2D3748]">
                              {review.rater_details?.username || "Anonymous"}
                            </p>
                            <p className="text-[12px] text-[#A0AEC0]">
                              {review.created_at
                                ? new Date(review.created_at).toLocaleDateString()
                                : "Recent"}
                            </p>
                          </div>
                        </div>
                        <span className="text-[#FFD700] text-[14px]">
                          {"★".repeat(review.rating)}
                          <span className="text-[#E2E8F0]">{"★".repeat(5 - review.rating)}</span>
                        </span>
                      </div>
                      {review.comment && (
                        <p className="text-[14px] text-[#4A5568] leading-5 pl-[52px]">
                          {review.comment}
                        </p>
                      )}
                    </div>
                  ))}

                  {userRatings.length > 3 && (
                    <button
                      onClick={() => setShowAllReviews(!showAllReviews)}
                      className="w-full text-center text-[#6B46C1] font-semibold text-[14px] py-2 active:opacity-70"
                    >
                      {showAllReviews ? "Show Less" : `View All ${userRatings.length} Reviews →`}
                    </button>
                  )}
                </>
              ) : (
                <div className="text-center py-6">
                  <p className="text-[16px] font-semibold text-[#718096] mb-1">No reviews yet</p>
                  <p className="text-[14px] text-[#A0AEC0]">
                    Be the first to leave a review for {user.username}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center bg-white rounded-2xl p-5 mb-6 shadow-sm">
            <div className="flex-1 flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-[#F7FAFC] flex items-center justify-center mb-2 text-[#6B46C1]">🖼️</div>
              <p className="text-[20px] font-bold text-[#2D3748] mb-1">{user.photos?.length || 0}</p>
              <p className="text-[12px] text-[#718096] uppercase tracking-wide">Photos</p>
            </div>
            <div className="w-px h-10 bg-[#E2E8F0]" />
            <div className="flex-1 flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-[#F7FAFC] flex items-center justify-center mb-2 text-[#4CAF50]">🧭</div>
              <p className="text-[20px] font-bold text-[#2D3748] mb-1">{getStatDistanceDisplay()}</p>
              <p className="text-[12px] text-[#718096] uppercase tracking-wide">Km away</p>
            </div>
          </div>

          {/* Action */}
          <button
            onClick={handleSendRequest}
            disabled={!canSendRequestToUser(user) || !currentUser}
            className={`w-full rounded-xl py-4 flex items-center justify-center gap-2 font-bold text-[16px] shadow ${
              !canSendRequestToUser(user) || !currentUser
                ? "bg-[#E2E8F0] text-[#A0AEC0] cursor-not-allowed"
                : "bg-[#6B46C1] text-white active:opacity-80"
            }`}
          >
            <span>
              {user.user_type === "professional"
                ? "🔨"
                : user.user_type === "product"
                  ? "📦"
                  : user.user_type === "dormant"
                    ? "🛏️"
                    : "❤️"}
            </span>
            {getActionButtonText(user)}
          </button>

          {/* Report link */}
          {user.id !== currentUser.id && (
            <button
              onClick={handleReportUser}
              disabled={isReporting}
              className="w-full text-center text-[13px] text-[#A0AEC0] underline py-3 active:opacity-70"
            >
              🚩 Report {user.username}
            </button>
          )}

          {/* General / Dormant notices */}
          {user.user_type === "general" && (
            <div className="bg-[#F0F4FF] border-l-4 border-[#6B46C1] rounded-lg p-5 mb-4">
              <div className="flex items-center mb-2">
                <span className="text-[#6B46C1] text-[20px]">👥</span>
                <p className="text-[16px] font-bold text-[#6B46C1] ml-2">General User</p>
              </div>
              <p className="text-[14px] text-[#4A5568] leading-5">
                This user can make requests to others but cannot receive any requests.
              </p>
            </div>
          )}

          {user.user_type === "dormant" && (
            <div className="bg-[#FFF5F5] border-l-4 border-[#F44336] rounded-lg p-5 mb-4">
              <div className="flex items-center mb-2">
                <span className="text-[#F44336] text-[20px]">🛏️</span>
                <p className="text-[16px] font-bold text-[#F44336] ml-2">Dormant</p>
              </div>
              <p className="text-[14px] text-[#4A5568] leading-5">
                This user is currently dormant and cannot receive requests.
              </p>
            </div>
          )}
        </div>
      </main>

      {/* ---- Caption Modal ---- */}
      {showCaptionModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-[22px] font-extrabold text-[#2D3748] text-center mb-2">
              Send a Note to {user.username}
            </h3>
            <p className="text-[14px] text-[#718096] text-center mb-5">
              Optional: Add a message explaining your interest (max 100 characters)
            </p>
            <div className="border border-[#E2E8F0] rounded-xl bg-[#F7FAFC] p-3 relative mb-5">
              <textarea
                className="w-full bg-transparent text-[16px] text-[#2D3748] outline-none resize-none min-h-[80px] pr-10"
                placeholder="Write a note here..."
                value={captionText}
                onChange={(e) => setCaptionText(e.target.value.slice(0, 100))}
                maxLength={100}
              />
              <span className="absolute bottom-2 right-3 text-[12px] text-[#A0AEC0]">
                {captionText.length}/100
              </span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowCaptionModal(false);
                  setCaptionText("");
                }}
                disabled={isSendingPinch}
                className="flex-1 bg-[#EDF2F7] text-[#4A5568] font-semibold rounded-xl py-3 active:opacity-80"
              >
                Cancel
              </button>
              <button
                onClick={sendProfessionalPinch}
                disabled={isSendingPinch}
                className="flex-1 bg-[#6B46C1] text-white font-semibold rounded-xl py-3 active:opacity-80 disabled:opacity-50"
              >
                {isSendingPinch ? "Sending…" : `Send Pinch ${captionText.trim() ? "📝" : "👌"}`}
              </button>
            </div>
            {captionText.trim() && (
              <div className="mt-4 p-3 bg-[#F0F4FF] border-l-4 border-[#6B46C1] rounded-lg">
                <p className="text-[12px] font-semibold text-[#6B46C1] mb-1">📝 Note preview:</p>
                <p className="text-[14px] italic text-[#2D3748]">&ldquo;{captionText.trim()}&rdquo;</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- Report Modal ---- */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-center mb-3 text-[28px]">🚩</div>
            <h3 className="text-[22px] font-extrabold text-[#2D3748] text-center mb-2">
              Report {user.username}?
            </h3>
            <p className="text-[14px] text-[#718096] text-center mb-5 leading-5">
              Tell us what happened. Our moderation team will review your report.
            </p>
            <div className="border border-[#E2E8F0] rounded-xl bg-[#F7FAFC] p-3 relative mb-5">
              <textarea
                className="w-full bg-transparent text-[15px] text-[#2D3748] outline-none resize-none min-h-[100px] pr-12"
                placeholder="Describe the issue (optional, max 1000 characters)"
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value.slice(0, 1000))}
                maxLength={1000}
                disabled={isReporting}
              />
              <span className="absolute bottom-2 right-3 text-[12px] text-[#A0AEC0]">
                {reportReason.length}/1000
              </span>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowReportModal(false);
                  setReportReason("");
                }}
                disabled={isReporting}
                className="flex-1 bg-[#EDF2F7] text-[#4A5568] font-semibold rounded-xl py-3 active:opacity-80"
              >
                Cancel
              </button>
              <button
                onClick={submitReport}
                disabled={isReporting}
                className="flex-1 bg-[#E53E3E] text-white font-semibold rounded-xl py-3 active:opacity-80 disabled:opacity-50"
              >
                {isReporting ? "Submitting…" : "Submit Report"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Pinch Alert Modal ---- */}
      {showPinchAlert && pincherUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md text-center shadow-2xl">
            <div className="text-[48px] mb-3">🔴</div>
            <h3 className="text-[26px] font-extrabold text-[#F56565] mb-2">Pinch Alert!</h3>
            <p className="text-[18px] font-semibold text-[#2D3748] mb-5">
              {pincherUser.username} pinched you! 👌
            </p>
            <div className="bg-[#F7FAFC] rounded-2xl p-4 mb-6">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-[#6B46C1] flex items-center justify-center mx-auto mb-3 border-4 border-[#6B46C1]">
                {pincherUser.photos?.[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={getFullImageUrl(pincherUser.photos[0])}
                    alt={pincherUser.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-white text-[28px] font-bold">
                    {pincherUser.username?.charAt(0)?.toUpperCase() || "U"}
                  </span>
                )}
              </div>
              <p className="text-[20px] font-bold text-[#FF6B6B]">
                {pincherUser.username}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={async () => {
                  if (!pincherPinchId) return;
                  try {
                    await pinchAPI.pinchBack(pincherPinchId);
                    setShowMessageButton(true);
                    window.alert("You pinched back! 👌");
                  } catch {
                    window.alert("Failed to pinch back");
                  }
                }}
                className="w-full bg-[#6B46C1] text-white font-bold rounded-xl py-3 active:opacity-80"
              >
                👌 Pinch Back
              </button>
              {showMessageButton && (
                <button
                  onClick={() => {
                    setShowPinchAlert(false);
                    window.alert("Chat opens in the Conversations tab — porting next");
                  }}
                  className="w-full bg-[#38B2AC] text-white font-bold rounded-xl py-3 active:opacity-80"
                >
                  💬 Message
                </button>
              )}
              <button
                onClick={() => setShowPinchAlert(false)}
                className="w-full bg-[#EDF2F7] text-[#4A5568] font-semibold rounded-xl py-3 active:opacity-80"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Full-Screen Request Modal ---- */}
      {showRequestModal && (
        <div className="fixed inset-0 z-50 bg-[#F7FAFC] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 bg-[#6B46C1] text-white">
            <button
              onClick={() => setShowRequestModal(false)}
              className="text-white text-[24px] p-1 active:opacity-70"
            >
              ←
            </button>
            <h2 className="text-[18px] font-bold flex-1 text-center">
              {getActionButtonText(user)}
            </h2>
            <button
              onClick={() => setShowRequestModal(false)}
              className="text-white text-[24px] p-1 active:opacity-70"
            >
              ✕
            </button>
          </div>

          <div className="flex items-center gap-4 px-5 py-4 bg-white border-b border-[#E2E8F0] shadow-sm">
            <div className="w-14 h-14 rounded-full overflow-hidden bg-[#6B46C1] flex items-center justify-center shrink-0">
              {user.photos?.[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={getFullImageUrl(user.photos[0])}
                  alt={user.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white font-bold text-[22px]">
                  {user.username?.charAt(0)?.toUpperCase() || "U"}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[20px] font-bold text-[#2D3748] mb-1 truncate">
                {user.username}
              </p>
              <p className="text-[14px] text-[#718096]">{getUserTypeDisplay(user)}</p>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-[12px] text-[#999]">📍</span>
                <span className="text-[12px] text-[#999]">{getDistanceDisplay()}</span>
              </div>
            </div>
          </div>

          {shouldShowRating() && (
            <div className="bg-[#F8FAFC] px-5 py-4 border-b border-[#E2E8F0]">
              <div className="flex items-center justify-center gap-2 mb-1">
                <span className="text-[#FFD700]">★</span>
                <span className="text-[14px] font-semibold text-[#4A5568]">Rating:</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <StarRating rating={user.average_rating || 0} size={14} showNumber={true} />
                <span className="text-[12px] italic text-[#718096]">
                  ({user.total_ratings || 0} rating
                  {(user.total_ratings || 0) !== 1 ? "s" : ""})
                </span>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-5 pb-24">
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <p className="text-[16px] text-[#718096] text-center mb-6">
                Fill in the details below to send your request
              </p>

              <div className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[#6B46C1]">📝</span>
                  <label className="text-[14px] font-semibold text-[#4A5568]">
                    Description
                  </label>
                </div>
                <textarea
                  className="w-full border border-[#E2E8F0] rounded-xl bg-[#F8FAFC] p-4 text-[16px] text-[#2D3748] outline-none min-h-[80px]"
                  placeholder={`What would you like? ${
                    user.user_type === "professional"
                      ? "e.g., Need help with..."
                      : user.user_type === "product"
                        ? "e.g., I want to buy..."
                        : "e.g., Would you like to go..."
                  }`}
                  value={offerData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  autoFocus
                />
              </div>

              <div className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[#6B46C1]">💰</span>
                  <label className="text-[14px] font-semibold text-[#4A5568]">
                    Price ({getInviteeCurrency()})
                  </label>
                </div>
                <div className="flex items-center border border-[#E2E8F0] rounded-xl bg-[#F8FAFC] px-4">
                  <span className="text-[16px] font-semibold text-[#2D3748] mr-2">
                    {getInviteeCurrency()}
                  </span>
                  <input
                    type="text"
                    className="flex-1 py-4 bg-transparent text-[16px] text-[#2D3748] outline-none"
                    placeholder="0.00"
                    value={offerData.price}
                    onChange={(e) =>
                      handleInputChange("price", e.target.value.replace(/[^0-9.]/g, ""))
                    }
                  />
                </div>
              </div>

              <div className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[#6B46C1]">📍</span>
                  <label className="text-[14px] font-semibold text-[#4A5568]">
                    Location
                  </label>
                </div>
                <input
                  type="text"
                  className="w-full border border-[#E2E8F0] rounded-xl bg-[#F8FAFC] p-4 text-[16px] text-[#2D3748] outline-none"
                  placeholder="e.g., Downtown, Online, Your place"
                  value={offerData.location}
                  onChange={(e) => handleInputChange("location", e.target.value)}
                />
              </div>

              <div className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[#6B46C1]">📅</span>
                  <label className="text-[14px] font-semibold text-[#4A5568]">
                    Date/Time (Optional)
                  </label>
                </div>
                <input
                  type="text"
                  className="w-full border border-[#E2E8F0] rounded-xl bg-[#F8FAFC] p-4 text-[16px] text-[#2D3748] outline-none"
                  placeholder="e.g., Saturday 7 PM, ASAP, Next week"
                  value={offerData.dateTime}
                  onChange={(e) => handleInputChange("dateTime", e.target.value)}
                />
              </div>

              <div className="flex items-start gap-2 p-3 bg-[#F0F9FF] border-l-4 border-[#0EA5E9] rounded-lg">
                <span className="text-[#0EA5E9]">ℹ️</span>
                <p className="text-[13px] text-[#0369A1] leading-5 flex-1">
                  Your request will be sent immediately. The user will be notified.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white border-t border-[#F1F5F9] p-5 pb-8 flex gap-3 shadow-[0_-2px_4px_rgba(0,0,0,0.05)]">
            <button
              onClick={() => setShowRequestModal(false)}
              disabled={isSubmitting}
              className="flex-1 bg-[#F1F5F9] text-[#64748B] font-semibold rounded-xl py-4 active:opacity-80"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitRequest}
              disabled={isSubmitting || !currentUser}
              className="flex-[2] bg-[#6B46C1] text-white font-bold rounded-xl py-4 flex items-center justify-center gap-2 active:opacity-80 disabled:opacity-50"
            >
              {isSubmitting ? <>⏳ Sending…</> : <>📤 {getActionButtonText(user)}</>}
            </button>
          </div>
        </div>
      )}

      {/* ---- Paywall ---- */}
      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        currentUser={currentUser}
        onUpgradeSuccess={() => {
          setShowPaywall(false);
          window.alert("🎉 Success! Your subscription has been activated. You now have unlimited access!");
        }}
      />
    </div>
  );
}