"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import TabBar from "@/components/TabBar";
import ProfileTab from "@/components/ProfileTab";
import PaywallModal from "@/components/PaywallModal";
import {
  userAPI,
  dateAPI,
  pinchAPI,
  subscriptionAPI,
  makeAuthenticatedRequest,
  type User,
  type NearbyResponse,
} from "@/services/api";
import { getCurrentUser, logout } from "@/lib/auth";
import { getCurrencyForCountry } from "@/lib/currency";

const PAGE_SIZE = 100;

interface DateOffer {
  description: string;
  price: string;
  location: string;
  dateTime: string;
}

interface UsageLimits {
  is_paid_user?: boolean;
  subscription_expires_at?: string | null;
  pinch_count_30d?: number;
  date_request_count_30d?: number;
  service_request_count_30d?: number;
  cycle_days_remaining?: number;
}

function StarRating({
  rating,
  size = 13,
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

function getFullImageUrl(path?: string): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `https://api-v1.consentus.online${path}`;
}

export default function MainScreen() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Tab / Navigation
  const [activeTab, setActiveTab] = useState("discover");
  const [nearbyUsers, setNearbyUsers] = useState<User[]>([]);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  // Ask-Out Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [dateOffer, setDateOffer] = useState<DateOffer>({
    description: "",
    price: "0",
    location: "",
    dateTime: "",
  });

  const [loadingUsers, setLoadingUsers] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [displayedUsers, setDisplayedUsers] = useState<User[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMoreUsers, setHasMoreUsers] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalUserCount, setTotalUserCount] = useState(0);
  const [allUsersLoaded, setAllUsersLoaded] = useState<User[]>([]);

  const [isDormant, setIsDormant] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearchInput, setShowSearchInput] = useState(false);

  // Unread Counts
  const [unreadPinchCount, setUnreadPinchCount] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [unreadStandaloneChatCount, setUnreadStandaloneChatCount] = useState(0);

  // Subscription
  const [isPaidUser, setIsPaidUser] = useState(false);
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<string | null>(null);
  const [usageLimits, setUsageLimits] = useState<UsageLimits | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // ✅ FIX: A lock to ensure we only fetch once on mount
  const hasFetchedOnce = useRef(false);

  useEffect(() => {
    const user = getCurrentUser();
    if (!user) {
      router.replace("/");
      return;
    }
    setCurrentUser(user);
    setMounted(true);
  }, [router]);

  const createConversationId = useCallback((userId1: number, userId2: number) => {
    const sortedIds = [userId1, userId2].sort((a, b) => a - b);
    return `chat-${sortedIds[0]}-${sortedIds[1]}`;
  }, []);

  const fetchSubscriptionStatus = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const limitsResponse = await subscriptionAPI.getUsageLimits(currentUser.id);
      if (limitsResponse.data) {
        setUsageLimits(limitsResponse.data);
        setIsPaidUser(limitsResponse.data.is_paid_user || false);
        setSubscriptionExpiresAt(limitsResponse.data.subscription_expires_at || null);
      }
    } catch {
      setIsPaidUser(false);
    }
  }, [currentUser]);

  const fetchUnreadStandaloneChatCount = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const receivedResponse = await pinchAPI.getReceivedPinches(currentUser.id);
      const sentResponse = await pinchAPI.getSentPinches(currentUser.id);
      const receivedPinches = receivedResponse.data.pinches || [];
      const sentPinches = sentResponse.data.pinches || [];

      const mutualUsers = new Set<number>();
      receivedPinches.forEach((pinch: { is_pinched_back?: boolean; pincher_id: number }) => {
        if (pinch.is_pinched_back) mutualUsers.add(pinch.pincher_id);
      });
      sentPinches.forEach((pinch: { pinched_id: number }) => {
        const hasResponse = receivedPinches.some(
          (r: { pincher_id: number; is_pinched_back?: boolean }) =>
            r.pincher_id === pinch.pinched_id && r.is_pinched_back
        );
        if (hasResponse) mutualUsers.add(pinch.pinched_id);
      });

      let totalUnread = 0;
      for (const userId of mutualUsers) {
        const conversationId = createConversationId(currentUser.id, userId);
        try {
          const response = await makeAuthenticatedRequest(
            "GET",
            `/standalone-chat/${conversationId}/messages`
          );
          const messages = response.data.messages || [];
          const unreadCount = messages.filter(
            (msg: { sender_id: number; read?: boolean }) =>
              msg.sender_id === userId && !msg.read
          ).length;
          if (unreadCount > 0) totalUnread += unreadCount;
        } catch {}
      }
      setUnreadStandaloneChatCount(totalUnread);
    } catch {}
  }, [currentUser, createConversationId]);

  const fetchUnreadChatCount = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const sentResponse = await dateAPI.getSentRequests(currentUser.id);
      const receivedResponse = await dateAPI.getPendingRequests(currentUser.id);
      const allRequests = [
        ...(sentResponse.data.requests || []),
        ...(receivedResponse.data.requests || []),
      ];
      const activeRequests = allRequests.filter(
        (req: { status?: string }) =>
          req.status === "accepted" ||
          req.status === "in_progress" ||
          req.status === "completed"
      );
      setUnreadChatCount(activeRequests.length);
    } catch {
      setUnreadChatCount(0);
    }
  }, [currentUser]);

  const fetchUnreadPinchCount = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const receivedResponse = await pinchAPI.getReceivedPinches(currentUser.id);
      const receivedPinches = receivedResponse.data.pinches || [];
      const sentResponse = await pinchAPI.getSentPinches(currentUser.id);
      const sentPinches = sentResponse.data.pinches || [];

      const mutualUsers = new Set<number>();
      receivedPinches.forEach((pinch: { is_pinched_back?: boolean; pincher_id: number }) => {
        if (pinch.is_pinched_back) mutualUsers.add(pinch.pincher_id);
      });
      sentPinches.forEach((pinch: { pinched_id: number }) => {
        const hasResponse = receivedPinches.some(
          (r: { pincher_id: number; is_pinched_back?: boolean }) =>
            r.pincher_id === pinch.pinched_id && r.is_pinched_back
        );
        if (hasResponse) mutualUsers.add(pinch.pinched_id);
      });

      const newPinchCount = receivedPinches.filter(
        (pinch: { pincher_id: number; is_read?: boolean }) =>
          !mutualUsers.has(pinch.pincher_id) && !pinch.is_read
      ).length;
      setUnreadPinchCount(newPinchCount);
    } catch {}
  }, [currentUser]);

  const fetchPendingCount = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const response = await dateAPI.getPendingCount(currentUser.id);
      setPendingRequestsCount(response.data.pending_count || 0);
    } catch {
      setPendingRequestsCount(0);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const dormant = currentUser.user_type === "dormant" || currentUser.is_available === false;
    setIsDormant(dormant);
    if (dormant) {
      setNearbyUsers([]);
      setSearchResults([]);
      setDisplayedUsers([]);
      setAllUsersLoaded([]);
    }
  }, [currentUser]);

  const loadNearbyUsers = useCallback(
    async (page = 1, isRefresh = false) => {
      if (!currentUser) return;
      if (isDormant) {
        setLoadingUsers(false);
        return;
      }
      
      if (isRefresh) {
        setDisplayedUsers([]);
        setCurrentPage(1);
        setHasMoreUsers(true);
        setTotalUserCount(0);
        setAllUsersLoaded([]);
        setError(null);
      }

      setIsLoadingMore(true);
      setLoadingUsers(true);

      try {
        if (typeof window !== "undefined" && navigator.geolocation) {
          try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 60000,
              });
            });

            await userAPI.updateLocation(currentUser.id, {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
            
            setCurrentUser(prev => prev ? { 
              ...prev, 
              latitude: position.coords.latitude, 
              longitude: position.coords.longitude 
            } : prev);

          } catch (geoError) {
            console.warn("Geolocation denied or failed:", geoError);
            setError("Please enable location services in your device settings.");
            setLoadingUsers(false);
            setIsLoadingMore(false);
            return;
          }
        }

        const targetGender = currentUser.gender === "male" ? "female" : "male";
        const response = await userAPI.getNearbyUsers(
          currentUser.id,
          targetGender,
          page,
          PAGE_SIZE
        );
        const { users, pagination } = response.data as NearbyResponse;

        setDisplayedUsers((prev) => {
          if (isRefresh) return users || [];
          const existingIds = new Set(prev.map((u) => u.id));
          const newUsers = (users || []).filter((u) => !existingIds.has(u.id));
          return [...prev, ...newUsers];
        });

        setAllUsersLoaded((prev) => {
          if (isRefresh) return users || [];
          const existingIds = new Set(prev.map((u) => u.id));
          const newUsers = (users || []).filter((u) => !existingIds.has(u.id));
          return [...prev, ...newUsers];
        });

        setCurrentPage(page);
        setHasMoreUsers(pagination.has_more);
        setTotalUserCount(pagination.total_users);
        setNearbyUsers((prev) => isRefresh ? (users || []) : [...prev, ...(users || [])]);
        setError(null);
      } catch (err: unknown) {
        const e = err as { response?: { data?: { message?: string } } };
        setError(e.response?.data?.message || "Unable to load users.");
        if (isRefresh) {
          setDisplayedUsers([]);
          setAllUsersLoaded([]);
          setTotalUserCount(0);
          setHasMoreUsers(false);
        }
      } finally {
        setIsLoadingMore(false);
        setLoadingUsers(false);
      }
    },
    [currentUser, isDormant]
  );

  // ✅ FIX: Only run the initial fetch exactly ONCE when the user mounts
  useEffect(() => {
    if (!currentUser) return;
    
    // If we've already triggered the fetch for this session, do nothing.
    if (hasFetchedOnce.current) return;
    hasFetchedOnce.current = true;

    const isCurrentlyDormant = currentUser.user_type === "dormant" || currentUser.is_available === false;
    if (!isCurrentlyDormant) {
      loadNearbyUsers(1, true);
    }
    
    fetchPendingCount();
    fetchUnreadPinchCount();
    fetchUnreadChatCount();
    fetchUnreadStandaloneChatCount();
    fetchSubscriptionStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const paddingToBottom = 300;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - paddingToBottom) {
      if (hasMoreUsers && !isLoadingMore && !isDormant) {
        loadNearbyUsers(currentPage + 1);
      }
    }
  }

  const handleSearch = useCallback(
    async (query = searchQuery) => {
      const trimmed = (query || "").trim();
      if (!trimmed || isDormant) {
        setSearchResults([]);
        return;
      }

      setSearching(true);
      try {
        const q = trimmed.toLowerCase();
        let dbMatches: User[] = [];
        try {
          const response = await userAPI.getAllUsers();
          const allUsers: User[] = response.data.users || [];
          dbMatches = allUsers.filter((user) => {
            if (!user || user.id === currentUser?.id) return false;
            const username = (user.username || "").toLowerCase();
            const email = (user.email || "").toLowerCase();
            return username.includes(q) || email.includes(q);
          });
        } catch {}

        const loadedPool = allUsersLoaded.length > 0 ? allUsersLoaded : displayedUsers;
        const loadedMatches = loadedPool.filter((user) => {
          if (!user || user.id === currentUser?.id) return false;
          const bio = (user.bio || "").toLowerCase();
          const description = (user.description || "").toLowerCase();
          return bio.includes(q) || description.includes(q);
        });

        const seenIds = new Set<number>();
        const merged: User[] = [];
        [...dbMatches, ...loadedMatches].forEach((user) => {
          if (!seenIds.has(user.id)) {
            seenIds.add(user.id);
            merged.push(user);
          }
        });
        setSearchResults(merged);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    },
    [searchQuery, isDormant, currentUser, allUsersLoaded, displayedUsers]
  );

  useEffect(() => {
    if (searchQuery.trim().length > 1 && !isDormant) {
      handleSearch(searchQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allUsersLoaded.length]);

  function toggleSearchInput() {
    if (isDormant) {
      window.alert("Account Dormant: Please reactivate your account to search for users.");
      return;
    }
    if (showSearchInput) {
      setSearchQuery("");
      setSearchResults([]);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    }
    setShowSearchInput(!showSearchInput);
  }

  function clearSearch() {
    setSearchQuery("");
    setSearchResults([]);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
  }

  function handleSearchChange(text: string) {
    if (isDormant) return;
    setSearchQuery(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (text.trim().length > 1) {
      searchTimeoutRef.current = setTimeout(() => handleSearch(text), 300);
    } else {
      setSearchResults([]);
    }
  }

  function handleUserTypeChange(newUserType: string) {
    setCurrentUser((prev) =>
      prev ? { ...prev, user_type: newUserType, is_available: newUserType !== "dormant" } : prev
    );
    const dormant = newUserType === "dormant";
    setIsDormant(dormant);
    if (dormant) {
      setNearbyUsers([]);
      setSearchResults([]);
      setDisplayedUsers([]);
      setAllUsersLoaded([]);
    } else {
      // If they switch back to available, re-fetch the feed
      setTimeout(() => loadNearbyUsers(1, true), 100);
    }
  }

  function handleProfileUpdated(updatedProfile: Record<string, unknown>) {
    if (!updatedProfile) return;
    setCurrentUser((prev) => (prev ? ({ ...prev, ...updatedProfile } as User) : prev));
    const nowDormant = updatedProfile.user_type === "dormant" || updatedProfile.is_available === false;
    if (nowDormant !== isDormant) {
      setIsDormant(nowDormant);
      if (nowDormant) {
        setNearbyUsers([]);
        setSearchResults([]);
        setDisplayedUsers([]);
        setAllUsersLoaded([]);
      } else {
        setTimeout(() => loadNearbyUsers(1, true), 100);
      }
    }
  }

  async function sendDateRequest() {
    if (!selectedUser || !dateOffer.description) {
      window.alert("Error: Please fill in date details");
      return;
    }
    if (isDormant) {
      window.alert("Account Dormant: Please reactivate your account to send requests.");
      return;
    }

    try {
      const requestData = {
        inviter_id: currentUser!.id,
        invitee_id: selectedUser.id,
        offer: dateOffer,
      };
      await dateAPI.createRequest(requestData);
      window.alert("Request sent! 💌");
      setModalVisible(false);
      setDateOffer({ description: "", price: "0", location: "", dateTime: "" });
      fetchPendingCount();
      fetchUnreadChatCount();
      fetchSubscriptionStatus();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { requires_upgrade?: boolean; message?: string } } };
      if (e.response?.data?.requires_upgrade) {
        setShowPaywall(true);
        window.alert(e.response.data.message || "You have reached your limit. Upgrade to unlimited!");
      } else {
        window.alert("Error: Failed to send request");
      }
    }
  }

  function getActionButtonText(user: User) {
    if (isDormant) return "Account Dormant";
    switch (user.user_type) {
      case "professional": return "Book Service";
      case "product": return "Make Offer";
      case "dating":
      default: return user.is_available ? "Ask Out" : "Not Available";
    }
  }

  function getModalTitle(user: User) {
    if (isDormant) return "Account Dormant";
    switch (user.user_type) {
      case "professional": return `Book ${user.username}'s Service`;
      case "product": return `Make Offer for ${user.username}'s Product`;
      case "dating":
      default: return user.is_available ? `Ask ${user.username} Out` : `${user.username} is Not Available`;
    }
  }

  function canSendRequestToUser(user: User) {
    if (isDormant) return false;
    if (user.user_type === "general") return false;
    if (user.user_type === "dating" && !user.is_available) return false;
    return true;
  }

  function handleUserAction(user: User, e?: React.MouseEvent) {
    if (e && e.stopPropagation) e.stopPropagation();
    if (isDormant) {
      window.alert("Account Dormant: Please reactivate your account to interact with others.");
      return;
    }
    if (user.user_type === "general") {
      window.alert("General User: This user cannot receive requests");
      return;
    }
    if (user.user_type === "dating" && !user.is_available) {
      window.alert("Not Available: This user is not currently available for dates");
      return;
    }
    setSelectedUser(user);
    setModalVisible(true);
  }

  function handleTabChange(tab: string) {
    if (tab === "dates") {
      router.push("/app/dates");
      return;
    }
    if (tab === "chat") {
      router.push("/app/conversations");
      return;
    }
    setActiveTab(tab);
    if (tab === "discover" && !isDormant) {
      setTimeout(() => loadNearbyUsers(1, true), 100);
    } else if (tab === "discover" && isDormant) {
      setNearbyUsers([]);
      setDisplayedUsers([]);
    }
  }

  function handleViewProfile(user: User) {
    sessionStorage.setItem("viewingUser", JSON.stringify(user));
    router.push("/app/profile-detail");
  }

  function handleLogout() {
    if (!window.confirm("Are you sure you want to logout?")) return;
    logout();
    router.replace("/");
  }

  function getUserTypeDisplay(user: User) {
    switch (user.user_type) {
      case "professional": return "Service Provider";
      case "product": return "Product Seller";
      case "general": return "General User";
      case "dating":
      default: return "Dating Profile";
    }
  }

  function getUserStatusText(user: User) {
    if (isDormant) return " • Account Dormant";
    switch (user.user_type) {
      case "general": return " • Cannot Receive Requests";
      case "dating": return !user.is_available ? " • Unavailable" : " • Available for Dates";
      case "professional": return " • Available for Services";
      case "product": return " • Available for Offers";
      default: return "";
    }
  }

  function renderUserCard(user: User, index: number) {
    const uniqueKey = `user-${user.id}-${index}-${user.username}`;
    const userRating = user.average_rating || user.rating || 0;
    const totalRatings = user.total_ratings || 0;
    const shouldShowRating = user.user_type === "professional" || user.user_type === "product";
    const photoUrl = getFullImageUrl(user.photos?.[0] || user.photo);
    const distanceDisplay = user.distance_km !== undefined && user.distance_km !== null ? user.distance_km : "N/A";

    return (
      <div
        key={uniqueKey}
        onClick={() => handleViewProfile(user)}
        className={`bg-white rounded-xl p-4 mb-3 flex flex-row relative shadow-sm cursor-pointer ${isDormant ? "opacity-70 bg-[#F7FAFC]" : ""}`}
      >
        {user.is_verified && (
          <div className="absolute top-2 right-2 bg-[#F0FFF4] border border-[#48BB78] rounded-full p-0.5 z-10">
            <span className="text-[#48BB78] text-sm leading-none">✓</span>
          </div>
        )}

        <div className="w-20 mr-3 flex flex-col items-center">
          <div className="w-20 h-20 rounded-full overflow-hidden bg-[#E2E8F0] flex items-center justify-center">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt={user.username} className="w-20 h-20 object-cover" />
            ) : (
              <span className="text-[32px] font-bold text-[#A0AEC0]">{user.username?.charAt(0)?.toUpperCase() || "?"}</span>
            )}
          </div>
          {shouldShowRating && (
            <div className="mt-1 text-center">
              {userRating > 0 ? (
                <>
                  <StarRating rating={userRating} size={13} showNumber={true} />
                  {totalRatings > 0 && <p className="text-[9px] italic text-[#666]">({totalRatings})</p>}
                </>
              ) : (
                <p className="text-[9px] italic text-[#999]">No ratings</p>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex-1 min-w-0">
              <h3 className={`text-[18px] font-bold ${isDormant ? "text-[#A0AEC0]" : "text-[#FF6B6B]"}`}>
                {user.username}, {user.age}
              </h3>
              <div className="mt-0.5">
                <span className="inline-block text-[10px] text-[#6B46C1] bg-[#EDF2F7] px-1.5 py-0.5 rounded-lg">
                  {getUserTypeDisplay(user)}
                </span>
              </div>
            </div>
          </div>
          <p className={`text-[14px] mt-1 line-clamp-2 leading-[18px] ${isDormant ? "text-[#A0AEC0]" : "text-[#666]"}`}>
            {user.description || "No description provided"}
          </p>
          <div className="mt-1 flex items-center justify-between">
            <p className={`text-[12px] ${isDormant ? "text-[#A0AEC0]" : "text-[#999]"}`}>
              {distanceDisplay} km away
            </p>
          </div>
          <div className="mt-0.5">
            <p className={`text-[11px] italic truncate ${isDormant ? "text-[#A0AEC0]" : "text-[#666]"}`}>
              {getUserStatusText(user)}
            </p>
          </div>
        </div>

        <div className="flex items-center ml-2">
          <button
            onClick={(e) => handleUserAction(user, e)}
            disabled={!canSendRequestToUser(user) || isDormant}
            className={`rounded-full px-4 py-2 text-[14px] font-bold text-white ${
              !canSendRequestToUser(user) || isDormant
                ? "bg-[#CBD5E0] text-[#718096] cursor-not-allowed"
                : "bg-[#FF6B6B] active:opacity-80"
            }`}
          >
            {getActionButtonText(user)}
          </button>
        </div>
      </div>
    );
  }

  function renderDormantOverlay() {
    if (!isDormant || activeTab !== "discover") return null;
    return (
      <div className="absolute inset-0 bg-white/95 flex items-center justify-center p-5 z-[100]">
        <div className="bg-white rounded-2xl p-6 flex flex-col items-center max-w-[300px] shadow-lg border border-[#E2E8F0]">
          <span className="text-[48px] mb-4">😴</span>
          <h3 className="text-[20px] font-bold text-[#2D3748] mb-3">Account Dormant</h3>
          <p className="text-[14px] text-[#718096] text-center mb-5 leading-5">
            Your account is currently hidden. To interact with others, please reactivate your account in Profile settings.
          </p>
          <button
            onClick={() => setActiveTab("profile")}
            className="bg-[#6B46C1] text-white font-semibold text-[16px] rounded-lg px-6 py-3 active:opacity-80"
          >
            Go to Profile
          </button>
        </div>
      </div>
    );
  }

  function renderDiscoverTab() {
    const hasActiveSearch = !isDormant && searchQuery.trim().length > 0;
    const matchedIds = new Set(searchResults.map((u) => u.id));
    const orderedUsers = hasActiveSearch ? [...searchResults, ...displayedUsers.filter((u) => !matchedIds.has(u.id))] : displayedUsers;

    return (
      <div className="relative flex-1">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 p-4 overflow-y-auto"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[20px] font-bold text-[#2D3748]">People Nearby</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleSearchInput}
                disabled={isDormant}
                className={`p-2 rounded-full active:opacity-70 ${showSearchInput ? "bg-[#6B46C1]" : "bg-[#EDF2F7]"}`}
              >
                <span className="text-[18px]">{showSearchInput ? "✕" : "🔍"}</span>
              </button>
              <button
                onClick={() => !isDormant && loadNearbyUsers(1, true)}
                disabled={loadingUsers || isDormant}
                className="bg-[#EDF2F7] p-2 rounded-full active:opacity-70"
              >
                <span className="text-[18px]">{loadingUsers ? "⏳" : "🔄"}</span>
              </button>
            </div>
          </div>

          {!isDormant && totalUserCount > 0 && (
            <p className="text-center text-[12px] text-[#A0AEC0] mb-2">
              {displayedUsers.length} of {totalUserCount} users
              {hasMoreUsers && " • Loading more..."}
            </p>
          )}

          {showSearchInput && !isDormant && (
            <div className="mb-4">
              <div className="flex items-center bg-white border border-[#E2E8F0] rounded-xl px-3">
                <input
                  type="text"
                  className="flex-1 py-3 text-[16px] text-[#2D3748] outline-none bg-transparent"
                  placeholder="Search by username, email, bio, or about..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  autoFocus
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                />
                {searchQuery.length > 0 && (
                  <button onClick={clearSearch} className="p-1">
                    <span className="text-[16px] font-bold text-[#A0AEC0]">✕</span>
                  </button>
                )}
              </div>
              {searching && <p className="text-[14px] italic text-[#666] text-center mt-2">Searching...</p>}
              {searchResults.length > 0 && (
                <p className="text-[14px] font-semibold text-[#6B46C1] text-center mt-2">
                  Found {searchResults.length} user{searchResults.length !== 1 ? "s" : ""}
                </p>
              )}
              {searchQuery.length > 0 && searchResults.length === 0 && !searching && (
                <p className="text-[14px] italic text-[#666] text-center mt-2">
                  No users found matching "{searchQuery}"
                </p>
              )}
            </div>
          )}

          {isDormant ? (
            <div className="py-10 text-center px-6">
              <p className="text-[16px] text-[#666] leading-6">
                Your account is dormant. Profiles are hidden. Reactivate your account in Profile settings to discover users.
              </p>
            </div>
          ) : loadingUsers && displayedUsers.length === 0 ? (
            <div className="py-10 text-center text-[#666]">Loading users...</div>
          ) : (
            (() => {
              if (orderedUsers.length === 0) {
                return (
                  <div className="py-10 text-center px-6">
                    <p className="text-[16px] text-[#666] leading-6 mb-4">
                      {error || (hasActiveSearch
                        ? `No users found matching "${searchQuery}"`
                        : currentUser!.user_type === "general"
                          ? "No users found nearby. Try refreshing or searching for specific users."
                          : "No matching users found nearby. Try refreshing or searching for specific users.")}
                    </p>
                    <button
                      onClick={() => !isDormant && loadNearbyUsers(1, true)}
                      disabled={isDormant}
                      className="bg-[#6B46C1] text-white font-semibold rounded-lg px-4 py-3 active:opacity-80"
                    >
                      Try Again
                    </button>
                  </div>
                );
              }

              return (
                <>
                  {hasActiveSearch && searchResults.length > 0 && (
                    <div className="flex items-center justify-between px-1 py-2 mb-1.5">
                      <p className="text-[13px] font-bold text-[#6B46C1] tracking-[0.3px]">
                        ✨ Matches for "{searchQuery}"
                      </p>
                      <p className="text-[12px] font-semibold text-[#718096]">
                        {searchResults.length} user{searchResults.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  )}

                  {orderedUsers.map((user, index) => renderUserCard(user, index))}

                  {hasActiveSearch && searchResults.length > 0 && orderedUsers.length > searchResults.length && (
                    <div className="flex items-center justify-between px-1 py-2 mb-1.5">
                      <p className="text-[13px] font-bold text-[#6B46C1] tracking-[0.3px]">
                        📍 Other nearby users
                      </p>
                    </div>
                  )}

                  {!hasActiveSearch && hasMoreUsers && (
                    <div className="h-px bg-transparent" />
                  )}

                  {!hasActiveSearch && !hasMoreUsers && displayedUsers.length > 0 && (
                    <div className="py-5 text-center">
                      <p className="text-[14px] text-[#A0AEC0]">✨ You've seen everyone</p>
                    </div>
                  )}
                </>
              );
            })()
          )}
        </div>
        {renderDormantOverlay()}
      </div>
    );
  }

  const totalChatUnread = unreadChatCount + unreadStandaloneChatCount;

  if (!mounted || !currentUser) {
    return <div className="flex min-h-screen items-center justify-center bg-[#F7FAFC]"><p className="text-[#666]">Loading…</p></div>;
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F7FAFC]">
      <div className="flex flex-row justify-between items-center px-5 pt-[60px] pb-5 bg-white border-b border-[#E2E8F0]">
        <div className="flex-1 min-w-0">
          <h1 className={`text-[20px] font-bold truncate ${isDormant ? "text-[#A0AEC0]" : "text-[#FF6B6B]"}`}>
            Hello, {currentUser.username} {isDormant ? "😴" : "👋"}
          </h1>
          <p className={`text-[14px] ${isDormant ? "text-[#A0AEC0]" : "text-[#666]"}`}>
            {isDormant ? "Account Dormant - Profiles Hidden" : "Browse user profiles"}
          </p>
        </div>
        <div className="flex flex-row items-center gap-2">
          <button className="relative p-2.5 active:opacity-70" onClick={() => router.push("/app/pinch")}>
            <span className="text-[24px]">👌</span>
            {unreadPinchCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-[#F56565] text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center border-2 border-white">
                {unreadPinchCount > 9 ? "9+" : unreadPinchCount}
              </span>
            )}
          </button>
          <button className="p-2.5 active:opacity-70" onClick={handleLogout}>
            <span className="text-[24px]">🚪</span>
          </button>
        </div>
      </div>

      <TabBar
        activeTab={activeTab}
        onTabChange={handleTabChange}
        pendingRequestsCount={pendingRequestsCount}
        unreadChatCount={totalChatUnread}
        unreadPinchCount={unreadPinchCount}
      />

      <main className="flex-1 overflow-hidden relative flex flex-col">
        {activeTab === "discover" && renderDiscoverTab()}
        {activeTab === "profile" && (
          <div className="flex-1 p-4 overflow-y-auto">
            <ProfileTab
              currentUser={currentUser}
              onBack={() => setActiveTab("discover")}
              onUserTypeChange={handleUserTypeChange}
              onProfileUpdated={handleProfileUpdated}
              onShowPaywall={() => setShowPaywall(true)}
            />
          </div>
        )}
      </main>

      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        currentUser={currentUser}
        onUpgradeSuccess={() => {
          setShowPaywall(false);
          fetchSubscriptionStatus();
          window.alert("🎉 Success! Your subscription has been activated. You now have unlimited access!");
        }}
      />

      {/* Ask-Out Modal — exact port from mobile MainScreen.js */}
      {modalVisible && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-[#E2E8F0]">
              <h2 className="text-[20px] font-bold text-[#2D3748] text-center">
                {getModalTitle(selectedUser)}
              </h2>
            </div>
            
            <div className="p-5 overflow-y-auto flex-1">
              {(selectedUser.user_type === "professional" || selectedUser.user_type === "product") && (
                <div className="flex items-center justify-center gap-2 bg-[#F7FAFC] rounded-lg p-3 mb-4">
                  <span className="text-[14px] text-[#666]">Rating:</span>
                  <StarRating rating={selectedUser.average_rating || 0} size={16} showNumber={true} />
                  <span className="text-[12px] italic text-[#999]">
                    {selectedUser.total_ratings || 0} rating{(selectedUser.total_ratings || 0) !== 1 ? "s" : ""}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-center gap-2 bg-[#F0F4FF] rounded-lg p-3 mb-4">
                <span className="text-[14px] font-semibold text-[#666]">Currency:</span>
                <span className="text-[16px] font-bold text-[#6B46C1]">
                  {getCurrencyForCountry(selectedUser.country).symbol} - {selectedUser.country || "USA"}
                </span>
              </div>

              {currentUser.user_type === "general" && (
                <div className="bg-[#E6FFFA] border-l-4 border-[#38B2AC] rounded-lg p-3 mb-4">
                  <p className="text-[14px] text-[#234E52] text-center">
                    💡 As a General User, you can send requests but cannot receive them.
                  </p>
                </div>
              )}

              <input
                className="w-full bg-[#F7FAFC] border border-[#E2E8F0] rounded-lg px-3 py-3 mb-3 text-[16px] text-[#2D3748] placeholder-[#A0AEC0]"
                placeholder="Description"
                value={dateOffer.description}
                onChange={(e) => setDateOffer({ ...dateOffer, description: e.target.value })}
                disabled={isDormant}
              />
              <input
                className="w-full bg-[#F7FAFC] border border-[#E2E8F0] rounded-lg px-3 py-3 mb-3 text-[16px] text-[#2D3748] placeholder-[#A0AEC0]"
                type="number"
                placeholder={`Price offer in ${getCurrencyForCountry(selectedUser.country || "USA").symbol} (0 for free)`}
                value={dateOffer.price}
                onChange={(e) => setDateOffer({ ...dateOffer, price: e.target.value })}
                disabled={isDormant}
              />
              <input
                className="w-full bg-[#F7FAFC] border border-[#E2E8F0] rounded-lg px-3 py-3 mb-3 text-[16px] text-[#2D3748] placeholder-[#A0AEC0]"
                placeholder="Location"
                value={dateOffer.location}
                onChange={(e) => setDateOffer({ ...dateOffer, location: e.target.value })}
                disabled={isDormant}
              />
              <input
                className="w-full bg-[#F7FAFC] border border-[#E2E8F0] rounded-lg px-3 py-3 mb-3 text-[16px] text-[#2D3748] placeholder-[#A0AEC0]"
                placeholder="Date and Time"
                value={dateOffer.dateTime}
                onChange={(e) => setDateOffer({ ...dateOffer, dateTime: e.target.value })}
                disabled={isDormant}
              />
            </div>

            <div className="p-5 border-t border-[#E2E8F0] flex gap-3 bg-white">
              <button
                onClick={() => setModalVisible(false)}
                className="flex-1 bg-[#EDF2F7] text-[#4A5568] font-medium rounded-lg py-3 active:opacity-80"
              >
                Cancel
              </button>
              <button
                onClick={sendDateRequest}
                disabled={isDormant}
                className={`flex-1 font-bold rounded-lg py-3 text-white ${
                  isDormant ? "bg-[#CBD5E0] cursor-not-allowed" : "bg-[#6B46C1] active:opacity-80"
                }`}
              >
                {isDormant ? "Dormant" : "Send Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}