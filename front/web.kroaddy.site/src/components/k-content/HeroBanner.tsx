"use client";

import React from "react";

export interface HeroBannerProps {
  title: string;
  subtitle: string;
  ctaLabel: string;
  onCtaClick?: () => void;
  /** Optional background image URL; uses gradient if not provided */
  backgroundImage?: string;
}

export function HeroBanner({
  title,
  subtitle,
  ctaLabel,
  onCtaClick,
  backgroundImage,
}: HeroBannerProps) {
  return (
    <section
      className="relative flex min-h-[280px] w-full flex-col justify-end overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm px-8 pb-10 pt-12 md:min-h-[320px] md:px-12"
      style={
        backgroundImage
          ? {
              backgroundImage: `linear-gradient(to bottom, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.85) 70%), url(${backgroundImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : undefined
      }
    >
      {!backgroundImage && (
        <div className="absolute inset-0 bg-gradient-to-r from-purple-50 via-pink-50/80 to-indigo-50" />
      )}
      <div className="relative z-10 max-w-2xl">
        <h1 className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent md:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-base text-gray-600 md:text-lg">{subtitle}</p>
        {ctaLabel && (
          <button
            type="button"
            onClick={onCtaClick}
            className="mt-6 flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:shadow-md hover:opacity-90"
          >
            {ctaLabel}
          </button>
        )}
      </div>
    </section>
  );
}
