import React from "react";
import { StatIconBox } from "@/components/common/Badges";
import { cn } from "@/lib/utils";

const RINGS = {
  brand: "ring-2 ring-blue-400",
  emerald: "ring-2 ring-emerald-400",
  amber: "ring-2 ring-amber-400",
  red: "ring-2 ring-red-400",
  violet: "ring-2 ring-violet-400",
};

export default function StatCard({
  title,
  value,
  subtitle,
  icon,
  tone = "brand",
  onClick,
  selected = false,
  className = "",
}) {
  const clickable = Boolean(onClick);
  const Wrapper = clickable ? "button" : "div";
  return (
    <Wrapper
      type={clickable ? "button" : undefined}
      onClick={onClick}
      aria-pressed={clickable ? selected : undefined}
      className={cn(
        "card-surface w-full p-5 text-left transition-all duration-200",
        clickable && "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg",
        clickable && selected && RINGS[tone],
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="stat-title">{title}</span>
        {icon ? <StatIconBox icon={icon} tone={tone} /> : null}
      </div>
      <p className="mt-4 font-heading text-3xl font-bold leading-none text-navy">{value}</p>
      {subtitle && <p className="mt-2 text-xs text-mutedText">{subtitle}</p>}
    </Wrapper>
  );
}