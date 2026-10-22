import React from "react";
import { Link } from "react-router-dom";
import { StatusBadge, PriorityBadge } from "@/components/common/Badges";
import { formatDate, formatMinutes } from "@/lib/format";

export default function WorkOrderCards({ workOrders, assetsById }) {
  return (
    <ul className="divide-y divide-line/70 lg:hidden">
      {workOrders.map((wo) => {
        const asset = assetsById[wo.asset_id];
        return (
          <li key={wo.id}>
            <Link to={`/work-orders/${wo.id}`} className="block px-4 py-4 transition-colors hover:bg-cream">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-medium text-brand-600">{wo.code}</span>
                <span className="text-xs text-mutedText">{formatDate(wo.scheduled_at)}</span>
              </div>
              <p className="mt-1.5 font-medium text-navy">{wo.title}</p>
              <p className="mt-0.5 text-xs text-mutedText">{asset ? `${asset.code} - ${asset.name}` : "Sin activo"}</p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <StatusBadge value={wo.status} />
                <PriorityBadge value={wo.priority} />
                <span className="text-xs text-mutedText">{formatMinutes(wo.estimated_minutes)}</span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}