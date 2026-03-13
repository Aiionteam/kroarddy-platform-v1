"use client";

import React from "react";

export interface ItineraryStep {
  time?: string;
  title: string;
  place?: string;
  description?: string;
}

export interface ItineraryDay {
  day: number;
  dateLabel?: string;
  steps: ItineraryStep[];
}

export interface ItineraryPreviewProps {
  title: string;
  days: ItineraryDay[];
}

export function ItineraryPreview({ title, days }: ItineraryPreviewProps) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:p-8">
      <h2 className="mb-6 text-xl font-bold text-gray-800">{title}</h2>
      <div className="space-y-8">
        {days.map((day) => (
          <div key={day.day}>
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500 text-sm font-bold text-white">
                {day.day}
              </span>
              <span className="text-sm font-semibold text-gray-500">
                Day {day.day}
                {day.dateLabel && ` · ${day.dateLabel}`}
              </span>
            </div>
            <ol className="relative space-y-4 border-l-2 border-purple-200 pl-6">
              {day.steps.map((step, idx) => (
                <li key={idx} className="relative">
                  <span className="absolute -left-[1.6rem] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-purple-100 text-[10px] font-bold text-purple-700">
                    {idx + 1}
                  </span>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {step.time && (
                        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                          {step.time}
                        </span>
                      )}
                      <span className="font-semibold text-gray-800">
                        {step.title}
                      </span>
                    </div>
                    {step.place && (
                      <p className="mt-1 text-xs text-gray-500">
                        📍 {step.place}
                      </p>
                    )}
                    {step.description && (
                      <p className="mt-1.5 text-sm text-gray-600">
                        {step.description}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}
