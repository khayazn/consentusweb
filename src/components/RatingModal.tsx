"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ratingAPI } from "@/services/api";

interface RatingModalProps {
  requestId: number;
  ratedUserId: number;
  ratedUserName: string;
  offerType: "service" | "product" | "date";
  onBack: () => void;
  onSuccess?: () => void;
}

export default function RatingModal({
  requestId,
  ratedUserId,
  ratedUserName,
  offerType,
  onBack,
  onSuccess,
}: RatingModalProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Check if already rated
  useEffect(() => {
    (async () => {
      try {
        const response = await ratingAPI.checkRequestRating(requestId);
        if (response.data.has_rating) {
          window.alert("Already Rated: You have already rated this request.");
          onBack();
        }
      } catch {
        // silent — don't block
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  const handleSubmit = async () => {
    if (rating === 0) {
      window.alert("Rating Required: Please select a star rating before submitting.");
      return;
    }
    if (!comment.trim()) {
      const ok = window.confirm(
        "Comment Optional: Would you like to submit without a comment?"
      );
      if (!ok) return;
    }
    setSubmitting(true);
    try {
      await ratingAPI.submitRating({
        date_request_id: requestId,
        rating,
        comment: comment.trim(),
      });
      window.alert(
        `Rating Submitted! Thank you for rating ${ratedUserName}. Your feedback helps others make better decisions.`
      );
      onSuccess?.();
      onBack();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      const backendError = e.response?.data?.error || "Failed to submit rating.";
      window.alert(`Error: ${backendError}`);
    } finally {
      setSubmitting(false);
    }
  };

  const getTitle = () => {
    if (offerType === "service") return `Rate ${ratedUserName}'s Service`;
    if (offerType === "product") return `Rate ${ratedUserName}'s Product`;
    return `Rate ${ratedUserName}`;
  };

  const getDescription = () => {
    if (offerType === "service") return "How was the service provided?";
    if (offerType === "product") return "How was the product quality?";
    return "How was your experience?";
  };

  const displayRating = hoverRating || rating;

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F9FA]">
      {/* Header */}
      <div className="flex flex-row items-center justify-between px-5 pt-[60px] pb-4 bg-white border-b border-[#E2E8F0]">
        <button
          onClick={onBack}
          disabled={submitting}
          className="text-[#333] text-[24px] p-1 active:opacity-70 disabled:opacity-40"
        >
          ←
        </button>
        <h1 className="text-[18px] font-bold text-[#2D3748] flex-1 text-center">
          {getTitle()}
        </h1>
        <div className="w-8" />
      </div>

      <main className="flex-1 overflow-y-auto p-5">
        <p className="text-[16px] text-[#4A5568] text-center mb-6 leading-[22px]">
          {getDescription()}
        </p>

        {/* Stars */}
        <div className="mb-6">
          <p className="text-[16px] font-semibold text-[#2D3748] mb-3">
            Your Rating:
          </p>
          <div className="flex flex-col items-center">
            <div className="flex justify-center mb-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  onClick={() => setRating(i)}
                  onMouseEnter={() => setHoverRating(i)}
                  onMouseLeave={() => setHoverRating(0)}
                  disabled={submitting}
                  className="p-2 active:opacity-70 disabled:opacity-50"
                >
                  <span
                    className={`text-[40px] ${
                      i <= displayRating ? "text-[#FFD700]" : "text-[#E2E8F0]"
                    }`}
                  >
                    ★
                  </span>
                </button>
              ))}
            </div>
            <p className="text-[16px] italic text-[#666] mt-1">
              {rating === 0 ? "Tap stars to rate" : `${rating} out of 5 stars`}
            </p>
          </div>
        </div>

        {/* Comment */}
        <div className="mb-6">
          <p className="text-[16px] font-semibold text-[#2D3748] mb-2">
            Add a comment (optional):
          </p>
          <p className="text-[14px] text-[#718096] mb-2">
            Your feedback helps {ratedUserName} improve
          </p>
          <textarea
            className={`w-full bg-white border border-[#E2E8F0] rounded-lg p-3 text-[16px] text-[#2D3748] min-h-[100px] outline-none ${
              submitting ? "bg-[#F7FAFC] text-[#A0AEC0]" : ""
            }`}
            placeholder={`Share your experience with ${ratedUserName}'s ${offerType}...`}
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 500))}
            disabled={submitting}
            maxLength={500}
          />
          <p className="text-[12px] text-[#A0AEC0] text-right mt-1">
            {comment.length}/500 characters
          </p>
        </div>

        {/* Guidelines */}
        <div className="bg-[#EDF2F7] rounded-lg p-4 mb-4">
          <p className="text-[14px] font-bold text-[#4A5568] mb-2">
            Rating Guidelines:
          </p>
          {[
            { stars: "★", label: "Poor experience" },
            { stars: "★★", label: "Below average" },
            { stars: "★★★", label: "Average experience" },
            { stars: "★★★★", label: "Good experience" },
            { stars: "★★★★★", label: "Excellent experience" },
          ].map((g) => (
            <div key={g.stars} className="flex items-center mb-1">
              <span className="text-[14px] text-[#FFD700] mr-1">{g.stars}</span>
              <span className="text-[13px] text-[#718096]"> - {g.label}</span>
            </div>
          ))}
        </div>

        {/* Important notes */}
        <div className="bg-[#FFF3CD] border-l-4 border-[#FFC107] rounded-lg p-4">
          <p className="text-[14px] font-bold text-[#856404] mb-2">Important:</p>
          <p className="text-[13px] text-[#856404] mb-1">
            • Ratings are permanent and cannot be changed
          </p>
          <p className="text-[13px] text-[#856404] mb-1">
            • Be honest and constructive in your feedback
          </p>
          <p className="text-[13px] text-[#856404]">
            • Your rating affects {ratedUserName}&apos;s overall score
          </p>
        </div>
      </main>

      {/* Footer */}
      <div className="bg-white border-t border-[#E2E8F0] p-5 flex flex-col gap-3">
        <button
          onClick={handleSubmit}
          disabled={rating === 0 || submitting}
          className={`w-full py-4 rounded-lg font-bold text-[16px] text-white ${
            rating === 0 || submitting
              ? "bg-[#CBD5E0] cursor-not-allowed"
              : "bg-[#4CAF50] active:opacity-80"
          }`}
        >
          {submitting ? "Submitting…" : "Submit Rating"}
        </button>
        <button
          onClick={onBack}
          disabled={submitting}
          className="w-full py-4 rounded-lg font-medium text-[16px] text-[#4A5568] bg-[#F7FAFC] active:opacity-80 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}