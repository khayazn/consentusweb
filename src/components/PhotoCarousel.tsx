"use client";

import { useState } from "react";

interface PhotoCarouselProps {
  photos: string[];
  username: string;
}

function getFullImageUrl(path?: string): string {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `https://api-v1.consentus.online${path}`;
}

export default function PhotoCarousel({ photos, username }: PhotoCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageErrors, setImageErrors] = useState<Record<number, boolean>>({});

  const photoList = photos && photos.length > 0 ? photos : [];

  if (photoList.length === 0) {
    return (
      <div className="flex justify-center p-4">
        <div className="w-full aspect-square max-h-[500px] flex items-center justify-center bg-[#F0F0F0] rounded-2xl">
          <span className="text-[#999]">No photos</span>
        </div>
      </div>
    );
  }

  const handleSwipe = (direction: "left" | "right") => {
    if (direction === "left" && currentIndex < photoList.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else if (direction === "right" && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleImageError = (index: number) => {
    console.log(`❌ Carousel image ${index} failed to load:`, photoList[index]);
    setImageErrors((prev) => ({ ...prev, [index]: true }));
  };

  const currentPhoto = photoList[currentIndex];
  const hasError = imageErrors[currentIndex];

  return (
    <div className="flex justify-center p-4">
      <div className="relative w-full aspect-square max-h-[500px] flex justify-center items-center">
        
        {/* Right behind photo (next) */}
        {currentIndex < photoList.length - 1 && !imageErrors[currentIndex + 1] && (
          <div className="absolute right-0 w-[75%] h-[85%] rounded-xl overflow-hidden opacity-50 z-[2] scale-90">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getFullImageUrl(photoList[currentIndex + 1])}
              alt={`${username} photo ${currentIndex + 2}`}
              className="w-full h-full object-cover"
              onError={() => handleImageError(currentIndex + 1)}
            />
          </div>
        )}

        {/* Left behind photo (prev) */}
        {currentIndex > 0 && !imageErrors[currentIndex - 1] && (
          <div className="absolute left-0 w-[75%] h-[85%] rounded-xl overflow-hidden opacity-50 z-[2] scale-90">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getFullImageUrl(photoList[currentIndex - 1])}
              alt={`${username} photo ${currentIndex}`}
              className="w-full h-full object-cover"
              onError={() => handleImageError(currentIndex - 1)}
            />
          </div>
        )}

        {/* Main (front) photo */}
        <div className="absolute w-[85%] h-full rounded-2xl overflow-hidden z-[3] shadow-lg">
          {!hasError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={getFullImageUrl(currentPhoto)}
              alt={`${username} photo ${currentIndex + 1}`}
              className="w-full h-full object-contain bg-[#1A202C]"
              onError={() => handleImageError(currentIndex)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-[#F0F0F0] text-[#999] text-[14px]">
              Failed to load
            </div>
          )}
        </div>

        {/* Swipe / tap zones */}
        <button
          className="absolute left-0 top-0 h-full w-[20%] z-[4] focus:outline-none"
          onClick={() => handleSwipe("right")}
          aria-label="Previous photo"
        />
        <button
          className="absolute right-0 top-0 h-full w-[20%] z-[4] focus:outline-none"
          onClick={() => handleSwipe("left")}
          aria-label="Next photo"
        />

        {/* Dots indicator */}
        <div className="absolute bottom-4 flex flex-row z-[5]">
          {photoList.map((_, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full mx-1 transition-colors ${
                index === currentIndex ? "bg-[#FF6B6B]" : "bg-white/50"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}