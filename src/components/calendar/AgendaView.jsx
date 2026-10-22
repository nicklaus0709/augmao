import React from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, SearchX } from "lucide-react";
import { StatusBadge, PriorityBadge, TypeBadge } from "@/components/common/Badges";
import EmptyState from "@/components/common/EmptyState";
import { cn } from "@/lib/utils";
import { addDays, isToday, startOfDay, formatTime, formatLongDate } from "@/lib/format";

export default function AgendaView({ events }) {
  const navigate = useNavigate();

  if (!events.length) {
    return (
      <div className="card-surface">
        <EmptyState icon={SearchX} title="No hay órdenes programadas en este período" />
      </div>
    );
  }

  const groups = {};
  for (const event of events) {
    const key = startOfDay(event.start).getTime();
    if (!groups[key]) groups[key] = [];
    groups[key].push(event);
  }

  return (
    <div className="space-y-4">
      {Object.entries(groups)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([key, list]) => {
          const date = new Date(Number(key));
          const today = isToday(date);
          return (
            <section key={key} className={cn("card-surface overflow-hidden", today && "ring-2 ring-brand-600")}>
              <header className={cn("flex items-center gap-2 border-b border-line px-4 py-2.5", today ? "bg-brand-50" : "bg-cream/60")}>
                <h2 className="font-heading text-sm font-bold text-navy">
                  {formatLongDate(date)}
                  {today && <span className="text-brand-600"> · Hoy</span>}
                </h2>
                <span className="ml-auto font-mono text-[11px] text-mutedText">{list.length}</span>
              </header>
              <ul className="divide-y divide-line/70">
                {list.map((event) => (
                  <li key={event.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/work-orders/${event.id}`)}
                      className="flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors hover:bg-cream sm:flex-row sm:items-center sm:gap-4"
                    >
                      <span className="w-[112px] shrink-0 text-sm">
                        <span className="font-semibold text-navy">{formatTime(event.start)}</span>
                        <span className="text-mutedText"> → {formatTime(event.end)}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 font-medium text-navy">
                          {event.priority === "CRITICAL" && <AlertTriangle size={13} className="text-red-600" aria-hidden="true" />}
                          <span className="truncate">{event.title}</span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-mutedText">
                          {event.code} · {event.assetLabel} · {event.technician}
                        </span>
                      </span>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <TypeBadge value={event.type} />
                        <PriorityBadge value={event.priority} />
                        <StatusBadge value={event.status} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
    </div>
  );
}