"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { pinchAPI, userAPI, subscriptionAPI, makeAuthenticatedRequest } from "@/services/api";
import { getCurrentUser } from "@/lib/auth";
import socketService from "@/lib/socket";

const createConversationId = (userId1: number, userId2: number) => {
  const sortedIds = [userId1, userId2].sort((a, b) => a - b);
  return `chat-${sortedIds[0]}-${sortedIds[1]}`;
};

function getFullImageUrl(path?: string): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `https://api-v1.consentus.online${path}`;
}

interface PinchData {
  id: number;
  pincher_id: number;
  pinched_id: number;
  is_read: boolean;
  is_pinched_back: boolean;
  caption?: string;
  has_caption: boolean;
  created_at: string;
  rejected_at?: string;
  pincher_username: string;
  pincher_photos: string[];
  pincher_age: number;
  pincher_user_type: string;
  pinched_username?: string;
  pinched_photos?: string[];
  pinched_age?: number;
  pinched_user_type?: string;
  other_user: {
    id: number;
    username: string;
    age: number;
    photos: string[];
    user_type: string;
  };
}

export default function PinchesPage() {
  const router = useRouter();

  const [receivedPinches, setReceivedPinches] = useState<PinchData[]>([]);
  const [sentPinches, setSentPinches] = useState<PinchData[]>([]);
  const [rejectedPinches, setRejectedPinches] = useState<PinchData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"received" | "sent" | "history">("received");

  const [unreadPinchCount, setUnreadPinchCount] = useState(0);
  const [uniqueUnreadSenders, setUniqueUnreadSenders] = useState(0);
  const [mutualUsers, setMutualUsers] = useState<Set<number>>(new Set());
  const [unreadConversations, setUnreadConversations] = useState<Set<string>>(new Set());

  const [isDormant, setIsDormant] = useState(false);
  const [isPaidUser, setIsPaidUser] = useState(false);

  const [captionModalVisible, setCaptionModalVisible] = useState(false);
  const [selectedCaption, setSelectedCaption] = useState("");
  const [selectedUsername, setSelectedUsername] = useState("");
  const [pendingProfileUser, setPendingProfileUser] = useState<any>(null);

  const [currentUser, setCurrentUser] = useState<any>(null);
  const socketInitialized = useRef(false);

  const mutualUsersRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const cu = getCurrentUser();
    if (!cu) {
      router.replace("/");
      return;
    }
    setCurrentUser(cu);
  }, [router]);

  useEffect(() => {
    mutualUsersRef.current = mutualUsers;
  }, [mutualUsers]);

  useEffect(() => {
    if (!currentUser?.id) return;
    if (socketInitialized.current) return;

    socketService.connectSocket(currentUser.id);

    const onPinchReceived = () => {
      loadAllData();
      fetchSubscriptionStatus();
    };

    socketService.addListener("pinchReceived", onPinchReceived);
    socketService.addListener("pinchBackReceived", onPinchReceived);
    socketService.addListener("pinchSent", onPinchReceived);

    socketService.addListener("standaloneMessageReceived", () => {
      console.log("🔔 Message received via socket, checking unread status in 1s...");
      setTimeout(() => {
        checkUnreadMessagesDirectly();
      }, 1000);
    });

    socketInitialized.current = true;

    return () => {
      socketService.removeListener("pinchReceived");
      socketService.removeListener("pinchBackReceived");
      socketService.removeListener("pinchSent");
      socketService.removeListener("standaloneMessageReceived");
    };
  }, [currentUser?.id]);

  useEffect(() => {
    if (currentUser?.id) {
      loadAllData();
      fetchSubscriptionStatus();
      const interval = setInterval(() => {
        checkUnreadMessagesDirectly();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [currentUser?.id]);

  const checkDormantStatus = async () => {
    try {
      const response = await makeAuthenticatedRequest("GET", `/profile?user_id=${currentUser?.id}`);
      const userData = response.data;
      const dormant = userData?.user_type === "dormant" || userData?.is_available === false;
      setIsDormant(dormant);
    } catch (error) {}
  };

  const fetchSubscriptionStatus = async () => {
    if (!currentUser?.id) return;
    try {
      const limitsResponse = await subscriptionAPI.getUsageLimits(currentUser.id);
      if (limitsResponse.data) setIsPaidUser(limitsResponse.data.is_paid_user || false);
    } catch (error) {
      setIsPaidUser(false);
    }
  };

  const calculateMutualUsers = (received: PinchData[], sent: PinchData[]) => {
    const mutual = new Set<number>();
    const userMap = new Map<number, { received: PinchData[]; sent: PinchData[] }>();

    received.forEach((pinch) => {
      const uid = pinch.other_user.id;
      if (!userMap.has(uid)) userMap.set(uid, { received: [], sent: [] });
      userMap.get(uid)!.received.push(pinch);
      if (pinch.is_pinched_back) mutual.add(uid);
    });

    sent.forEach((pinch) => {
      const uid = pinch.other_user.id;
      if (!userMap.has(uid)) userMap.set(uid, { received: [], sent: [] });
      userMap.get(uid)!.sent.push(pinch);
    });

    userMap.forEach((interactions, uid) => {
      if (interactions.sent.length > 0 && interactions.received.length > 0) mutual.add(uid);
      interactions.sent.forEach((sp) => {
        if (received.some((r) => r.other_user.id === sp.other_user.id && r.is_pinched_back)) {
          mutual.add(sp.other_user.id);
        }
      });
    });

    setMutualUsers(mutual);
    mutualUsersRef.current = mutual;

    const visibleUnread = received.filter(p => !mutual.has(p.other_user.id) && !p.is_read).length;
    setUnreadPinchCount(visibleUnread);
  };

  const checkUnreadMessagesDirectly = async () => {
    if (!currentUser?.id) return;
    const mutualArray = Array.from(mutualUsersRef.current);
    if (mutualArray.length === 0) return;

    const uniqueSenders = new Set<number>();
    const unreadConvos = new Set<string>();

    for (const uid of mutualArray) {
      const cid = createConversationId(currentUser.id, uid);
      try {
        const res = await makeAuthenticatedRequest("GET", `/standalone-chat/${cid}/messages`);
        const messages = res.data.messages || [];
        const unread = messages.filter((m: any) => m.sender_id === uid && !m.read).length;

        if (unread > 0) {
          uniqueSenders.add(uid);
          unreadConvos.add(cid);
        }
      } catch (e) {}
    }

    setUniqueUnreadSenders(uniqueSenders.size);
    setUnreadConversations(new Set(unreadConvos));
  };

  const loadAllData = async () => {
    setLoading(true);
    try {
      await checkDormantStatus();

      const receivedRes = await pinchAPI.getReceivedPinches(currentUser!.id);
      const sentRes = await pinchAPI.getSentPinches(currentUser!.id);
      const historyRes = await pinchAPI.getPinchHistory(currentUser!.id);

      const received = receivedRes.data.pinches || [];
      const sent = sentRes.data.pinches || [];
      const rejected = historyRes.data.pinches || [];

      if (historyRes.data && historyRes.data.is_paid_user !== undefined) {
        setIsPaidUser(historyRes.data.is_paid_user);
      }

      const formattedReceived = received.map((p: any) => ({
        ...p,
        other_user: {
          id: p.pincher_id,
          username: p.pincher_username,
          age: p.pincher_age,
          photos: p.pincher_photos || [],
          user_type: p.pincher_user_type || "dating",
        },
      }));

      const basicFormattedSent = sent.map((p: any) => ({
        ...p,
        other_user: {
          id: p.pinched_id,
          username: p.pinched_username,
          age: p.pinched_age || p.pincher_age,
          photos: p.pinched_photos || p.pincher_photos || [],
          user_type: p.pinched_user_type || p.pincher_user_type || "dating",
        },
      }));

      const enhancedSent = await Promise.all(basicFormattedSent.map(async (pinch: any) => {
        try {
          const userResponse = await userAPI.getUserById(pinch.other_user.id);
          const completeUserData = userResponse.data.user || userResponse.data;
          return {
            ...pinch,
            other_user: {
              ...pinch.other_user,
              photos: completeUserData.photos || pinch.other_user.photos,
              username: completeUserData.username || pinch.other_user.username,
              user_type: completeUserData.user_type || pinch.other_user.user_type,
            }
          };
        } catch (error) {
          return pinch;
        }
      }));

      const formattedRejected = rejected.map((p: any) => ({
        ...p,
        other_user: {
          id: p.pincher_id,
          username: p.pincher_username,
          age: p.pincher_age,
          photos: p.pincher_photos || [],
          user_type: p.pincher_user_type || "dating",
        },
      }));

      setReceivedPinches(formattedReceived);
      setSentPinches(enhancedSent);
      setRejectedPinches(formattedRejected);

      calculateMutualUsers(formattedReceived, enhancedSent);
    } catch (e) {
      console.error("Error loading pinches:", e);
    } finally {
      setLoading(false);
    }
  };

  const handlePinchBack = async (pinch: PinchData) => {
    if (isDormant) return;
    try {
      await pinchAPI.pinchBack(pinch.id);
      await markPinchAsRead(pinch.id);
      window.alert(`You pinched ${pinch.other_user.username} back! 👌`);
      await loadAllData();
      await fetchSubscriptionStatus();
    } catch (e) { window.alert("Failed to pinch back"); }
  };

  const handleRejectPinch = async (pinch: PinchData) => {
    if (isDormant) return;
    if (!window.confirm(`Reject ${pinch.other_user.username}'s pinch? This will move it to history.`)) return;
    try {
      await pinchAPI.rejectPinch(pinch.id);
      await loadAllData();
    } catch (e) { window.alert("Failed to reject pinch"); }
  };

  const handleRestorePinch = async (pinch: PinchData) => {
    if (isDormant) return;
    if (!isPaidUser) {
      window.alert("Premium Feature: Upgrade to restore rejected pinches.");
      return;
    }
    if (!window.confirm(`Restore ${pinch.other_user.username}'s pinch?`)) return;
    try {
      await pinchAPI.restorePinch(pinch.id);
      await loadAllData();
    } catch (e) { window.alert("Failed to restore pinch"); }
  };

  const markPinchAsRead = async (pinchId: number) => {
    try {
      await pinchAPI.markPinchAsRead(pinchId);
      setReceivedPinches(prev => prev.map(p => p.id === pinchId ? { ...p, is_read: true } : p));
    } catch (e) {}
  };

  const handleMessage = (otherUser: any) => {
    if (isDormant) return;
    const cid = createConversationId(currentUser!.id, otherUser.id);
    sessionStorage.setItem("chatContext", JSON.stringify({ currentUser, otherUser, chatId: cid }));
    router.push(`/app/chat/${cid}`);
  };

  // ✅ FIXED: Navigate to the real profile-detail page (matches app/page.tsx pattern)
  const handleViewProfile = (otherUser: any) => {
    if (!otherUser?.id) return;
    sessionStorage.setItem("viewingUser", JSON.stringify(otherUser));
    router.push("/app/profile-detail");
  };

  const showCaptionWithAutoNavigate = (caption: string, username: string, user: any) => {
    setSelectedCaption(caption);
    setSelectedUsername(username);
    setPendingProfileUser(user);
    setCaptionModalVisible(true);
  };

  const filteredReceived = receivedPinches.filter((p) => !mutualUsers.has(p.other_user.id));

  if (!currentUser) return null;

  return (
    <div className="flex flex-col min-h-screen bg-[#F7FAFC]">

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pinchFlash {
          0% { background-color: #FFFFFF; opacity: 1; border-color: transparent; }
          50% { background-color: #FFE4E1; opacity: 0.8; border-color: #F56565; }
          100% { background-color: #FFFFFF; opacity: 1; border-color: transparent; }
        }
        .animate-pinch-flash {
          animation: pinchFlash 1s infinite ease-in-out !important;
          border-width: 2px !important;
          border-style: solid !important;
        }
      `}} />

      <div className="flex flex-row justify-between items-center px-5 pt-[60px] pb-5 bg-white border-b border-[#E2E8F0]">
        <button className="text-[#6B46C1] text-[16px] font-semibold active:opacity-70" onClick={() => router.back()}>← Back</button>
        <h1 className="text-[20px] font-bold text-[#2D3748]">Pinches</h1>
        <div className="w-12" />
      </div>

      <div className="flex bg-white border-b border-[#E2E8F0] px-4">
        {["received", "sent", "history"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`flex-1 py-4 text-center capitalize font-semibold relative ${
              activeTab === tab ? "text-[#6B46C1] border-b-[3px] border-[#6B46C1]" : "text-[#718096]"
            }`}
          >
            {tab}
            {tab === "received" && unreadPinchCount > 0 && (
              <span className="ml-1 bg-[#F56565] text-white text-[10px] px-1.5 py-0.5 rounded-full">{unreadPinchCount}</span>
            )}
            {tab === "sent" && uniqueUnreadSenders > 0 && (
              <span className="ml-1 bg-[#ED8936] text-white text-[10px] px-1.5 py-0.5 rounded-full">{uniqueUnreadSenders}</span>
            )}
            {tab === "history" && rejectedPinches.length > 0 && (
              <span className="ml-1 bg-[#718096] text-white text-[10px] px-1.5 py-0.5 rounded-full">{rejectedPinches.length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex justify-center items-center h-full text-[#6B46C1]">Loading pinches...</div>
        ) : (
          <div className="space-y-3">

            {activeTab === "received" && filteredReceived.map((pinch) => (
              <div
                key={pinch.id}
                className={`relative rounded-xl shadow-sm bg-white ${
                  !pinch.is_read ? "border border-[#6B46C1] bg-[#F0F4FF]" : ""
                } ${pinch.has_caption ? "bg-[#FFF8E7] border-2 border-[#FFB347]" : ""}`}
              >
                {pinch.has_caption && (
                  <span className="absolute -top-1.5 -right-1.5 bg-[#FFB347] text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] z-10">📝</span>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3">
                  
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {pinch.other_user.photos?.[0] ? (
                      <img 
                        src={getFullImageUrl(pinch.other_user.photos[0])} 
                        className="w-12 h-12 rounded-full object-cover shrink-0" 
                        alt={pinch.other_user.username}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-[#6B46C1] flex items-center justify-center text-white font-bold shrink-0">
                        {pinch.other_user.username?.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div 
                      className="flex-1 min-w-0 cursor-pointer" 
                      onClick={() => {
                        if (pinch.has_caption) showCaptionWithAutoNavigate(pinch.caption!, pinch.other_user.username, pinch.other_user);
                        else handleViewProfile(pinch.other_user);
                      }}
                    >
                      <p className="font-semibold text-[#2D3748] text-[15px] truncate">
                        {pinch.other_user.username}
                        {!pinch.is_read && <span className="text-[#F56565] text-xs ml-1">• New</span>}
                      </p>
                      <p className="text-xs text-[#A0AEC0]">
                        {new Date(pinch.created_at).toLocaleDateString()}
                      </p>
                      {pinch.has_caption && (
                        <p className="text-xs text-[#856404] italic mt-0.5 truncate">
                          💬 "{pinch.caption}"
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 sm:ml-auto">
                    <button 
                      onClick={() => handlePinchBack(pinch)} 
                      className="flex-1 sm:flex-none bg-[#6B46C1] text-white px-3 py-2 rounded-lg text-sm font-semibold active:opacity-80 whitespace-nowrap"
                    >
                      Pinch Back 👌
                    </button>
                    <button 
                      onClick={() => handleRejectPinch(pinch)} 
                      className="bg-[#FC8181] text-white px-3 py-2 rounded-lg text-sm font-bold active:opacity-80 shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {activeTab === "sent" && sentPinches.map((pinch) => {
              const isMutual = mutualUsers.has(pinch.other_user.id);
              const cid = createConversationId(currentUser.id, pinch.other_user.id);
              const hasUnread = unreadConversations.has(cid);

              return (
                <div
                  key={pinch.id}
                  className={`rounded-xl shadow-sm ${
                    hasUnread ? "animate-pinch-flash" : "bg-white border border-transparent"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {pinch.other_user.photos?.[0] ? (
                        <img 
                          src={getFullImageUrl(pinch.other_user.photos[0])} 
                          className="w-12 h-12 rounded-full object-cover shrink-0" 
                          alt={pinch.other_user.username}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-[#6B46C1] flex items-center justify-center text-white font-bold shrink-0">
                          {pinch.other_user.username?.charAt(0).toUpperCase()}
                        </div>
                      )}

                      <div 
                        className="flex-1 min-w-0 cursor-pointer" 
                        onClick={() => handleViewProfile(pinch.other_user)}
                      >
                        <p className="font-semibold text-[#2D3748] text-[15px] truncate">
                          {pinch.other_user.username}
                          {hasUnread && <span className="text-[#F56565] text-xs ml-1">• New</span>}
                        </p>
                        <p className="text-xs text-[#A0AEC0]">
                          {new Date(pinch.created_at).toLocaleDateString()}
                        </p>
                        {isMutual && (
                          <span className="inline-block bg-[#9F7AEA] text-white text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1">
                            ✨ Mutual
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 sm:ml-auto">
                      {isMutual ? (
                        <button 
                          onClick={() => handleMessage(pinch.other_user)} 
                          className="w-full sm:w-auto bg-[#38A169] text-white px-3 py-2 rounded-lg text-sm font-semibold active:opacity-80"
                        >
                          Message 💬
                        </button>
                      ) : (
                        <span className="inline-block w-full sm:w-auto bg-[#CBD5E0] text-[#4A5568] px-3 py-2 rounded-lg text-sm font-semibold text-center">
                          Pending
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {activeTab === "history" && rejectedPinches.map((pinch) => (
              <div key={pinch.id} className="rounded-xl shadow-sm bg-[#FFF5F5] border border-[#FED7D7]">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {pinch.other_user.photos?.[0] ? (
                      <img 
                        src={getFullImageUrl(pinch.other_user.photos[0])} 
                        className="w-12 h-12 rounded-full object-cover shrink-0" 
                        alt={pinch.other_user.username}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-[#6B46C1] flex items-center justify-center text-white font-bold shrink-0">
                        {pinch.other_user.username?.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleViewProfile(pinch.other_user)}>
                      <p className="font-semibold text-[#9B2C2C] text-[15px] truncate">
                        {pinch.other_user.username}
                        <span className="text-xs text-[#FC8181] ml-1">• Rejected</span>
                      </p>
                      <p className="text-xs text-[#A0AEC0]">
                        Rejected: {new Date(pinch.rejected_at || pinch.created_at).toLocaleDateString()}
                      </p>
                      {!isPaidUser && (
                        <span className="inline-block bg-[#EDF2F7] text-[#6B46C1] text-[10px] font-semibold px-2 py-0.5 rounded mt-1">
                          🔒 Premium
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 sm:ml-auto">
                    <button
                      onClick={() => handleRestorePinch(pinch)}
                      disabled={!isPaidUser || isDormant}
                      className={`w-full sm:w-auto flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold ${
                        isPaidUser ? "bg-[#48BB78] text-white active:opacity-80" : "bg-[#CBD5E0] text-[#718096]"
                      }`}
                    >
                      🔄 {isPaidUser ? "Restore" : "🔒 Premium"}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {((activeTab === "received" && filteredReceived.length === 0) ||
              (activeTab === "sent" && sentPinches.length === 0) ||
              (activeTab === "history" && rejectedPinches.length === 0)) && (
              <div className="text-center py-20">
                <p className="text-lg font-semibold text-[#2D3748] mb-2">No {activeTab} pinches</p>
                <p className="text-sm text-[#A0AEC0]">When you interact with others, they will appear here.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {isDormant && (
        <div className="fixed inset-0 bg-white/95 z-50 flex items-center justify-center p-6 text-center">
          <div className="bg-white p-6 rounded-2xl shadow-xl max-w-sm">
            <p className="text-5xl mb-4">😴</p>
            <h2 className="text-xl font-bold text-[#2D3748] mb-2">Account Dormant</h2>
            <p className="text-sm text-[#718096] mb-6">Your account is hidden. Pinches are frozen. Reactivate your account in Profile to interact.</p>
            <button onClick={() => router.push("/app")} className="bg-[#6B46C1] text-white px-6 py-2.5 rounded-lg font-semibold w-full">
              Go to Profile
            </button>
          </div>
        </div>
      )}

      {captionModalVisible && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-[#2D3748]">📝 Note from {selectedUsername}</h3>
              <button 
                onClick={() => { setCaptionModalVisible(false); if(pendingProfileUser) handleViewProfile(pendingProfileUser); }} 
                className="text-gray-500 text-xl font-bold"
              >
                ✕
              </button>
            </div>
            <p className="text-[#4A5568] mb-6 whitespace-pre-wrap">{selectedCaption}</p>
            <button
              onClick={() => { setCaptionModalVisible(false); if(pendingProfileUser) handleViewProfile(pendingProfileUser); }}
              className="w-full bg-[#6B46C1] text-white py-3 rounded-xl font-semibold active:opacity-80"
            >
              Got it - View Profile →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}