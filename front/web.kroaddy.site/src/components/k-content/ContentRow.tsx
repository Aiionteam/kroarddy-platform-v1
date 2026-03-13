"use client";

import React, { useRef } from "react";
import { ContentCard } from "./ContentCard";
import type { ContentCardProps } from "./ContentCard";

export interface ContentRowItem
  extends Pick<ContentCardProps, "title" | "description" | "imageUrl" | "placeholderGradient"> {
  id: string;
}

export interface ContentRowProps {
  title: string;
  items: ContentRowItem[];
  onCardClick?: (item: ContentRowItem) => void;
}

const CARD_WIDTH = 320;
const SCROLL_OFFSET = CARD_WIDTH + 12;

export function ContentRow({ title, items, onCardClick }: ContentRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (!rowRef.current) return;
    rowRef.current.scrollBy({
      left: dir === "right" ? SCROLL_OFFSET : -SCROLL_OFFSET,
      behavior: "smooth",
    });
  };

  if (items.length === 0) return null;

  return (
    <div className="mb-10">
      <div className="mb-3 flex items-baseline gap-2 px-6">
        <h2 className="text-base font-bold text-gray-800">{title}</h2>
      </div>
      <div className="relative group/row">
        <button
          type="button"
          onClick={() => scroll("left")}
          aria-label="Scroll left"
          className="absolute left-0 top-0 z-10 flex h-full w-10 items-center justify-center bg-gradient-to-r from-gray-100/90 to-transparent text-gray-600 opacity-0 transition-opacity hover:opacity-100 hover:text-gray-900 focus:opacity-100 group-hover/row:opacity-100"
        >
          ‹
        </button>
        <div
          ref={rowRef}
          className="flex gap-3 overflow-x-auto scroll-smooth px-6 pb-2 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {items.map((item) => (
            <ContentCard
              key={item.id}
              title={item.title}
              description={item.description}
              imageUrl={item.imageUrl}
              placeholderGradient={item.placeholderGradient}
              onClick={() => onCardClick?.(item)}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => scroll("right")}
          aria-label="Scroll right"
          className="absolute right-0 top-0 z-10 flex h-full w-10 items-center justify-center bg-gradient-to-l from-gray-100/90 to-transparent text-gray-600 opacity-0 transition-opacity hover:opacity-100 hover:text-gray-900 focus:opacity-100 group-hover/row:opacity-100"
        >
          ›
        </button>
      </div>
    </div>
  );
}
