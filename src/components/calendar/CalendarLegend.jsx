import React from "react";
import { WO_TYPE, WO_PRIORITY } from "@/lib/constants";
import { cn } from "@/lib/utils";

export default function CalendarLegend({ hiddenTypes, hiddenPriorities, onToggleType, onTogglePriority, hideClosed, onToggleClosed }) {
  return (
    <div className="card-surface mb-5 p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(WO_TYPE).map(([key, cfg]) => {
            const hidden = hiddenTypes.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => onToggleType(key)}
                aria-pressed={!hidden}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border border-line px-2.5 py-1 text-xs font-medium text-navy transition-opacity",
                  hidden && "line-through opacity-40"
                )}
              >
                <span className={cn("h-2.5 w-2.5 rounded-sm", cfg.dot)} aria-hidden="true" />
                {cfg.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(WO_PRIORITY).map(([key, cfg]) => {
            const hidden = hiddenPriorities.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => onTogglePriority(key)}
                aria-pressed={!hidden}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border border-line px-2.5 py-1 text-xs font-medium text-navy transition-opacity",
                  hidden && "line-through opacity-40"
                )}
              >
                <span className={cn("h-1 w-4 rounded-full", cfg.dot)} aria-hidden="true" />
                {cfg.label}
              </button>
            );
          })}
        </div>

        <label className="ml-auto inline-flex items-center gap-2 text-xs text-navy">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-line text-brand-600 focus:ring-brand-600"
            checked={hideClosed}
            onChange={(e) => onToggleClosed(e.target.checked)}
          />
          Ocultar completadas y canceladas
        </label>
      </div>
    </div>
  );
}