"use client";

import React from "react";
import Image from "next/image";

export interface HeroBannerProps {
  title: string;
  subtitle: string;
  ctaLabel: string;
  onCtaClick?: () => void;
  /** Optional background image URL; uses gradient if not provided */
  backgroundImage?: string;
  /** Render title as solid color instead of gradient */
  solidTitle?: boolean;
  /** Match content-card style text on image */
  cardStyleText?: boolean;
}

export function HeroBanner({
  title,
  subtitle,
  ctaLabel,
  onCtaClick,
  backgroundImage,
  solidTitle = false,
  cardStyleText = false,
}: HeroBannerProps) {
  const [imgError, setImgError] = React.useState(false);
  React.useEffect(() => {
    setImgError(false);
  }, [backgroundImage]);

  return (
    <section
      className="relative flex min-h-[280px] w-full flex-col justify-end overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm px-8 pb-10 pt-12 md:min-h-[320px] md:px-12"
    >
      {backgroundImage && !imgError ? (
        <Image
          src={backgroundImage}
          alt={title}
          fill
          sizes="(max-width: 1024px) 100vw, 1200px"
          className="object-cover"
          onError={() => setImgError(true)}
          priority={false}
        />
      ) : null}
      {cardStyleText && backgroundImage && !imgError ? (
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-white/85" />
      )}
      {(!backgroundImage || imgError) && (
        <div className="absolute inset-0 bg-gradient-to-r from-purple-50 via-pink-50/80 to-indigo-50" />
      )}
      <div className="relative z-10 max-w-2xl">
        <h1
          className={
            cardStyleText && backgroundImage && !imgError
              ? "text-3xl font-bold tracking-tight text-white drop-shadow-md md:text-4xl"
              : solidTitle
              ? "text-3xl font-bold tracking-tight text-gray-900 md:text-4xl"
              : "bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent md:text-4xl"
          }
        >
          {title}
        </h1>
        <p
          className={
            cardStyleText && backgroundImage && !imgError
              ? "mt-2 text-base text-white/90 md:text-lg"
              : "mt-2 text-base text-gray-600 md:text-lg"
          }
        >
          {subtitle}
        </p>
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
