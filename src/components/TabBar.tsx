"use client";

interface TabBarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  pendingRequestsCount?: number;
  unreadChatCount?: number;
  unreadPinchCount?: number;
}

const tabs = [
  { key: "discover", label: "Discover", icon: "🔍" },
  { key: "dates", label: "D/S/P", icon: "💝🔨📦" },
  { key: "chat", label: "Chat", icon: "💬" },
  { key: "profile", label: "Profile", icon: "👤" },
];

export default function TabBar({
  activeTab,
  onTabChange,
  pendingRequestsCount = 0,
  unreadChatCount = 0,
  unreadPinchCount = 0,
}: TabBarProps) {
  const chatTotal = unreadChatCount + unreadPinchCount;
  const showChatPulse = chatTotal > 0;

  return (
    <div
      className="flex flex-row bg-white pt-2 pb-2"
      style={{
        borderTopWidth: 1,
        borderTopColor: "#E2E8F0",
        boxShadow: "0 -2px 3px rgba(0,0,0,0.1)",
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        const isChat = tab.key === "chat";
        const isDates = tab.key === "dates";
        const showChatBadge = isChat && chatTotal > 0;
        const showDatesBadge = isDates && pendingRequestsCount > 0;

        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className="flex-1 flex flex-col items-center justify-center relative py-2 active:opacity-70"
          >
            <div className="flex flex-col items-center justify-center relative">
              <div className="relative flex items-center justify-center">
                <span
                  className={`text-[20px] leading-none mb-1 inline-block ${
                    showChatPulse ? "consentus-tab-pulse" : ""
                  }`}
                >
                  {tab.icon}
                </span>

                {showChatBadge && (
                  <span
                    className={`absolute flex items-center justify-center ${
                      showChatPulse ? "consentus-tab-pulse" : ""
                    }`}
                    style={{
                      top: -6,
                      right: -10,
                      backgroundColor: "#F56565",
                      borderRadius: 12,
                      minWidth: 20,
                      height: 20,
                      paddingLeft: 4,
                      paddingRight: 4,
                      borderWidth: 2,
                      borderColor: "#FFFFFF",
                      boxShadow: "0 0 4px rgba(245,101,101,0.5)",
                      color: "#FFFFFF",
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    {chatTotal > 9 ? "9+" : chatTotal}
                  </span>
                )}
              </div>

              <span
                className={`text-[12px] mt-1 ${
                  isActive
                    ? "text-[#FF6B6B] font-bold"
                    : "text-[#718096] font-medium"
                }`}
              >
                {tab.label}
              </span>
            </div>

            {showDatesBadge && (
              <span
                className="absolute flex items-center justify-center text-white font-bold"
                style={{
                  top: 4,
                  right: "35%",
                  backgroundColor: "#FF6B6B",
                  borderRadius: 10,
                  minWidth: 18,
                  height: 18,
                  borderWidth: 2,
                  borderColor: "#FFFFFF",
                  fontSize: 10,
                }}
              >
                {pendingRequestsCount > 9 ? "9+" : pendingRequestsCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}