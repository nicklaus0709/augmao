import React from "react";
import { Link } from "react-router-dom";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { StatusBadge, PriorityBadge } from "@/components/common/Badges";
import { WO_TYPE } from "@/lib/constants";
import { formatDate, formatMinutes } from "@/lib/format";

function SortHeader({ label, active, dir, onToggle }) {
  const Icon = dir === "asc" ? ArrowUp : dir === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <th className="px-4 py-3 text-left">
      <button
        type="button"
        onClick={onToggle}
        className={`table-head inline-flex items-center gap-1.5 hover:text-navy ${active ? "text-brand-600" : ""}`}
      >
        {label}
        <Icon size={13} aria-hidden="true" />
      </button>
    </th>
  );
}

export default function WorkOrderTable({ workOrders, assetsById, sort, onSort }) {
  return (
    <div className="hidden overflow-x-auto lg:block">
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line bg-cream/60">
            <th className="table-head px-4 py-3 text-left">Código</th>
            <th className="table-head px-4 py-3 text-left">Título</th>
            <th className="table-head px-4 py-3 text-left">Activo</th>
            <th className="table-head px-4 py-3 text-left">Tipo</th>
            <th className="table-head px-4 py-3 text-left">Estado · Prioridad</th>
            <SortHeader
              label="Programada"
              active={sort.key === "scheduled_at"}
              dir={sort.key === "scheduled_at" ? sort.dir : null}
              onToggle={() => onSort("scheduled_at")}
            />
            <SortHeader
              label="Tiempo"
              active={sort.key === "estimated_minutes"}
              dir={sort.key === "estimated_minutes" ? sort.dir : null}
              onToggle={() => onSort("estimated_minutes")}
            />
          </tr>
        </thead>
        <tbody>
          {workOrders.map((wo) => {
            const asset = assetsById[wo.asset_id];
            return (
              <tr key={wo.id} className="border-b border-line/70 transition-colors hover:bg-cream">
                <td className="px-4 py-3">
                  <Link to={`/work-orders/${wo.id}`} className="font-mono text-[13px] font-medium text-brand-600 hover:underline">
                    {wo.code}
                  </Link>
                </td>
                <td className="max-w-[280px] px-4 py-3">
                  <p className="truncate font-medium text-navy">{wo.title}</p>
                  <p className="truncate text-xs text-mutedText">{wo.assigned_to_name || "Sin asignar"}</p>
                </td>
                <td className="px-4 py-3 text-navy">{asset ? `${asset.code} - ${asset.name}` : "-"}</td>
                <td className="px-4 py-3 text-mutedText">{WO_TYPE[wo.type]?.label || "-"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge value={wo.status} />
                    <PriorityBadge value={wo.priority} />
                  </div>
                </td>
                <td className="px-4 py-3 text-navy">{wo.scheduled_at ? formatDate(wo.scheduled_at) : "-"}</td>
                <td className="px-4 py-3 text-navy">{formatMinutes(wo.estimated_minutes)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}