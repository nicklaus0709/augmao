import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, CalendarDays, Columns3, List } from "lucide-react";
import { fetchAll } from "@/api/data";
import PageHeader from "@/components/common/PageHeader";
import { LoadingBlock } from "@/components/common/EmptyState";
import CalendarLegend from "@/components/calendar/CalendarLegend";
import MonthView from "@/components/calendar/MonthView";
import WeekView from "@/components/calendar/WeekView";
import AgendaView from "@/components/calendar/AgendaView";
import { WO_PRIORITY, WO_STATUS, WO_TYPE } from "@/lib/constants";
import {
  addDays, addMonths, startOfDay, startOfWeek, startOfMonth, formatTime,
  formatLongDate, formatMonthYear, formatMinutes,
} from "@/lib/format";

const PRIORITY_COLORS = {
  LOW: "#9ca3af",
  MEDIUM: "#fbbf24",
  HIGH: "#f97316",
  CRITICAL: "#dc2626",
};

function buildEvent(workOrder, asset) {
  const start = new Date(workOrder.scheduled_at);
  const minutes = Math.max(30, Number(workOrder.estimated_minutes) || 60);
  const dayEnd = new Date(startOfDay(start).getTime() + 24 * 60 * 60000);
  const end = new Date(Math.min(start.getTime() + minutes * 60000, dayEnd.getTime()));
  return {
    id: workOrder.id,
    code: workOrder.code,
    title: workOrder.title,
    start,
    end,
    startMinutes: start.getHours() * 60 + start.getMinutes(),
    endMinutes: Math.min(1440, start.getHours() * 60 + start.getMinutes() + Math.max(30, minutes)),
    type: workOrder.type,
    priority: workOrder.priority,
    status: workOrder.status,
    statusLabel: WO_STATUS[workOrder.status]?.label || "-",
    typeEventClass: WO_TYPE[workOrder.type]?.event || "bg-slate-100 text-slate-900",
    priorityColor: PRIORITY_COLORS[workOrder.priority] || "#9ca3af",
    priorityDot: WO_PRIORITY[workOrder.priority]?.dot || "bg-gray-400",
    technician: workOrder.assigned_to_name || "Sin asignar",
    assetLabel: asset ? `${asset.code} - ${asset.name}` : "Sin activo",
    durationText: formatMinutes(minutes),
    fullDate: `${formatLongDate(start)}, ${formatTime(start)}`,
  };
}

export default function WorkOrderCalendar() {
  const [view, setView] = useState(() => (window.innerWidth < 768 ? "agenda" : "month"));
  const [cursor, setCursor] = useState(() => new Date());
  const [workOrders, setWorkOrders] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hiddenTypes, setHiddenTypes] = useState([]);
  const [hiddenPriorities, setHiddenPriorities] = useState([]);
  const [hideClosed, setHideClosed] = useState(false);

  const load = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    try {
      const [woResult, assetResult] = await Promise.all([
        fetchAll("WorkOrder", {}, { sort: "scheduled_at" }),
        fetchAll("Asset", {}, { sort: "code" }),
      ]);
      setWorkOrders((woResult.items || []).filter((wo) => wo.scheduled_at));
      setAssets(assetResult.items || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const assetsById = useMemo(() => Object.fromEntries(assets.map((a) => [a.id, a])), [assets]);

  const range = useMemo(() => {
    if (view === "month") {
      const start = startOfWeek(startOfMonth(cursor));
      return { start, end: addDays(start, 42) };
    }
    if (view === "week") {
      const start = startOfWeek(cursor);
      return { start, end: addDays(start, 7) };
    }
    const start = startOfDay(cursor);
    return { start, end: addDays(start, 30) };
  }, [view, cursor]);

  const events = useMemo(() => {
    return workOrders
      .map((wo) => buildEvent(wo, assetsById[wo.asset_id]))
      .filter((event) => event.start >= range.start && event.start < range.end)
      .filter((event) => !hiddenTypes.includes(event.type))
      .filter((event) => !hiddenPriorities.includes(event.priority))
      .filter((event) => !(hideClosed && (event.status === "COMPLETED" || event.status === "CANCELLED")))
      .sort((a, b) => a.start - b.start);
  }, [workOrders, assetsById, range, hiddenTypes, hiddenPriorities, hideClosed]);

  const move = (direction) => {
    if (view === "month") setCursor((prev) => addMonths(prev, direction));
    else if (view === "week") setCursor((prev) => addDays(prev, direction * 7));
    else setCursor((prev) => addDays(prev, direction * 30));
  };

  const periodLabel = useMemo(() => {
    if (view === "month") {
      const label = formatMonthYear(cursor);
      return label.charAt(0).toUpperCase() + label.slice(1);
    }
    if (view === "week") {
      const start = startOfWeek(cursor);
      const end = addDays(start, 6);
      return `${start.getDate()} – ${end.getDate()} de ${formatMonthYear(end)}`;
    }
    const label = formatMonthYear(range.start);
    return label.charAt(0).toUpperCase() + label.slice(1);
  }, [view, cursor, range]);

  const toggle = (list, setList, value) => {
    setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  };

  const views = [
    { key: "month", label: "Mes", icon: CalendarDays },
    { key: "week", label: "Semana", icon: Columns3 },
    { key: "agenda", label: "Agenda", icon: List },
  ];

  return (
    <div>
      <Link to="/work-orders" className="btn-ghost mb-4 -ml-3">
        <ArrowLeft size={16} aria-hidden="true" />
        Volver a la lista
      </Link>

      <PageHeader
        eyebrow="Mantenimiento"
        title="Calendario de órdenes de trabajo"
        subtitle={`${events.length} órdenes programadas en el período${refreshing ? " · actualizando…" : ""}`}
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button type="button" className="btn-secondary px-3" onClick={() => move(-1)} aria-label="Período anterior">
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[190px] text-center font-heading text-sm font-bold text-navy">{periodLabel}</span>
          <button type="button" className="btn-secondary px-3" onClick={() => move(1)} aria-label="Período siguiente">
            <ChevronRight size={16} />
          </button>
          <button type="button" className="btn-secondary" onClick={() => setCursor(new Date())}>Hoy</button>
        </div>

        <div className="inline-flex rounded-full border border-line bg-white p-1">
          {views.map((option) => {
            const Icon = option.icon;
            const active = view === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setView(option.key)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  active ? "bg-brand-600 text-white" : "text-navy hover:bg-brand-50"
                }`}
              >
                <Icon size={15} aria-hidden="true" />
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <CalendarLegend
        hiddenTypes={hiddenTypes}
        hiddenPriorities={hiddenPriorities}
        onToggleType={(value) => toggle(hiddenTypes, setHiddenTypes, value)}
        onTogglePriority={(value) => toggle(hiddenPriorities, setHiddenPriorities, value)}
        hideClosed={hideClosed}
        onToggleClosed={setHideClosed}
      />

      {loading ? (
        <div className="card-surface">
          <LoadingBlock label="Cargando calendario..." />
        </div>
      ) : view === "month" ? (
        <MonthView
          cursor={cursor}
          events={events}
          onOpenWeek={(day) => {
            setCursor(day);
            setView("week");
          }}
        />
      ) : view === "week" ? (
        <WeekView cursor={cursor} events={events} onOpenDay={(day) => setCursor(day)} />
      ) : (
        <AgendaView events={events} />
      )}
    </div>
  );
}