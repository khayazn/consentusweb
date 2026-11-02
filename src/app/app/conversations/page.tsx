"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { makeAuthenticatedRequest, type User } from "@/services/api";
import { getCurrentUser } from "@/lib/auth";
import socketService from "@/lib/socket";
import { ensureNotificationPermission, notify } from "@/lib/notifications";

interface Conversation {
  id: number;
  user: {
    id: number;
    username: string;
    photo?: string;
    photos?: string[];
  };
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  status: string;
  dateInfo: Record<string, unknown>;
}

function getFullImageUrl(path?: string): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `https://api-v1.consentus.online${path}`;
}

function formatTime(timestamp: string): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  return `${diffDays}d ago`;
}

export default function ConversationsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDormant, setIsDormant] = useState(false);
  const socketInitialized = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const cu = getCurrentUser();
    if (!cu) {
      router.replace("/");
      return;
    }
    setCurrentUser(cu);
    setMounted(true);
    ensureNotificationPermission();
  }, [router]);

  const loadConversations = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const profileRes = await makeAuthenticatedRequest(
        "GET",
        `/profile?user_id=${currentUser.id}`
      );
      const profile = profileRes.data;
      setIsDormant(
        profile?.user_type === "dormant" || profile?.is_available === false
      );

      const convRes = await makeAuthenticatedRequest(
        "GET",
        `/conversations/${currentUser.id}`
      ).catch(() => ({ data: null }));

      let formatted: Conversation[] = [];

      if (Array.isArray(convRes.data)) {
        // /api/conversations/{id} shape
        formatted = convRes.data.map((c: any) => ({
          id: c.id,
          user: {
            id: c.user?.id,
            username: c.user?.username,
            photo: c.user?.photos?.[0] || c.user?.photo,
            photos: c.user?.photos,
          },
          lastMessage: c.lastMessage || "No messages yet",
          timestamp: c.timestamp || "",
          unreadCount: c.unreadCount || 0,
          status: c.dateInfo?.status || "accepted",
          dateInfo: c.dateInfo || {},
        }));
      } else {
        // Fallback: manual join of sent + received
        const sentRes = await makeAuthenticatedRequest(
          "GET",
          `/date-requests/sent/${currentUser.id}`
        ).catch(() => ({ data: { requests: [] } }));
        const recvRes = await makeAuthenticatedRequest(
          "GET",
          `/date-requests/${currentUser.id}`
        ).catch(() => ({ data: { requests: [] } }));
        const all = [
          ...(sentRes.data?.requests || []),
          ...(recvRes.data?.requests || []),
        ];
        const active = all.filter((r: any) =>
          ["accepted", "in_progress", "completed"].includes(r?.status)
        );
        formatted = active.map((req: any) => {
          const isInviter = req.inviter_id === currentUser.id;
          const other = isInviter
            ? {
                id: req.invitee_id,
                username: req.invitee_username,
                photos: req.invitee_photos || [],
              }
            : {
                id: req.inviter_id,
                username: req.inviter_username,
                photos: req.inviter_photos || [],
              };
          return {
            id: req.id,
            user: {
              id: other.id,
              username: other.username,
              photo: other.photos?.[0],
              photos: other.photos,
            },
            lastMessage: req.last_message || "No messages yet",
            timestamp:
              req.last_message_at || req.updated_at || req.created_at || "",
            unreadCount: req.unread_count || 0,
            status: req.status || "accepted",
            dateInfo: req,
          };
        });
      }

      setConversations(formatted);
    } catch (e) {
      console.error("Error loading conversations:", e);
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    loadConversations();
  }, [currentUser, loadConversations]);

  // Socket-driven refresh (debounced) + notifications
  useEffect(() => {
    if (!currentUser || socketInitialized.current) return;
    socketInitialized.current = true;

    socketService.connectSocket(currentUser.id);

    const scheduleRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => loadConversations(), 500);
    };

    const onMessage = (data: any) => {
      scheduleRefresh();
      const msg = data?.message || data;
      const sender =
        msg?.sender_username || msg?.senderUsername || "New message";
      const body = msg?.text || msg?.content || "Sent you a message";
      const cid =
        data?.conversation_id ??
        data?.conversationId ??
        msg?.conversation_id ??
        "";
      notify(sender, body, () => router.push(`/app/chat/${cid}`));
    };
    const onRead = () => scheduleRefresh();

    socketService.addListener("messageReceived", onMessage);
    socketService.addListener("standaloneMessageReceived", onMessage);
    socketService.addListener("messagesRead", onRead);
    socketService.addListener("standaloneMessagesRead", onRead);
    socketService.addListener("pinchReceived", scheduleRefresh);
    socketService.addListener("pinchBackReceived", scheduleRefresh);

    return () => {
      socketService.removeListener("messageReceived");
      socketService.removeListener("standaloneMessageReceived");
      socketService.removeListener("messagesRead");
      socketService.removeListener("standaloneMessagesRead");
      socketService.removeListener("pinchReceived");
      socketService.removeListener("pinchBackReceived");
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [currentUser, loadConversations, router]);

  // Reload on tab focus (web AppState equivalent)
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") loadConversations();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [loadConversations]);

  function openConversation(conv: Conversation) {
    if (isDormant) return;
    sessionStorage.setItem("chatConversation", JSON.stringify(conv));
    router.push(`/app/chat/${conv.id}`);
  }

  if (!mounted || !currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-[#666]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-white relative">
      <div className="flex flex-row justify-between items-center px-5 pt-[60px] pb-4 bg-white border-b border-[#f0f0f0]">
        <button
          onClick={() => router.back()}
          className="text-[#6B46C1] text-[16px] font-semibold active:opacity-70"
        >
          ← Back
        </button>
        <h1 className="text-[24px] font-bold text-[#2D3748]">Messages</h1>
        {conversations.filter((c) => c.unreadCount > 0).length > 0 ? (
          <span className="bg-[#FF3B30] text-white text-[12px] font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center">
            {conversations.filter((c) => c.unreadCount > 0).length}
          </span>
        ) : (
          <div className="w-6" />
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <p className="text-[#FF6B6B] font-semibold">Loading conversations…</p>
        </div>
      ) : conversations.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-10">
          <p className="text-[18px] text-[#666] mb-2 text-center">
            No conversations yet
          </p>
          <p className="text-[14px] text-[#999] text-center leading-5">
            When you have accepted dates, you can chat with your matches here!
          </p>
        </div>
      ) : (
        <main className="flex-1 overflow-y-auto">
          {conversations.map((conv) => {
            const isUnread = conv.unreadCount > 0;
            const photoUrl = getFullImageUrl(conv.user.photo);
            return (
              <button
                key={conv.id}
                onClick={() => openConversation(conv)}
                disabled={isDormant}
                className="w-full flex flex-row items-center px-5 py-4 bg-white border-b border-[#f0f0f0] active:bg-[#F7FAFC] disabled:opacity-50 text-left"
              >
                <div className="relative mr-3 shrink-0">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-[#f0f0f0]">
                    {photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photoUrl}
                        alt={conv.user.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[#A0AEC0] font-bold text-[18px]">
                        {conv.user.username?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                    )}
                  </div>
                  {isUnread && (
                    <span className="absolute -top-1 -right-1 bg-[#FF3B30] text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center border-2 border-white">
                      {conv.unreadCount > 99 ? "99+" : conv.unreadCount}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-row justify-between items-center mb-1">
                    <p
                      className={`text-[16px] truncate ${
                        isUnread
                          ? "text-[#000] font-bold"
                          : "text-[#000] font-semibold"
                      }`}
                    >
                      {conv.user.username}
                    </p>
                    <p className="text-[12px] text-[#666] ml-2 shrink-0">
                      {formatTime(conv.timestamp)}
                    </p>
                  </div>
                  <p
                    className={`text-[14px] line-clamp-2 leading-5 ${
                      isUnread
                        ? "text-[#000] font-semibold"
                        : "text-[#666] font-normal"
                    }`}
                  >
                    {conv.lastMessage}
                  </p>
                  <p className="text-[12px] text-[#666] italic truncate mt-1">
                    {(conv.dateInfo.offer as { description?: string })
                      ?.description ||
                      (conv.dateInfo.description as string) ||
                      conv.status}
                  </p>
                </div>
              </button>
            );
          })}
        </main>
      )}

      {isDormant && (
        <div className="absolute inset-0 bg-white/95 flex items-center justify-center p-5 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-[300px] shadow-lg border border-[#E2E8F0]">
            <div className="text-center text-[48px] mb-4">😴</div>
            <h3 className="text-[20px] font-bold text-[#2D3748] text-center mb-3">
              Account Dormant
            </h3>
            <p className="text-[14px] text-[#718096] text-center mb-5 leading-5">
              Your account is currently hidden. Conversations are frozen. Please
              reactivate your account in Profile settings to send messages.
            </p>
            <button
              onClick={() => router.push("/app")}
              className="w-full bg-[#6B46C1] text-white font-semibold rounded-lg py-3 active:opacity-80"
            >
              Go to Profile
            </button>
          </div>
        </div>
      )}
    </div>
  );
}