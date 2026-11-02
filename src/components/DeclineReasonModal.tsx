"use client";

interface DeclineReasonModalProps {
  visible: boolean;
  onClose: () => void;
  onReasonSelect: (reason: string) => void;
}

const reasons = [
  "Not interested",
  "Increase Budget",
  "Wrong timing",
  "Location not convenient",
  "Other",
];

export default function DeclineReasonModal({
  visible,
  onClose,
  onReasonSelect,
}: DeclineReasonModalProps) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl p-5 w-full max-w-md shadow-xl">
        <h2 className="text-[18px] font-bold mb-4 text-center text-[#2D3748]">
          Why are you declining?
        </h2>

        <div className="flex flex-col mb-4">
          {reasons.map((reason, index) => (
            <button
              key={index}
              onClick={() => onReasonSelect(reason)}
              className="py-4 border-b border-[#f0f0f0] text-left text-[16px] text-[#2D3748] active:bg-[#F7FAFC] transition-colors"
            >
              {reason}
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 bg-[#f0f0f0] text-[#666] text-[16px] rounded-lg active:opacity-80"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}