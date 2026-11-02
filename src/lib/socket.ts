"use client";

import { io, Socket } from "socket.io-client";

const SOCKET_URL = "https://api-v1.consentus.online";

let socket: Socket | null = null;
let listeners: Record<string, (...args: unknown[]) => void> = {};
let pingInterval: ReturnType<typeof setInterval> | null = null;
let joinedUserId: number | null = null;
let joinedStandaloneRooms = new Set<string>();

const messageTracking = {
  processedMessages: new Map<string, number>(),
  MAX_AGE: 24 * 60 * 60 * 1000,
  add(messageId: string | number) {
    if (messageId) {
      this.processedMessages.set(messageId.toString(), Date.now());
      this.cleanup();
    }
  },
  has(messageId: string | number): boolean {
    return messageId ? this.processedMessages.has(messageId.toString()) : false;
  },
  cleanup() {
    const now = Date.now();
    for (const [id, timestamp] of this.processedMessages.entries()) {
      if (now - timestamp > this.MAX_AGE) this.processedMessages.delete(id);
    }
  },
};

function armHeartbeat(userId: number) {
  if (pingInterval) clearInterval(pingInterval);
  pingInterval = setInterval(() => {
    if (socket && socket.connected) socket.emit("ping");
  }, 25000);
  joinedUserId = userId;
}

function rejoinRooms() {
  if (!socket || !socket.connected) return;
  if (joinedUserId) socket.emit("join", { userId: joinedUserId });
  joinedStandaloneRooms.forEach((conversationId) => {
    socket?.emit("joinStandaloneChat", {
      conversationId,
      userId: joinedUserId,
      username: "User",
    });
  });
}

export const connectSocket = (userId: number): Socket => {
  // Re-arm heartbeat even if already connected (fixes "list stops refreshing")
  if (socket && socket.connected) {
    if (userId) {
      socket.emit("join", { userId });
      armHeartbeat(userId);
    }
    return socket;
  }

  if (socket) {
    if (userId) joinedUserId = userId;
    socket.connect();
    return socket;
  }

  socket = io(SOCKET_URL, {
    transports: ["websocket"],
    forceNew: false,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    timeout: 20000,
  });

  socket.on("connect", () => {
    if (userId) {
      socket?.emit("join", { userId });
      armHeartbeat(userId);
      if (typeof window !== "undefined") {
        localStorage.setItem("socketConnected", "true");
      }
    }
    rejoinRooms();
  });

  socket.on("disconnect", (reason) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("socketConnected", "false");
    }
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
    if (reason === "io server disconnect" || reason === "transport close") {
      setTimeout(() => {
        if (userId) socket?.connect();
      }, 1000);
    }
  });

  socket.on("connect_error", (error) => {
    console.log("❌ Socket connection error:", error.message);
  });

  socket.on("error", (error) => {
    console.log("❌ Socket error:", error);
  });

  return socket;
};

export const disconnectSocket = () => {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
  removeAllListeners();
  messageTracking.processedMessages.clear();
};

export const getSocket = () => socket;
export const isConnected = () => socket && socket.connected;

export const emitEvent = (event: string, data: unknown) => {
  if (socket && socket.connected) {
    socket.emit(event, data);
    return true;
  }
  return false;
};

export const emitPinch = (
  pincherId: number,
  pinchedId: number,
  pincherData: unknown,
  pinchId: number,
  pinchedUsername: string,
  caption: string | null = null
) => {
  return emitEvent("sendPinch", {
    pincher_id: pincherId,
    pinched_id: pinchedId,
    pincher: pincherData,
    pinch_id: pinchId,
    pinched_username: pinchedUsername,
    caption,
    has_caption: !!caption,
  });
};

export const emitPinchBack = (
  pincherId: number,
  pinchedId: number,
  pincherData: unknown,
  originalPinchId: number,
  returnPinchId: number
) => {
  return emitEvent("pinchBack", {
    pincher_id: pincherId,
    pinched_id: pinchedId,
    pincher: pincherData,
    original_pinch_id: originalPinchId,
    return_pinch_id: returnPinchId,
  });
};

export const sendStandaloneMessage = (
  conversationId: string,
  messageData: unknown,
  senderId: number,
  receiverId: number
) => {
  return emitEvent("sendStandaloneMessage", {
    conversationId,
    message: messageData,
    senderId,
    receiverId,
    timestamp: new Date().toISOString(),
  });
};

// Backend listens for "typing", not "dateRequestTyping"
export const sendDateRequestTyping = (
  conversationId: number,
  userId: number,
  username: string,
  isTyping: boolean
) => {
  return emitEvent("typing", {
    conversationId,
    userId,
    username,
    isTyping,
  });
};

// Backend listens for "markRead", not "markDateRequestRead"
export const markDateRequestMessagesRead = (
  conversationId: number,
  userId: number
) => {
  return emitEvent("markRead", {
    conversationId,
    userId,
  });
};

export const sendStandaloneTyping = (
  conversationId: string,
  userId: number,
  username: string,
  isTyping: boolean
) => {
  return emitEvent("standaloneTyping", {
    conversationId,
    userId,
    username,
    isTyping,
  });
};

export const markStandaloneMessagesRead = (
  conversationId: string,
  userId: number
) => {
  return emitEvent("markStandaloneRead", { conversationId, userId });
};

export const joinStandaloneChat = (
  conversationId: string,
  userId: number,
  username: string
) => {
  joinedStandaloneRooms.add(conversationId);
  return emitEvent("joinStandaloneChat", { conversationId, userId, username });
};

export const leaveStandaloneChat = (
  conversationId: string,
  userId: number
) => {
  joinedStandaloneRooms.delete(conversationId);
  return emitEvent("leaveStandaloneChat", { conversationId, userId });
};

export const isMessageProcessed = (messageId: string | number): boolean =>
  messageTracking.has(messageId);

export const markMessageProcessed = (messageId: string | number): void =>
  messageTracking.add(messageId);

export const clearProcessedMessages = (): void => {
  messageTracking.processedMessages.clear();
};

export const addListener = (
  event: string,
  callback: (...args: unknown[]) => void
) => {
  if (socket) {
    if (listeners[event]) socket.off(event, listeners[event]);
    socket.on(event, callback);
    listeners[event] = callback;
  }
};

export const removeListener = (event: string) => {
  if (socket && listeners[event]) {
    socket.off(event, listeners[event]);
    delete listeners[event];
  }
};

export const removeAllListeners = () => {
  if (socket) {
    Object.keys(listeners).forEach((event) => {
      socket!.off(event, listeners[event]);
    });
    listeners = {};
  }
};

export const getActiveListeners = () => Object.keys(listeners);

export default {
  connectSocket,
  disconnectSocket,
  getSocket,
  isConnected,
  emitEvent,
  emitPinch,
  emitPinchBack,
  sendStandaloneMessage,
  sendStandaloneTyping,
  sendDateRequestTyping,
  markDateRequestMessagesRead,
  markStandaloneMessagesRead,
  joinStandaloneChat,
  leaveStandaloneChat,
  isMessageProcessed,
  markMessageProcessed,
  clearProcessedMessages,
  addListener,
  removeListener,
  removeAllListeners,
  getActiveListeners,
};