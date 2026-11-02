"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import EmojiPicker from "@/components/EmojiPicker";
import { makeAuthenticatedRequest, blockAPI, type User } from "@/services/api";
import { getCurrentUser } from "@/lib/auth";
import socketService from "@/lib/socket";
import { ensureNotificationPermission, notify } from "@/lib/notifications";

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

interface ChatMessage {
  id: string | number;
  text?: string;
  content?: string;
  message?: string;
  sender_id?: number;
  receiver_id?: number;
  timestamp?: string;
  read?: boolean;
  _temp?: boolean;
  localOnly?: boolean;
  conversation_id?: number | string;
}

interface DateInfo {
  offer?: {
    title?: string;
    description?: string;
    date?: string;
    time?: string;
    dateTime?: string;
    location?: string;
    price?: string | number;
  };
  status?: string;
  invitee_currency?: string;
  inviter_currency?: string;
  request_currency?: string;
  [key: string]: unknown;
}

type OtherUser = {
  id: number;
  username: string;
  photo?: string;
  photos?: string[];
  user_type?: string;
};

export default function ChatThreadPage() {
  const router = useRouter();
  const params = useParams();
  const chatId = params?.id as string | undefined;

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const processedMessageIds = useRef<Set<string | number>>(new Set());
  const tempMessagesRef = useRef<Set<string | number>>(new Set());
  const lastSentAtRef = useRef<number>(0);
  const isMounted = useRef(true);

  const [mounted, setMounted] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isStandaloneChat, setIsStandaloneChat] = useState(false);
  const [dateInfo, setDateInfo] = useState<DateInfo | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [emojiPickerVisible, setEmojiPickerVisible] = useState(false);

  const [isBlocked, setIsBlocked] = useState(false);
  const [amBlocked, setAmBlocked] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const cannotMessage = isBlocked || amBlocked;

  // ---- Boot ----
  useEffect(() => {
    const cu = getCurrentUser();
    if (!cu) {
      router.replace("/");
      return;
    }
    setCurrentUser(cu);
    ensureNotificationPermission();

    if (!chatId) {
      router.back();
      return;
    }

    const standalone = chatId.startsWith("chat-");
    setIsStandaloneChat(standalone);

    try {
      if (standalone) {
        const raw = sessionStorage.getItem("chatContext");
        if (!raw) {
          router.back();
          return;
        }
        const ctx = JSON.parse(raw) as {
          currentUser: User;
          otherUser: OtherUser;
          chatId: string;
        };
        setOtherUser(ctx.otherUser);
        setConversationId(ctx.chatId);
        setDateInfo(null);
      } else {
        const raw = sessionStorage.getItem("chatConversation");
        if (!raw) {
          router.back();
          return;
        }
        const conv = JSON.parse(raw) as {
          id: number;
          user: OtherUser;
          dateInfo?: DateInfo;
          status?: string;
        };
        setOtherUser(conv.user);
        setConversationId(String(conv.id));
        setDateInfo(conv.dateInfo ? { ...conv.dateInfo, status: conv.status || conv.dateInfo.status } : null);
      }
      setMounted(true);
    } catch {
      router.back();
    }
  }, [router, chatId]);

  // ---- Block status check ----
  useEffect(() => {
    if (!currentUser || !otherUser) return;
    let cancelled = false;
    blockAPI
      .getBlockStatus(otherUser.id)
      .then((res) => {
        if (cancelled) return;
        const status = res.data as {
          blocked?: boolean;
          blocked_by_me?: boolean;
          blocked_me?: boolean;
          is_blocked?: boolean;
        };
        setIsBlocked(Boolean(status?.blocked ?? status?.blocked_by_me ?? status?.is_blocked ?? false));
        setAmBlocked(Boolean(status?.blocked_me ?? false));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [currentUser, otherUser]);

  // ---- Socket ----
  useEffect(() => {
    if (!currentUser || !conversationId) return;
    isMounted.current = true;

    socketService.connectSocket(currentUser.id);
    setSocketConnected(Boolean(socketService.isConnected()));

    const onConnect = () => {
      if (!isMounted.current) return;
      setSocketConnected(true);
      if (isStandaloneChat) {
        socketService.joinStandaloneChat(conversationId, currentUser.id, currentUser.username);
      }
    };
    const onDisconnect = () => {
      if (isMounted.current) setSocketConnected(false);
    };

    const onMessage = (data: unknown) => {
      if (!isMounted.current) return;
      const payload = data as {
        message?: ChatMessage;
        conversation_id?: number | string;
        conversationId?: number | string;
      };
      const msg: ChatMessage = payload.message || (data as ChatMessage);
      const msgConvId = payload.conversation_id ?? payload.conversationId ?? msg.conversation_id;

      if (String(msgConvId) !== String(conversationId)) return;
      if (msg.id && String(msg.id).startsWith("temp_")) return;

      if (socketService.isMessageProcessed(msg.id as string | number) || processedMessageIds.current.has(msg.id as string | number)) {
        return;
      }
      socketService.markMessageProcessed(msg.id as string | number);
      processedMessageIds.current.add(msg.id as string | number);

      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        const cleaned = prev.filter((m) => !(m._temp && m.sender_id === msg.sender_id && (m.text === msg.text || m.content === msg.text)));
        return [...cleaned, msg];
      });

      if (msg.sender_id !== currentUser.id) {
        notify(otherUser?.username || "New message", msg.text || msg.content || "", () => window.focus());
        markMessages();
      }
    };

    const onTyping = (data: unknown) => {
      if (!isMounted.current) return;
      const d = data as {
        conversationId?: number | string;
        conversation_id?: number | string;
        userId?: number;
        user_id?: number;
        isTyping?: boolean;
        is_typing?: boolean;
      };
      const cid = d.conversationId ?? d.conversation_id;
      const uid = d.userId ?? d.user_id;
      const t = d.isTyping ?? d.is_typing;
      if (String(cid) === String(conversationId) && uid !== currentUser.id) {
        setOtherUserTyping(!!t);
        if (t) {
          setTimeout(() => {
            if (isMounted.current) setOtherUserTyping(false);
          }, 3000);
        }
      }
    };

    socketService.addListener("connect", onConnect);
    socketService.addListener("disconnect", onDisconnect);
    if (isStandaloneChat) {
      socketService.addListener("standaloneMessageReceived", onMessage);
      socketService.addListener("standaloneUserTyping", onTyping);
      if (socketService.isConnected()) {
        socketService.joinStandaloneChat(conversationId, currentUser.id, currentUser.username);
      }
    } else {
      socketService.addListener("messageReceived", onMessage);
      socketService.addListener("userTyping", onTyping);
    }

    return () => {
      isMounted.current = false;
      socketService.removeListener("connect");
      socketService.removeListener("disconnect");
      if (isStandaloneChat) {
        socketService.leaveStandaloneChat(conversationId, currentUser.id);
        socketService.removeListener("standaloneMessageReceived");
        socketService.removeListener("standaloneUserTyping");
      } else {
        socketService.removeListener("messageReceived");
        socketService.removeListener("userTyping");
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, conversationId, isStandaloneChat, otherUser?.username]);

  const messagesEndpoint = useCallback(() => {
    if (!conversationId) return "";
    return isStandaloneChat
      ? `/standalone-chat/${conversationId}/messages`
      : `/date-requests/${conversationId}/messages`;
  }, [conversationId, isStandaloneChat]);

  const markMessages = useCallback(async () => {
    if (!conversationId || !currentUser) return;
    try {
      if (isStandaloneChat) {
        socketService.markStandaloneMessagesRead(conversationId, currentUser.id);
        await makeAuthenticatedRequest("POST", `/standalone-chat/${conversationId}/read`, { user_id: currentUser.id }).catch(() => {});
      } else {
        socketService.markDateRequestMessagesRead(parseInt(conversationId, 10), currentUser.id);
        await makeAuthenticatedRequest("POST", `/date-requests/${conversationId}/read`, { user_id: currentUser.id }).catch(() => {});
      }
    } catch {
      // Silent
    }
  }, [conversationId, currentUser, isStandaloneChat]);

  const loadMessages = useCallback(async () => {
    if (!conversationId || !currentUser) return;
    try {
      setLoadError(null);
      const res = await makeAuthenticatedRequest("GET", messagesEndpoint()).catch(() => ({ data: null }));

      if (!res || !res.data) {
        return;
      }

      const raw = res.data;
      const list: ChatMessage[] = Array.isArray(raw) ? raw : raw?.messages || raw?.data || [];

      const cleaned = list
        .filter((m) => !tempMessagesRef.current.has(m.id))
        .map((m) => ({ ...m, text: m.text ?? m.content ?? m.message ?? "" }));

      const recentlySent = Date.now() - lastSentAtRef.current < 15000;
      if (recentlySent) {
        setMessages((prev) => {
          const serverIds = new Set(cleaned.map((m) => m.id));
          const optimisticOnly = prev.filter((m) => m._temp && !serverIds.has(m.id));
          return [...cleaned, ...optimisticOnly];
        });
      } else {
        setMessages(cleaned);
      }

      processedMessageIds.current = new Set(cleaned.map((m) => m.id as string | number));
      markMessages();
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (e) {
      console.error("Error loading messages:", e);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [conversationId, currentUser, messagesEndpoint, markMessages]);

  useEffect(() => {
    if (!currentUser || !conversationId) return;
    setLoading(true);
    loadMessages();

    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    pollingIntervalRef.current = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        loadMessages();
      }
    }, 5000);

    return () => {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    };
  }, [currentUser, conversationId, loadMessages]);

  // ---- Send message ----
  const sendMessage = async () => {
    const text = newMessage.trim();
    if (!text || !conversationId || !currentUser || sending || cannotMessage) return;

    setSending(true);
    lastSentAtRef.current = Date.now();

    const tempId = `temp_${Date.now()}`;
    tempMessagesRef.current.add(tempId);

    const optimistic: ChatMessage = {
      id: tempId,
      text,
      content: text,
      sender_id: currentUser.id,
      receiver_id: otherUser?.id,
      timestamp: new Date().toISOString(),
      read: false,
      _temp: true,
      localOnly: true,
      conversation_id: isStandaloneChat ? conversationId : parseInt(conversationId, 10),
    };

    setMessages((prev) => [...prev, optimistic]);
    setNewMessage("");
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }, 50);

    if (isTyping) {
      setIsTyping(false);
      if (isStandaloneChat) {
        socketService.sendStandaloneTyping(conversationId, currentUser.id, currentUser.username, false);
      } else {
        socketService.sendDateRequestTyping(parseInt(conversationId, 10), currentUser.id, currentUser.username, false);
      }
    }

    try {
      let response: any;
      let realMessage: ChatMessage | null = null;

      if (isStandaloneChat) {
        response = await makeAuthenticatedRequest(
          "POST",
          `/standalone-chat/${conversationId}/send-message`,
          { content: text }
        );
        realMessage = response.data?.message_data || response.data;
      } else {
        try {
          response = await makeAuthenticatedRequest(
            "POST",
            `/date-requests/${conversationId}/send-message`,
            {
              content: text,
              sender_id: currentUser.id,
              receiver_id: otherUser?.id,
            }
          );
          realMessage = response.data?.message_data || response.data;
        } catch (error: any) {
          console.error("Date-request send failed:", error?.response?.data || error?.message);
          if (error?.response?.status === 500) {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === tempId ? { ...msg, _temp: false, localOnly: true } : msg
              )
            );
            tempMessagesRef.current.delete(tempId);
            setSending(false);
            return;
          }
          throw error;
        }
      }

      if (realMessage && realMessage.id && isMounted.current) {
        processedMessageIds.current.add(realMessage.id);
        socketService.markMessageProcessed(realMessage.id);

        setMessages((prev) => {
          tempMessagesRef.current.delete(tempId);
          const exists = prev.some((msg) => msg.id === realMessage!.id);
          if (exists) {
            return prev.filter((msg) => msg.id !== tempId);
          }
          return prev.map((msg) => (msg.id === tempId ? realMessage! : msg));
        });
      } else if (isMounted.current) {
        setMessages((prev) =>
          prev.map((msg) => (msg.id === tempId ? { ...msg, _temp: false } : msg))
        );
        tempMessagesRef.current.delete(tempId);
      }
    } catch (e: any) {
      console.error("Send failed:", e?.response?.data || e?.message);
      tempMessagesRef.current.delete(tempId);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setLoadError("Message failed to send. Please try again.");
      setTimeout(() => {
        if (isMounted.current) setLoadError(null);
      }, 4000);
    } finally {
      if (isMounted.current) setSending(false);
    }
  };

  // ---- Typing ----
  const handleInputChange = (value: string) => {
    setNewMessage(value);
    if (!conversationId || !currentUser) return;

    if (!isTyping) {
      setIsTyping(true);
      if (isStandaloneChat) {
        socketService.sendStandaloneTyping(conversationId, currentUser.id, currentUser.username, true);
      } else {
        socketService.sendDateRequestTyping(parseInt(conversationId, 10), currentUser.id, currentUser.username, true);
      }
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      if (isStandaloneChat) {
        socketService.sendStandaloneTyping(conversationId, currentUser.id, currentUser.username, false);
      } else {
        socketService.sendDateRequestTyping(parseInt(conversationId, 10), currentUser.id, currentUser.username, false);
      }
    }, 1500);
  };

  // ---- Block / unblock ----
  const handleBlockToggle = async () => {
    if (!currentUser || !otherUser || blockBusy) return;
    setBlockBusy(true);
    try {
      if (isBlocked) {
        await blockAPI.unblockUser(otherUser.id);
        setIsBlocked(false);
      } else {
        await blockAPI.blockUser(otherUser.id);
        setIsBlocked(true);
      }
    } catch (e) {
      console.error("Block toggle failed:", e);
    } finally {
      if (isMounted.current) setBlockBusy(false);
    }
  };

  // ---- Render helpers ----
  const currencySymbol = getCurrencySymbolFromCode(
    dateInfo?.invitee_currency || dateInfo?.inviter_currency || dateInfo?.request_currency || "GBP"
  );

  const otherPhotoUrl = getFullImageUrl(otherUser?.photo || otherUser?.photos?.[0]);

  // ✅ FIX: Safely render the date, allowing free text
  const renderDateText = () => {
    if (!dateInfo?.offer?.date && !dateInfo?.offer?.dateTime) return "TBD";
    const rawDate = (dateInfo.offer.date || dateInfo.offer.dateTime) as string;
    
    const parsed = new Date(rawDate);
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    }
    return rawDate;
  };

  if (!mounted || !currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-[#666]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#F8F9FC]">
      {/* Header */}
      <div className="flex flex-row items-center px-4 pt-[60px] pb-3 bg-white border-b border-[#f0f0f0] shrink-0">
        <button onClick={() => router.back()} className="text-[#6B46C1] text-[16px] font-semibold active:opacity-70 mr-3">
          ← Back
        </button>
        <div className="w-10 h-10 rounded-full overflow-hidden bg-[#f0f0f0] mr-3 shrink-0 border border-gray-200">
          {otherPhotoUrl ? (
            <img src={otherPhotoUrl} alt={otherUser?.username || "User"} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[#A0AEC0] font-bold">
              {otherUser?.username?.charAt(0)?.toUpperCase() || "?"}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-bold text-[#2D3748] truncate">{otherUser?.username || "Chat"}</p>
          <p className="text-[12px] text-[#38A169] truncate">
            {otherUserTyping ? "typing…" : socketConnected ? "Online" : "Connecting…"}
          </p>
        </div>
      </div>

      {/* Date Info Banner */}
      {dateInfo && !isStandaloneChat && (
        <div className="mx-4 mt-4 mb-2 bg-[#F4F1FA] rounded-2xl border border-[#E2D8F5] px-5 py-4 shrink-0 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[18px]">📅</span>
            <p className="text-[16px] font-bold text-[#6B46C1]">
              Date Plan with {otherUser?.username}
            </p>
          </div>

          <div className="mb-3">
            <p className="text-[20px] font-bold text-[#1A202C] leading-tight">
              {/* ✅ FIX: Fallback to description if title is missing */}
              {(dateInfo.offer?.title as string) || (dateInfo.offer?.description as string) || "Date Plan"}
            </p>
          </div>

          <div className="space-y-1.5 mb-4 text-[15px]">
            <div className="flex">
              <span className="w-20 font-semibold text-[#4A5568]">When:</span>
              <span className="text-[#2D3748]">
                {renderDateText()}
                {dateInfo.offer?.time ? ` at ${dateInfo.offer.time}` : ""}
              </span>
            </div>
            <div className="flex">
              <span className="w-20 font-semibold text-[#4A5568]">Where:</span>
              <span className="text-[#2D3748]">{(dateInfo.offer?.location as string) || "TBD"}</span>
            </div>
            <div className="flex">
              <span className="w-20 font-semibold text-[#4A5568]">Status:</span>
              <span className="text-[#38A169] font-medium capitalize">{dateInfo.status || "Accepted"}</span>
            </div>
          </div>

          {dateInfo.offer?.price && (
            <div className="pt-3 border-t border-[#E2D8F5] flex items-center gap-2">
              <span className="text-[18px]">💰</span>
              <p className="text-[16px] font-bold text-[#2D3748]">
                Offer Amount: <span className="text-[#38A169]">{currencySymbol}{dateInfo.offer.price}</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-[#FF6B6B] font-semibold">Loading messages…</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center mt-10">
            <p className="text-[18px] font-bold text-[#4A5568] text-center mb-1">No messages yet</p>
            <p className="text-[14px] text-[#A0AEC0] text-center">Chat about your date plans!</p>
          </div>
        ) : (
          <>
            {messages.map((msg) => {
              const isMine = msg.sender_id === currentUser.id;
              const text = msg.text || msg.content || msg.message || "";
              return (
                <div key={msg.id} className={`flex mb-3 ${isMine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${isMine ? "bg-[#6B46C1] text-white rounded-br-sm" : "bg-white text-[#2D3748] rounded-bl-sm border border-[#E2E8F0]"}`}>
                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{text}</p>
                    <p className={`text-[11px] mt-1 text-right flex items-center justify-end gap-1 ${isMine ? "text-white/70" : "text-[#A0AEC0]"}`}>
                      {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                      {/* ✅ FIX: Add blue checkmark for sent messages like mobile */}
                      {isMine && <span className="text-[14px] leading-none mb-0.5">✓</span>}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </main>

      {/* Footer Area */}
      <div className="bg-white border-t border-[#f0f0f0] shrink-0 pb-safe">
        
        {/* Block / Unblock Row (Mobile parity) */}
        {!isStandaloneChat && (
          <div className="px-4 py-3 border-b border-[#F7FAFC]">
            {isBlocked ? (
              <button onClick={handleBlockToggle} disabled={blockBusy} className="flex items-center gap-2 text-[#38A169] text-[15px] font-semibold active:opacity-70">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Unblock user
              </button>
            ) : (
              <button onClick={handleBlockToggle} disabled={blockBusy} className="flex items-center gap-2 text-[#E53E3E] text-[15px] font-semibold active:opacity-70">
                <span className="text-[18px]">🚫</span> Block user
              </button>
            )}
          </div>
        )}

        {/* Composer / Warning */}
        {cannotMessage ? (
          <div className="px-4 py-6 text-center bg-[#F7FAFC]">
            <p className="text-[15px] font-medium text-[#A0AEC0]">
              {isBlocked ? "You blocked this user" : "You cannot send messages to this user."}
            </p>
          </div>
        ) : (
          <div className="px-3 py-3">
            {emojiPickerVisible && (
              <div className="mb-2">
                <EmojiPicker
                  onEmojiSelected={(emoji: string) => {
                    handleInputChange(newMessage + emoji);
                    setEmojiPickerVisible(false);
                  }}
                />
              </div>
            )}
            <div className="flex flex-row items-center gap-2">
              <button onClick={() => setEmojiPickerVisible((v) => !v)} className="text-[28px] leading-none active:opacity-70">
                😊
              </button>
              <div className="flex-1">
                <textarea
                  ref={inputRef}
                  value={newMessage}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Type a message…"
                  rows={1}
                  className="w-full resize-none bg-[#F7FAFC] border border-transparent rounded-2xl px-4 py-3 text-[15px] text-[#2D3748] focus:outline-none focus:border-[#E2E8F0] focus:bg-white transition-colors max-h-32"
                />
              </div>
              <button
                onClick={sendMessage}
                disabled={!newMessage.trim() || sending}
                className="bg-[#9F7AEA] text-white font-semibold rounded-2xl px-5 py-3 text-[15px] active:opacity-80 disabled:opacity-50 shrink-0 transition-opacity"
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}