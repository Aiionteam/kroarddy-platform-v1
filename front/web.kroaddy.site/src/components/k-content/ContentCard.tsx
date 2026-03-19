"use client";

import React from "react";
import Image from "next/image";

export interface ContentCardProps {
  title: string;
  description: string;
  /** Optional image URL; uses gradient placeholder if not provided */
  imageUrl?: string | null;
  /** Optional gradient class for placeholder (e.g. from-violet-500 to-indigo-600) */
  placeholderGradient?: string;
  onClick?: () => void;
}

export function ContentCard({
  title,
  description,
  imageUrl,
  placeholderGradient = "from-violet-500 to-indigo-600",
  onClick,
}: ContentCardProps) {
  const [imgError, setImgError] = React.useState(false);
  React.useEffect(() => {
    setImgError(false);
  }, [imageUrl]);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex shrink-0 w-72 cursor-pointer overflow-hidden rounded-xl shadow-sm transition-all duration-200 hover:scale-105 hover:shadow-xl hover:z-10 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-gray-100 md:w-80"
      style={{ aspectRatio: "16/9" }}
    >
      {imageUrl && !imgError ? (
        <Image
          src={imageUrl}
          alt={title}
          fill
          sizes="(max-width: 768px) 288px, 320px"
          onError={() => setImgError(true)}
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div
          className={`absolute inset-0 bg-gradient-to-br ${placeholderGradient} flex items-center justify-center`}
        >
          <span className="text-5xl opacity-60 transition-transform duration-300 group-hover:scale-110">
            🎬
          </span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-4 text-left">
        <p className="text-sm font-bold leading-tight text-white drop-shadow-md">
          {title}
        </p>
        <p className="mt-1 line-clamp-2 text-xs text-white/80">{description}</p>
      </div>
    </button>
  );
}
