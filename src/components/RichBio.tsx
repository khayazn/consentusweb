"use client";

import React from "react";

interface RichBioProps {
  text?: string;
}

// Matches: http(s)://..., www...., or bare domains like example.com/path
const URL_REGEX =
  /((?:https?:\/\/|www\.)[^\s]+|[a-z0-9-]+\.(?:com|net|org|io|co|app|dev|online|me|za|uk|us|info|biz|tv|edu|gov)(?:\/[^\s]*)?)/gi;

export default function RichBio({ text }: RichBioProps) {
  if (!text) return null;

  const parts = String(text).split(URL_REGEX);

  return (
    <div className="text-[16px] leading-6 text-[#4A5568] whitespace-pre-wrap">
      {parts.map((part, i) => {
        if (!part) return null;

        URL_REGEX.lastIndex = 0;
        if (URL_REGEX.test(part)) {
          const url = /^https?:\/\//i.test(part) ? part : `https://${part}`;
          return (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1e90ff] underline break-words"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </a>
          );
        }
        return <React.Fragment key={i}>{part}</React.Fragment>;
      })}
    </div>
  );
}