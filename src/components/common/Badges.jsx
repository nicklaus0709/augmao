import React from "react";
import { ClipboardList, CheckCircle, Clock, TrendingUp } from "lucide-react";
import { WO_STATUS, WO_PRIORITY, WO_TYPE, ASSET_CATEGORY, ASSET_STATUS, ROLES, PART_UNIT } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function StatusBadge({ value, className }) {
  const cfg = WO_STATUS[value];
  if (!cfg) return null;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", cfg.badge, className)}>
      {cfg.label}
    </span>
  );
}

export function PriorityBadge({ value, className }) {
  const cfg = WO_PRIORITY[value];
  if (!cfg) return null;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", cfg.badge, className)}>
      {cfg.label}
    </span>
  );
}

export function TypeBadge({ value, className }) {
  const cfg = WO_TYPE[value];
  if (!cfg) return null;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", cfg.chip, className)}>
      {cfg.label}
    </span>
  );
}

export function AssetStatusBadge({ value, className }) {
  const cfg = ASSET_STATUS[value];
  if (!cfg) return null;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", cfg.badge, className)}>
      {cfg.label}
    </span>
  );
}

export function RoleBadge({ value, className }) {
  const cfg = ROLES[value];
  if (!cfg) return null;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", cfg.badge, className)}>
      {cfg.label}
    </span>
  );
}

export function ActiveBadge({ active, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        active ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600",
        className
      )}
    >
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

export function categoryLabel(value) {
  return ASSET_CATEGORY[value] || "-";
}

export function unitLabel(value) {
  return PART_UNIT[value] || PART_UNIT.unit;
}

export const STAT_ICONS = { ClipboardList, CheckCircle, Clock, TrendingUp };

export function StatIconBox({ icon: Icon, tone }) {
  const tones = {
    brand: "bg-blue-50 border-blue-100 text-blue-600",
    emerald: "bg-emerald-50 border-emerald-100 text-emerald-600",
    amber: "bg-amber-50 border-amber-100 text-amber-600",
    red: "bg-red-50 border-red-100 text-red-600",
    violet: "bg-violet-50 border-violet-100 text-violet-600",
  };
  return (
    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", tones[tone] || tones.brand)}>
      <Icon size={18} aria-hidden="true" />
    </span>
  );
}