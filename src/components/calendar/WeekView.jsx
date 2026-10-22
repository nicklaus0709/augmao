import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { addDays, isToday, startOfDay, startOfWeek, formatTime } from "@/lib/format";

const HOUR_HEIGHT = 48;
const MIN_DURATION = 30;

function layoutDay(events) {
  const sorted = [...events].sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes);
  const clusters = [];
  let current = null;

  for (const event of sorted) {
    if (!current || event.startMinutes >= current.end) {
      current = { end: event.endMinutes, events: [] };
      clusters.push(current);
    }
    current.end = Math.max(current.end, event.endMinutes);
    current.events.push(event);
  }

  for (const cluster of clusters) {
    const columns = [];
    for (const event of cluster.events) {
      let index = columns.findIndex((column) => column.every((item) => item.endMinutes <= event.startMinutes));
      if (index === -1) {
        columns.push([]);
        index = columns.length - 1;
      }
      columns[index].push(event);
      event.column = index;
    }
    for (const event of cluster.events) event.columnCount = columns.length;
  }

  return sorted;
}

export default function WeekView({ cursor, events, onOpenDay }) {
  const navigate = useNavigate();
  const scrollRef = useRef(null);
  const weekStart = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const byDay = {};
  for (const event of events) {
    const key = startOfDay(event.start).getTime();
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push(event);
  }

  const earliest = Math.min(
    7 * 60,
    ...events.map((event) => event.startMinutes).filter((value) => Number.isFinite(value))
  );

  useEffect(() => {
    if (scrollRef.current) {
      const target = Math.max(0, (Number.isFinite(earliest) ? Math.min(earliest, 7 * 60) : 420) - 30);
      scrollRef.current.scrollTop = (target / 60) * HOUR_HEIGHT;
    }
  }, [earliest]);

  return (
    <div className="card-surface overflow-hidden">
      <div className="flex border-b border-line bg-cream/60">
        <div className="w-14 shrink-0" />
        {days.map((day) => {
          const today = isToday(day);
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onOpenDay(day)}
              className="flex flex-1 flex-col items-center gap-1 px-1 py-2 hover:bg-brand-50"
            >
              <span className="table-head">{["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"][days.indexOf(day)]}</span>
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                  today ? "bg-brand-600 text-white" : "text-navy"
                )}
              >
                {day.getDate()}
              </span>
            </button>
          );
        })}
      </div>

      <div ref={scrollRef} className="scroll-thin max-h-[620px] overflow-y-auto">
        <div className="flex">
          <div className="w-14 shrink-0">
            {Array.from({ length: 24 }, (_, hour) => (
              <div key={hour} className="relative" style={{ height: HOUR_HEIGHT }}>
                <span className="absolute -top-1.5 right-2 font-mono text-[10px] text-mutedText">
                  {String(hour).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {days.map((day) => {
            const today = isToday(day);
            const dayEvents = layoutDay(byDay[startOfDay(day).getTime()] || []);
            return (
              <div key={day.toISOString()} className={cn("relative flex-1 border-l border-line/70", today && "bg-brand-50/40")} style={{ height: 24 * HOUR_HEIGHT }}>
                {Array.from({ length: 24 }, (_, hour) => (
                  <div key={hour} className="border-b border-line/50" style={{ height: HOUR_HEIGHT }} />
                ))}

                {today && (
                  <div className="pointer-events-none absolute left-0 right-0 z-10 flex items-center" style={{ top: (nowMinutes / 60) * HOUR_HEIGHT }}>
                    <span className="h-2 w-2 rounded-full bg-red-600" />
                    <span className="h-px flex-1 bg-red-600" />
                  </div>
                )}

                {dayEvents.map((event) => {
                  const top = (event.startMinutes / 60) * HOUR_HEIGHT;
                  const height = Math.max(22, ((event.endMinutes - event.startMinutes) / 60) * HOUR_HEIGHT);
                  const widthPct = 100 / (event.columnCount || 1);
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => navigate(`/work-orders/${event.id}`)}
                      title={`${event.code} - ${event.title}\n${event.fullDate}\n${event.assetLabel}`}
                      className={cn(
                        "absolute overflow-hidden rounded-md px-1.5 py-1 text-left text-[10px] leading-tight",
                        event.typeEventClass,
                        event.status === "COMPLETED" && "opacity-60",
                        event.status === "CANCELLED" && "opacity-40 line-through"
                      )}
                      style={{
                        top,
                        height,
                        left: `${event.column * widthPct}%`,
                        width: `calc(${widthPct}% - 2px)`,
                        borderLeft: `4px solid ${event.priorityColor}`,
                      }}
                    >
                      <span className="flex items-center gap-1 font-medium">
                        {event.priority === "CRITICAL" && <AlertTriangle size={9} className="text-red-600" aria-hidden="true" />}
                        <span className="truncate">{formatTime(event.start)} · {event.code}</span>
                      </span>
                      <span className="block truncate">{event.title}</span>
                      {height > 46 && <span className="block truncate opacity-80">{event.assetLabel}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}