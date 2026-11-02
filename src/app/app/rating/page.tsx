"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import RatingModal from "@/components/RatingModal";

interface RatingRouteState {
  requestId: number;
  ratedUserId: number;
  ratedUserName: string;
  offerType: "service" | "product" | "date";
}

export default function RatingPage() {
  const router = useRouter();
  const [state, setState] = useState<RatingRouteState | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("ratingState");
    if (!raw) {
      router.back();
      return;
    }
    try {
      setState(JSON.parse(raw) as RatingRouteState);
      setMounted(true);
    } catch {
      router.back();
    }
  }, [router]);

  if (!mounted || !state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8F9FA]">
        <p className="text-[#666]">Loading…</p>
      </div>
    );
  }

  return (
    <RatingModal
      requestId={state.requestId}
      ratedUserId={state.ratedUserId}
      ratedUserName={state.ratedUserName}
      offerType={state.offerType}
      onBack={() => router.back()}
      onSuccess={() => {
        sessionStorage.removeItem("ratingState");
      }}
    />
  );
}