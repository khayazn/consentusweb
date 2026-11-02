"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { userAPI, subscriptionAPI, type User } from "@/services/api";
import { getToken, getCurrentUser, saveSession } from "@/lib/auth";
import BankingDetails from "@/components/BankingDetails";

interface ProfileTabProps {
  currentUser: User;
  onBack?: () => void;
  onUserTypeChange?: (newType: string) => void;
  onProfileUpdated?: (updated: Record<string, unknown>) => void;
  onShowPaywall?: () => void;
}

interface EditData {
  description?: string;
  bio?: string;
  interests?: string;
  age?: string;
  max_distance?: string;
  min_age?: string;
  max_age?: string;
  location?: string;
  user_type?: string;
  is_available?: boolean;
  photos?: PhotoItem[];
  [key: string]: unknown;
}

interface PhotoItem {
  url?: string;
  uri?: string;
  base64?: string;
  name?: string;
  type?: string;
}

interface Profile extends User {
  created_at?: string;
  has_banking_details?: boolean;
  bank_name?: string;
  account_holder_name?: string;
  account_number_masked?: string;
  branch_code?: string;
  currency?: string;
  bank_country?: string;
  max_distance?: number;
  min_age?: number;
  max_age?: number;
  location?: string | Record<string, unknown>;
  bio?: string;
  interests?: string;
  description?: string;
  [key: string]: unknown;
}

interface UsageLimits {
  is_paid_user?: boolean;
  subscription_expires_at?: string | null;
  pinch_count_30d?: number;
  date_request_count_30d?: number;
  service_request_count_30d?: number;
  cycle_days_remaining?: number;
}

function getFullImageUrl(path?: string): string {
  if (!path) return "";
  if (path.startsWith("http") || path.startsWith("data:")) return path;
  return `https://api-v1.consentus.online${path}`;
}

function getUserTypeLabel(type?: string): string {
  switch (type) {
    case "dating": return "Available for Dates";
    case "professional": return "Professional Services";
    case "product": return "Product Listings";
    case "general": return "General User";
    case "dormant": return "Dormant (Hidden)";
    default: return "Available for Dates";
  }
}

function getStatusText(userType?: string, isAvailable?: boolean): string {
  switch (userType) {
    case "dormant": return "🔒 Dormant - Hidden from all discovery";
    case "general": return "👤 General User - Can browse all profiles and make requests";
    case "professional":
      return isAvailable
        ? "✅ Available for professional services bookings"
        : "⏸️ Not available for services";
    case "product":
      return isAvailable ? "✅ Available for product offers" : "⏸️ Not available for product offers";
    case "dating":
    default:
      return isAvailable
        ? "✅ Active - Visible in dating discovery"
        : "⏸️ Not available for dates";
  }
}

function getStatusHelpText(userType?: string, isAvailable?: boolean): string {
  switch (userType) {
    case "dormant":
      return "Your profile is completely hidden. No one can see you or send requests.";
    case "general":
      return "You can browse all user types, ask out, book services, or make product offers to others, but no one can send you requests.";
    case "professional":
      return isAvailable
        ? "You appear in services discovery and can receive service bookings."
        : "You do not appear in discovery results and service requests are frozen.";
    case "product":
      return isAvailable
        ? "You appear in marketplace discovery and can receive product offers."
        : "You do not appear in discovery results and product offers are frozen.";
    case "dating":
    default:
      return isAvailable
        ? "You appear in dating discovery and can receive date requests."
        : "You do not appear in discovery results and date requests are frozen.";
  }
}

function getProfileTypeDescription(userType?: string, isAvailable?: boolean): string {
  switch (userType) {
    case "dating":
      return isAvailable
        ? "You will appear in dating discovery and can receive date requests"
        : "You will not appear in discovery results and cannot receive date requests";
    case "professional":
      return "You will appear in services discovery and can receive service bookings";
    case "product":
      return "You will appear in marketplace discovery and can receive product offers";
    case "general":
      return "You can browse all profiles and make requests to others but cannot receive any requests. Your profile is hidden from discovery.";
    case "dormant":
      return "Your profile is completely hidden from all discovery. No new requests can be sent or received.";
    default:
      return "You will appear in dating discovery and can receive date requests";
  }
}

export default function ProfileTab({
  currentUser,
  onBack,
  onUserTypeChange,
  onProfileUpdated,
  onShowPaywall,
}: ProfileTabProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<EditData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [bankingModalVisible, setBankingModalVisible] = useState(false);

  const [isPaidUser, setIsPaidUser] = useState(false);
  const [usageLimits, setUsageLimits] = useState<UsageLimits | null>(null);
  const [hasBankingDetails, setHasBankingDetails] = useState(false);

  const [verificationStatus, setVerificationStatus] = useState<
    "none" | "pending" | "approved" | "rejected"
  >("none");
  const [isVerified, setIsVerified] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationRequestedAt, setVerificationRequestedAt] = useState<string | null>(null);

  const [hasActiveEngagements, setHasActiveEngagements] = useState(false);
  const [activeEngagementsCount, setActiveEngagementsCount] = useState({
    dates: 0,
    services: 0,
  });

  const [imageLoadErrors, setImageLoadErrors] = useState<Record<number, boolean>>({});

  // ------------------- Initial load -------------------
  useEffect(() => {
    if (!currentUser) return;
    fetchProfile();
    fetchVerificationStatus();
    fetchSubscriptionStatus();
    checkActiveEngagements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  async function fetchProfile() {
    try {
      setLoading(true);
      const response = await userAPI.getProfile(currentUser.id);
      if (response.data) {
        const profileData = response.data as Profile;
        setProfile(profileData);
        setHasBankingDetails(Boolean(profileData.has_banking_details));
        resetEditData(profileData);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      // Fallback
      const fallback: Profile = {
        ...currentUser,
        is_available: currentUser.is_available ?? true,
        bio: "",
        interests: "",
        max_distance: 50,
        min_age: 18,
        max_age: 99,
        user_type: currentUser.user_type || "dating",
        description: "",
        age: currentUser.age,
        photos: currentUser.photos || [],
      };
      setProfile(fallback);
      resetEditData(fallback);
      setHasBankingDetails(false);
    } finally {
      setLoading(false);
    }
  }

  function resetEditData(p: Profile) {
    setEditData({
      description: p.description || "",
      bio: p.bio || "",
      interests: p.interests || "",
      age: p.age?.toString() || "",
      max_distance: p.max_distance?.toString() || "50",
      min_age: p.min_age?.toString() || "18",
      max_age: p.max_age?.toString() || "99",
      location: typeof p.location === "object" ? JSON.stringify(p.location) : p.location || "",
      user_type: p.user_type || "dating",
      is_available: p.is_available ?? true,
      photos: (p.photos || []).map((ph: string | PhotoItem) =>
        typeof ph === "string" ? { url: ph } : ph
      ),
    });
  }

  async function fetchVerificationStatus() {
    try {
      const token = getToken();
      const res = await fetch(
        `https://api-v1.consentus.online/api/users/${currentUser.id}/verification-status`,
        {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
            "Content-Type": "application/json",
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        setIsVerified(Boolean(data.is_verified));
        setVerificationStatus(
          (data.verification_status as "none" | "pending" | "approved" | "rejected") || "none"
        );
        setVerificationRequestedAt(data.requested_at || null);
      }
    } catch (e) {
      console.error("Verification status error:", e);
    }
  }

  async function fetchSubscriptionStatus() {
    try {
      const res = await subscriptionAPI.getUsageLimits(currentUser.id);
      const limits = res.data as UsageLimits;
      setUsageLimits(limits);
      setIsPaidUser(Boolean(limits?.is_paid_user));
    } catch (e) {
      console.error("Subscription status error:", e);
    }
  }

  async function checkActiveEngagements() {
    try {
      const token = getToken();
      const res = await fetch(
        `https://api-v1.consentus.online/api/users/${currentUser.id}/active-engagements`,
        { headers: { Authorization: token ? `Bearer ${token}` : "" } }
      );
      if (res.ok) {
        const data = await res.json();
        setHasActiveEngagements(Boolean(data.hasActiveEngagements));
        setActiveEngagementsCount({
          dates: data.activeDatesCount || 0,
          services: data.activeServicesCount || 0,
        });
      }
    } catch (e) {
      console.error("Active engagements error:", e);
    }
  }

  // ------------------- Verification -------------------
  async function handleVerificationToggle() {
    if (isVerified) {
      window.alert(
        "Already Verified: Your account is already verified. You have a blue verification badge on your profile."
      );
      return;
    }
    if (verificationStatus === "pending") {
      if (!window.confirm("Cancel your pending verification request?")) return;
      await requestVerification("cancel");
      return;
    }
    if (verificationStatus === "rejected") {
      if (!window.confirm("Your previous request was rejected. Submit a new one?")) return;
      await requestVerification("request");
      return;
    }
    if (verificationStatus === "none") {
      if (
        !window.confirm(
          "You will receive an email with instructions on how to verify your account. Would you like to proceed?"
        )
      )
        return;
      await requestVerification("request");
    }
  }

  async function requestVerification(action: "request" | "cancel") {
    try {
      setVerificationLoading(true);
      const token = getToken();
      if (!token) {
        window.alert("Authentication Required: Please log in again.");
        return;
      }
      const res = await fetch(
        `https://api-v1.consentus.online/api/users/${currentUser.id}/request-verification`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        if (action === "request") {
          setVerificationStatus("pending");
          window.alert(
            "✅ Verification Requested: Check your email for instructions on how to complete the process."
          );
        } else {
          setVerificationStatus("none");
          window.alert("Your verification request has been cancelled.");
        }
      } else {
        window.alert(data.error || `Failed to ${action} verification.`);
      }
    } catch (e) {
      console.error(e);
      window.alert("Failed to process verification request.");
    } finally {
      setVerificationLoading(false);
    }
  }

  // ------------------- User type -------------------
  async function handleUserTypeChange(newUserType: string) {
    if (!profile) return;
    if (newUserType === "general" && !isPaidUser) {
      if (window.confirm("General User mode is a premium feature. Upgrade to unlock?")) {
        onShowPaywall?.();
      }
      return;
    }
    if (newUserType === "dormant" && hasActiveEngagements) {
      window.alert(
        `Cannot Go Dormant: Complete or cancel your ${activeEngagementsCount.dates} active date(s) and ${activeEngagementsCount.services} active service(s) first.`
      );
      return;
    }
    try {
      const token = getToken();
      const body: Record<string, unknown> = {
        user_id: currentUser.id,
        user_type: newUserType,
      };
      if (newUserType === "dormant") body.is_available = false;
      else body.is_available = true;

      const res = await fetch("https://api-v1.consentus.online/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to update user type");

      if (result.profile) {
        setProfile(result.profile as Profile);
        setEditData((prev) => ({
          ...prev,
          user_type: newUserType,
          is_available: body.is_available as boolean,
        }));

        // Sync to localStorage
        const stored = getCurrentUser();
        if (stored) {
          saveSession(localStorage.getItem("token") || "", {
            ...stored,
            user_type: newUserType,
            is_available: body.is_available as boolean,
          });
        }
      }
      onUserTypeChange?.(newUserType);
      checkActiveEngagements();
      window.alert(`Profile status updated to ${getUserTypeLabel(newUserType)}`);
    } catch (e) {
      console.error(e);
      window.alert("Failed to update profile status: " + (e as Error).message);
    }
  }

  // ------------------- Profile save -------------------
  function validateProfileData(): string | null {
    if (editData.age && (parseInt(editData.age) < 18 || parseInt(editData.age) > 100))
      return "Age must be between 18 and 100";
    if (editData.min_age && (parseInt(editData.min_age) < 18 || parseInt(editData.min_age) > 100))
      return "Minimum age must be between 18 and 100";
    if (editData.max_age && (parseInt(editData.max_age) < 18 || parseInt(editData.max_age) > 100))
      return "Maximum age must be between 18 and 100";
    if (
      editData.min_age &&
      editData.max_age &&
      parseInt(editData.min_age) > parseInt(editData.max_age)
    )
      return "Minimum age cannot be greater than maximum age";
    if (
      editData.max_distance &&
      (parseInt(editData.max_distance) < 1 || parseInt(editData.max_distance) > 1000)
    )
      return "Maximum distance must be between 1 and 1000 km";
    return null;
  }

  async function handleSaveProfile() {
    const validationError = validateProfileData();
    if (validationError) {
      window.alert("Validation Error: " + validationError);
      return;
    }
    try {
      setSaving(true);
      const token = getToken();

      const newPhotos = (editData.photos || []).filter((p) => p.base64);
      const existingPhotos = (editData.photos || [])
        .filter((p) => !p.base64 && (p.url || p.uri))
        .map((p) => p.url || p.uri)
        .filter(Boolean) as string[];

      const profileData: Record<string, unknown> = {
        user_id: currentUser.id,
        description: editData.description || "",
        bio: editData.bio || "",
        interests: editData.interests || "",
        age: parseInt(editData.age || "0") || 0,
        max_distance: parseInt(editData.max_distance || "50") || 50,
        min_age: parseInt(editData.min_age || "18") || 18,
        max_age: parseInt(editData.max_age || "99") || 99,
        user_type: editData.user_type || "dating",
      };
      if (editData.location) profileData.location = editData.location;

      if (newPhotos.length > 0) {
        profileData.new_photos = newPhotos.map((p) => ({
          base64: p.base64,
          name: p.name || `photo_${Date.now()}.jpg`,
          type: p.type || "image/jpeg",
        }));
      }
      if (existingPhotos.length > 0) profileData.existing_photos = existingPhotos;

      const res = await fetch("https://api-v1.consentus.online/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(profileData),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Server error: ${res.status}`);
      }
      const result = await res.json();
      if (result.profile) {
        const p = result.profile as Profile;
        setProfile(p);
        resetEditData(p);
        onProfileUpdated?.(p as Record<string, unknown>);

        const stored = getCurrentUser();
        if (stored) {
          saveSession(localStorage.getItem("token") || "", { ...stored, ...p });
        }
      }
      setIsEditing(false);
      window.alert("Profile updated successfully!");
    } catch (e) {
      console.error(e);
      window.alert("Error: " + (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    if (profile) resetEditData(profile);
    setIsEditing(false);
  }

  // ------------------- Photo management -------------------
  function triggerAddPhoto() {
    if (window.confirm("Add Photo\n\nOK = choose from gallery\nCancel = take with camera")) {
      fileInputRef.current?.click();
    } else {
      cameraInputRef.current?.click();
    }
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          const base64Part = dataUrl.split(",")[1] || "";
          resolve(base64Part);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const newPhoto: PhotoItem = {
        uri: URL.createObjectURL(file),
        base64,
        name: file.name || `photo_${Date.now()}.jpg`,
        type: file.type || "image/jpeg",
      };
      setEditData((prev) => ({
        ...prev,
        photos: [...(prev.photos || []), newPhoto],
      }));
    } finally {
      setUploadingPhoto(false);
    }
  }

  function handleDeletePhoto(index: number) {
    if (!window.confirm("Delete this photo?")) return;
    setEditData((prev) => ({
      ...prev,
      photos: (prev.photos || []).filter((_, i) => i !== index),
    }));
  }

  function handleSetMainPhoto(index: number) {
    if (index === 0) {
      window.alert("This is already your main photo");
      return;
    }
    const photos = [...(editData.photos || [])];
    const [sel] = photos.splice(index, 1);
    photos.unshift(sel);
    setEditData((prev) => ({ ...prev, photos }));
    window.alert("Main photo updated");
  }

  // ------------------- Render helpers -------------------
  function renderSubscriptionBadge() {
    if (!isPaidUser) return null;
    return (
      <span className="ml-2 bg-[#6B46C1] text-white text-[11px] font-semibold rounded-xl px-2.5 py-0.5">
        🌟 Premium
      </span>
    );
  }

  const effectiveType = isEditing ? editData.user_type : profile?.user_type;
  const effectiveAvailable = isEditing ? editData.is_available : profile?.is_available;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-[#FF6B6B] font-semibold">Loading profile…</p>
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-[#666]">Unable to load profile</p>
        <button
          onClick={fetchProfile}
          className="bg-[#6B46C1] text-white font-semibold rounded-lg px-4 py-2"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="pb-10">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelected}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onBack}
          className="text-[#6B46C1] text-[16px] font-semibold active:opacity-70"
        >
          ← Back
        </button>
        <div className="flex items-center">
          <h2 className="text-[20px] font-bold text-[#2D3748]">Your Profile</h2>
          {renderSubscriptionBadge()}
        </div>
        <div className="flex gap-2">
          {isEditing && (
            <button
              onClick={handleCancelEdit}
              disabled={saving}
              className="text-[#718096] text-[16px] font-semibold px-2 active:opacity-70"
            >
              Cancel
            </button>
          )}
          <button
            onClick={() => (isEditing ? handleSaveProfile() : setIsEditing(true))}
            disabled={saving || uploadingPhoto}
            className="text-[#6B46C1] text-[16px] font-semibold px-2 active:opacity-70"
          >
            {saving ? "Saving…" : isEditing ? "Save" : "Edit"}
          </button>
        </div>
      </div>

      {/* Verification */}
      <section className="bg-white rounded-xl p-4 mb-4 shadow-sm">
        <h3 className="text-[18px] font-bold text-[#2D3748] mb-3">🔵 Verification</h3>
        <div className="flex flex-wrap justify-between items-start gap-3">
          <div className="flex-1 min-w-[220px]">
            <p className="text-[16px] font-bold text-[#2D3748] mb-1">
              {isVerified
                ? "✅ Verified"
                : verificationStatus === "pending"
                  ? "⏳ Pending Review"
                  : verificationStatus === "rejected"
                    ? "❌ Rejected"
                    : "Not Verified"}
            </p>
            <p className="text-[13px] text-[#718096] leading-snug">
              {isVerified
                ? "Your account is verified. You have a blue badge on your profile."
                : verificationStatus === "pending"
                  ? "Your verification request is being reviewed."
                  : verificationStatus === "rejected"
                    ? "Your previous request was rejected. You can try again."
                    : "Get verified to build trust with other users."}
            </p>
            {verificationStatus === "pending" && verificationRequestedAt && (
              <p className="text-[12px] text-[#ED8936] mt-1">
                ⏱️ Requested {new Date(verificationRequestedAt).toLocaleDateString()}
              </p>
            )}
          </div>
          <div>
            {verificationLoading ? (
              <span className="text-[#6B46C1]">…</span>
            ) : isVerified ? (
              <span className="bg-[#C6F6D5] text-[#22543D] text-[14px] font-semibold rounded-full px-3.5 py-1.5">
                ✅ Verified
              </span>
            ) : (
              <button
                onClick={handleVerificationToggle}
                disabled={verificationLoading}
                className={`text-white text-[14px] font-semibold rounded-lg px-4 py-2 active:opacity-80 ${
                  verificationStatus === "pending"
                    ? "bg-[#ED8936]"
                    : verificationStatus === "rejected"
                      ? "bg-[#E53E3E]"
                      : "bg-[#6B46C1]"
                }`}
              >
                {verificationStatus === "pending"
                  ? "Cancel Request"
                  : verificationStatus === "rejected"
                    ? "Try Again"
                    : "Request Verification"}
              </button>
            )}
          </div>
        </div>
        {!isVerified && verificationStatus !== "pending" && (
          <div className="bg-[#F7FAFC] rounded-lg p-3 mt-3">
            <p className="text-[13px] font-semibold text-[#2D3748] mb-1">📋 How it works:</p>
            <p className="text-[12px] text-[#718096] leading-5">
              1. Tap &quot;Request Verification&quot; above
            </p>
            <p className="text-[12px] text-[#718096] leading-5">
              2. Check your email for instructions
            </p>
            <p className="text-[12px] text-[#718096] leading-5">
              3. Send required documents to support@consentus.online
            </p>
            <p className="text-[12px] text-[#718096] leading-5">
              4. Wait for admin approval (24–48 hours)
            </p>
          </div>
        )}
      </section>

      {/* Account status */}
      <section className="bg-white rounded-xl p-4 mb-4 shadow-sm">
        <h3 className="text-[18px] font-bold text-[#2D3748] mb-3">Account Status</h3>
        <div className="flex flex-col gap-2">
          {[
            { key: "dating", label: "Available for Dates", locked: false },
            { key: "professional", label: "Professional Services", locked: false },
            { key: "general", label: "General User", locked: !isPaidUser },
            {
              key: "dormant",
              label: "Dormant (Hidden)",
              locked: hasActiveEngagements,
            },
          ].map((opt) => {
            const selected = effectiveType === opt.key;
            return (
              <button
                key={opt.key}
                onClick={() => handleUserTypeChange(opt.key)}
                disabled={!isEditing || opt.locked}
                className={`flex items-center gap-3 p-3 rounded-lg text-left ${
                  opt.locked ? "bg-[#F0F0F0] opacity-60" : "bg-[#F7FAFC]"
                } ${selected ? "ring-2 ring-[#6B46C1]" : ""}`}
              >
                <span
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    opt.locked ? "border-[#A0AEC0]" : "border-[#6B46C1]"
                  }`}
                >
                  {selected && <span className="w-2.5 h-2.5 rounded-full bg-[#6B46C1]" />}
                </span>
                <span className="flex-1">
                  <span
                    className={`block text-[16px] font-medium ${
                      opt.locked ? "text-[#A0AEC0]" : "text-[#2D3748]"
                    }`}
                  >
                    {opt.label}
                    {opt.key === "general" && !isPaidUser && " 🔒"}
                  </span>
                  {opt.key === "general" && !isPaidUser && (
                    <span className="block text-[11px] text-[#6B46C1] italic mt-0.5">
                      ⭐ Premium feature — Upgrade required
                    </span>
                  )}
                  {opt.key === "dormant" && hasActiveEngagements && (
                    <span className="block text-[12px] text-[#E53E3E] mt-0.5">
                      ⚠️ {activeEngagementsCount.dates} active date(s),{" "}
                      {activeEngagementsCount.services} active service(s) — complete them first
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-[14px] text-[#718096] italic mt-3">
          {getProfileTypeDescription(effectiveType, effectiveAvailable)}
        </p>
        <div className="bg-[#F7FAFC] rounded-lg p-3 mt-3">
          <p
            className={`text-[14px] font-bold mb-1 ${
              effectiveType === "dormant"
                ? "text-[#F44336]"
                : effectiveType === "general"
                  ? "text-[#6B46C1]"
                  : effectiveAvailable
                    ? "text-[#4CAF50]"
                    : "text-[#FF9800]"
            }`}
          >
            {getStatusText(effectiveType, effectiveAvailable)}
          </p>
          <p className="text-[12px] text-[#666] leading-4">
            {getStatusHelpText(effectiveType, effectiveAvailable)}
          </p>
        </div>
      </section>

      {/* Usage limits */}
      {!isPaidUser && usageLimits && (
        <section className="bg-white rounded-xl p-4 mb-4 shadow-sm">
          <h3 className="text-[18px] font-bold text-[#2D3748] mb-1">📊 Usage Limits</h3>
          <p className="text-[13px] text-[#718096] mb-3">
            Free plan: 3 actions per 30-day cycle
          </p>
          {[
            {
              label: "👌 Pinches",
              value: usageLimits.pinch_count_30d || 0,
              max: 3,
            },
            {
              label: "📅 Date Requests",
              value: usageLimits.date_request_count_30d || 0,
              max: 3,
            },
            {
              label: "🔧 Service Requests",
              value: usageLimits.service_request_count_30d || 0,
              max: 3,
            },
          ].map((row) => (
            <div key={row.label} className="mb-3">
              <p className="text-[14px] font-medium text-[#2D3748] mb-1">{row.label}</p>
              <div className="h-1.5 bg-[#EDF2F7] rounded-full overflow-hidden mb-1">
                <div
                  className={`h-full rounded-full ${
                    row.value >= row.max ? "bg-[#E53E3E]" : "bg-[#6B46C1]"
                  }`}
                  style={{ width: `${Math.min((row.value / row.max) * 100, 100)}%` }}
                />
              </div>
              <p className="text-[12px] text-[#718096] text-right">
                {row.value}/{row.max}
                {row.value >= row.max && " 🔒"}
              </p>
            </div>
          ))}
          <p className="text-[12px] text-[#6B46C1] italic text-center mt-1">
            🔄 Cycle resets in {usageLimits.cycle_days_remaining || 30} days
          </p>
        </section>
      )}

      {/* Photos */}
      <section className="bg-white rounded-xl p-4 mb-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[18px] font-bold text-[#2D3748]">Profile Pictures</h3>
          {isEditing && (
            <button
              onClick={triggerAddPhoto}
              disabled={uploadingPhoto}
              className="text-[#6B46C1] text-[24px] leading-none active:opacity-70"
            >
              {uploadingPhoto ? "…" : "+"}
            </button>
          )}
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {(isEditing ? editData.photos : profile.photos)?.length ? (
            (isEditing ? editData.photos! : (profile.photos || []).map((p: string | PhotoItem) => (typeof p === "string" ? { url: p } : p))).map(
              (pic: PhotoItem, index: number) => {
                const url = pic.uri || getFullImageUrl(pic.url);
                const hasError = imageLoadErrors[index];
                return (
                  <button
                    key={index}
                    onClick={() => {
                      if (!isEditing) return;
                      if (window.confirm("Set as main photo? (Cancel = delete)")) {
                        handleSetMainPhoto(index);
                      } else {
                        handleDeletePhoto(index);
                      }
                    }}
                    disabled={!isEditing}
                    className="relative w-[100px] h-[100px] rounded-xl overflow-hidden bg-[#F0F0F0] shrink-0"
                  >
                    {url && !hasError ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={url}
                        alt={`Photo ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={() =>
                          setImageLoadErrors((prev) => ({ ...prev, [index]: true }))
                        }
                      />
                    ) : (
                      <span className="text-[10px] text-[#999]">Failed to load</span>
                    )}
                    {isEditing && index === 0 && (
                      <span className="absolute top-1 left-1 bg-[#6B46C1] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                        Main
                      </span>
                    )}
                  </button>
                );
              }
            )
          ) : (
            <p className="text-[14px] italic text-[#718096] py-4">No profile pictures</p>
          )}
          {isEditing && (editData.photos || []).length < 6 && (
            <button
              onClick={triggerAddPhoto}
              disabled={uploadingPhoto}
              className="w-[100px] h-[100px] shrink-0 border-2 border-dashed border-[#6B46C1] bg-[#EDF2F7] rounded-xl flex flex-col items-center justify-center text-[#6B46C1]"
            >
              <span className="text-[24px]">📷</span>
              <span className="text-[12px] font-medium mt-1">Add Photo</span>
            </button>
          )}
        </div>
        <p className="text-[12px] italic text-[#718096] mt-1">
          {isEditing
            ? "Tap any photo to delete or set as main. Up to 6 photos."
            : "Tap Edit to add, remove, or reorder photos"}
        </p>
        {isEditing && (
          <p className="text-[12px] font-semibold text-[#6B46C1] text-right mt-1">
            {(editData.photos || []).length}/6 photos
          </p>
        )}
      </section>

      {/* Basic info */}
      <section className="bg-white rounded-xl p-4 mb-4 shadow-sm">
        <h3 className="text-[18px] font-bold text-[#2D3748] mb-3">Profile Information</h3>

        <label className="block mb-3">
          <span className="block text-[14px] font-semibold text-[#4A5568] mb-1">Username</span>
          <input
            className="w-full bg-[#EDF2F7] text-[#718096] border border-[#E2E8F0] rounded-lg px-3 py-2 text-[16px]"
            value={profile.username}
            readOnly
          />
          <span className="block text-[12px] text-[#718096] mt-1">
            Username cannot be changed
          </span>
        </label>

        <label className="block mb-3">
          <span className="block text-[14px] font-semibold text-[#4A5568] mb-1">Age</span>
          <input
            type="number"
            className="w-full bg-[#F7FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-[16px]"
            value={isEditing ? editData.age || "" : profile.age?.toString() || ""}
            onChange={(e) => setEditData({ ...editData, age: e.target.value })}
            readOnly={!isEditing}
            placeholder="Your age"
          />
        </label>

        <label className="block mb-3">
          <span className="block text-[14px] font-semibold text-[#4A5568] mb-1">Bio</span>
          <span className="block text-[12px] text-[#718096] mb-1">
            Share your story — you can paste links like https://example.com
          </span>
          <textarea
            className="w-full bg-[#F7FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-[15px] leading-6 min-h-[260px]"
            value={isEditing ? editData.bio || "" : profile.bio || ""}
            onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
            readOnly={!isEditing}
            placeholder="Tell others about yourself…"
          />
          {isEditing && (
            <span className="block text-[12px] text-[#A0AEC0] text-right mt-1">
              {(editData.bio || "").length} characters
            </span>
          )}
        </label>

        <label className="block mb-3">
          <span className="block text-[14px] font-semibold text-[#4A5568] mb-1">Interests</span>
          <input
            className="w-full bg-[#F7FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-[16px]"
            value={isEditing ? editData.interests || "" : profile.interests || ""}
            onChange={(e) => setEditData({ ...editData, interests: e.target.value })}
            readOnly={!isEditing}
            placeholder="e.g. Singing, Dancing, Hiking"
          />
        </label>

        <label className="block mb-3">
          <span className="block text-[14px] font-semibold text-[#4A5568] mb-1">Location</span>
          <input
            className="w-full bg-[#F7FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-[16px]"
            value={
              isEditing
                ? editData.location || ""
                : typeof profile.location === "object"
                  ? JSON.stringify(profile.location)
                  : profile.location || ""
            }
            onChange={(e) => setEditData({ ...editData, location: e.target.value })}
            readOnly={!isEditing}
            placeholder="Your location"
          />
        </label>

        <label className="block mb-3">
          <span className="block text-[14px] font-semibold text-[#4A5568] mb-1">
            Max Distance (km)
          </span>
          <input
            type="number"
            className="w-full bg-[#F7FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-[16px]"
            value={isEditing ? editData.max_distance || "" : profile.max_distance?.toString() || ""}
            onChange={(e) => setEditData({ ...editData, max_distance: e.target.value })}
            readOnly={!isEditing}
            placeholder="50"
          />
        </label>
      </section>

      {/* Dating prefs */}
      {effectiveType === "dating" && (
        <section className="bg-white rounded-xl p-4 mb-4 shadow-sm">
          <h3 className="text-[18px] font-bold text-[#2D3748] mb-3">Dating Preferences</h3>
          <div className="flex gap-3">
            <label className="flex-1">
              <span className="block text-[14px] font-semibold text-[#4A5568] mb-1">Min Age</span>
              <input
                type="number"
                className="w-full bg-[#F7FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-[16px]"
                value={isEditing ? editData.min_age || "" : profile.min_age?.toString() || ""}
                onChange={(e) => setEditData({ ...editData, min_age: e.target.value })}
                readOnly={!isEditing}
                placeholder="18"
              />
            </label>
            <label className="flex-1">
              <span className="block text-[14px] font-semibold text-[#4A5568] mb-1">Max Age</span>
              <input
                type="number"
                className="w-full bg-[#F7FAFC] border border-[#E2E8F0] rounded-lg px-3 py-2 text-[16px]"
                value={isEditing ? editData.max_age || "" : profile.max_age?.toString() || ""}
                onChange={(e) => setEditData({ ...editData, max_age: e.target.value })}
                readOnly={!isEditing}
                placeholder="99"
              />
            </label>
          </div>
        </section>
      )}

      {/* Banking */}
      <section className="bg-white rounded-xl p-4 mb-4 shadow-sm">
        <h3 className="text-[18px] font-bold text-[#2D3748] mb-2">Banking Details</h3>
        <p className="text-[14px] text-[#718096] mb-3 leading-5">
          Add banking information to receive payments for services, products, or date arrangements.
        </p>
        {hasBankingDetails ? (
          <div className="bg-[#F0FFF4] border-l-4 border-[#38A169] rounded-lg p-3 mb-3">
            <p className="text-[16px] font-bold text-[#22543D] mb-2">
              ✅ Banking Details Configured
            </p>
            {profile.bank_name && (
              <p className="text-[14px] text-[#2D3748]">
                <span className="font-semibold text-[#4A5568]">Bank:</span> {profile.bank_name}
              </p>
            )}
            {profile.account_holder_name && (
              <p className="text-[14px] text-[#2D3748]">
                <span className="font-semibold text-[#4A5568]">Account Holder:</span>{" "}
                {profile.account_holder_name}
              </p>
            )}
            {profile.account_number_masked && (
              <p className="text-[14px] text-[#2D3748]">
                <span className="font-semibold text-[#4A5568]">Account:</span>{" "}
                {profile.account_number_masked}
              </p>
            )}
            {profile.branch_code && (
              <p className="text-[14px] text-[#2D3748]">
                <span className="font-semibold text-[#4A5568]">Branch Code:</span>{" "}
                {profile.branch_code}
              </p>
            )}
            {profile.currency && (
              <p className="text-[14px] text-[#2D3748]">
                <span className="font-semibold text-[#4A5568]">Currency:</span>{" "}
                {profile.currency}
              </p>
            )}
            {profile.bank_country && (
              <p className="text-[14px] text-[#2D3748]">
                <span className="font-semibold text-[#4A5568]">Country:</span>{" "}
                {profile.bank_country}
              </p>
            )}
          </div>
        ) : (
          <p className="text-[14px] italic text-[#718096] mb-3 text-center">
            No banking details added yet.
          </p>
        )}
        <button
          onClick={() => setBankingModalVisible(true)}
          className="w-full bg-[#6B46C1] text-white font-bold rounded-lg py-3 active:opacity-80"
        >
          {hasBankingDetails ? "Edit Banking Details" : "Add Banking Details"}
        </button>
      </section>

      {/* Account info */}
      <section className="bg-white rounded-xl p-4 mb-4 shadow-sm">
        <h3 className="text-[18px] font-bold text-[#2D3748] mb-3">Account Information</h3>
        <div className="bg-[#F7FAFC] rounded-lg p-3 text-[14px] text-[#4A5568] space-y-2">
          <p>
            <span className="font-semibold text-[#2D3748]">Email: </span>
            {profile.email}
          </p>
          <p>
            <span className="font-semibold text-[#2D3748]">Member since: </span>
            {profile.created_at ? new Date(profile.created_at).toLocaleDateString() : "—"}
          </p>
          <p>
            <span className="font-semibold text-[#2D3748]">Profile Type: </span>
            {getUserTypeLabel(profile.user_type)}
          </p>
          {profile.user_type !== "general" && (
            <p>
              <span className="font-semibold text-[#2D3748]">Availability: </span>
              {profile.is_available ? "Available" : "Not available"}
            </p>
          )}
          <p>
            <span className="font-semibold text-[#2D3748]">Banking: </span>
            {hasBankingDetails ? "Configured" : "Not set up"}
          </p>
          <p>
            <span className="font-semibold text-[#2D3748]">Subscription: </span>
            {isPaidUser ? "✅ Premium" : "Free"}
          </p>
        </div>
      </section>

      {/* Paywall banner */}
      {!isPaidUser && (
        <button
          onClick={() => onShowPaywall?.()}
          className="w-full bg-white rounded-xl mb-4 shadow-sm border-2 border-[#6B46C1] overflow-hidden active:opacity-90 text-left"
        >
          <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-[#F0F4FF] to-[#E8F0FE]">
            <div className="w-12 h-12 rounded-full bg-[#6B46C1] flex items-center justify-center text-[28px]">
              🚀
            </div>
            <div className="flex-1">
              <p className="text-[16px] font-bold text-[#2D3748]">Go Unlimited! 🔓</p>
              <p className="text-[13px] text-[#718096] mt-0.5">
                Unlimited pinches, dates & services. Tap to upgrade!
              </p>
            </div>
            <span className="text-[#6B46C1] text-2xl">›</span>
          </div>
        </button>
      )}

      {/* Banking Modal */}
      <BankingDetails
        userId={currentUser.id}
        visible={bankingModalVisible}
        onClose={() => setBankingModalVisible(false)}
        onUpdate={() => {
          setBankingModalVisible(false);
          fetchProfile();
        }}
      />
    </div>
  );
}