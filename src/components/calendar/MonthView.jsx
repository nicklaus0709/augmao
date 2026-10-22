import React from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { WO_TYPE, WO_PRIORITY } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { addDays, isSameDay, isToday, startOfDay, startOfWeek, formatTime, formatLongDate } from "@/lib/format";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function eventClasses(event) {
  const typeCls = WO_TYPE[event.type]?.event || "bg-slate-100 text-slate-900";
  const opacity = event.status === "COMPLETED" ? "opacity-60" : event.status === "CANCELLED" ? "opacity-40 line-through" : "";
  return cn("relative overflow-hidden rounded-md pl-2 pr-1 py-0.5 text-left text-[11px] leading-tight transition-colors", typeCls, opacity);
}

function EventTooltip({ event }) {
  return (
    <div className="pointer-events-none absolute z-20 hidden w-60 -translate-y-1 rounded-xl border border-line bg-white p-3 text-left text-xs shadow-lg group-hover:block">
      <p className="font-mono text-[10px] text-brand-600">{event.code} - {event.title}</p>
      <p className="mt-1 text-navy">{event.fullDate}</p>
      <p className="text-mutedText">{event.assetLabel}</p>
      <p className="text-mutedText">
        {WO_TYPE[event.type]?.label} · {WO_PRIORITY[event.priority]?.label}
      </p>
      <p className="text-mutedText">Estado: {event.statusLabel}</p>
      <p className="text-mutedText">Técnico: {event.technician}</p>
      <p className="text-mutedText">Duración: {event.durationText}</p>
    </div>
  );
}

export default function MonthView({ cursor, events, onOpenWeek }) {
  const navigate = useNavigate();
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const days = [];
  for (let i = 0; i < 42; i++) days.push(addDays(gridStart, i));
  const lastWeek = days.slice(35);
  if (lastWeek.every((day) => day.getMonth() !== cursor.getMonth())) days.length = 35;

  const eventsByDay = {};
  for (const event of events) {
    const key = startOfDay(event.start).getTime();
    if (!eventsByDay[key]) eventsByDay[key] = [];
    eventsByDay[key].push(event);
  }

  return (
    <div className="card-surface overflow-hidden">
      <div className="grid grid-cols-7 border-b border-line bg-cream/60">
        {WEEKDAYS.map((day) => (
          <div key={day} className="table-head px-2 py-2 text-center">{day}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayEvents = eventsByDay[startOfDay(day).getTime()] || [];
          const otherMonth = day.getMonth() !== cursor.getMonth();
          const today = isToday(day);
          return (
            <div
              key={day.toISOString()}
              className={cn("min-h-[92px] border-b border-r border-line/70 p-1.5 last:border-r-0 sm:min-h-[112px]", otherMonth && "bg-cream/40 text-mutedText")}
            >
              <div className="mb-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onOpenWeek(day)}
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-colors",
                    today ? "bg-brand-600 text-white" : "text-navy hover:bg-brand-50"
                  )}
                  aria-label={formatLongDate(day)}
                >
                  {day.getDate()}
                </button>
                <span className="hidden font-mono text-[10px] text-mutedText sm:inline">{dayEvents.length || ""}</span>
              </div>

              <div className="hidden space-y-1 sm:block">
                {dayEvents.slice(0, 3).map((event) => (
                  <div key={event.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => navigate(`/work-orders/${event.id}`)}
                      className={cn(eventClasses(event), "w-full")}
                      style={{ borderLeft: `4px solid ${event.priorityColor}` }}
                    >
                      <span className="flex items-center gap-1">
                        {event.priority === "CRITICAL" && <AlertTriangle size={10} className="text-red-600" aria-hidden="true" />}
                        <span className="truncate">
                          {formatTime(event.start)} {event.title}
                        </span>
                      </span>
                    </button>
                    <EventTooltip event={event} />
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <button type="button" onClick={() => onOpenWeek(day)} className="w-full px-1 text-left font-mono text-[10px] text-brand-600 hover:underline">
                    +{dayEvents.length - 3} más
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-1 sm:hidden">
                {dayEvents.slice(0, 6).map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => onOpenWeek(day)}
                    aria-label={`${event.code} ${event.title}`}
                    className={cn("h-2.5 w-2.5 rounded-full", event.priorityDot)}
                    title={`${event.code} - ${event.title}`}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}