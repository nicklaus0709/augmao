import React from "react";
import { Link } from "react-router-dom";
import { Wrench } from "lucide-react";

const SIZES = {
  sm: { box: "w-7 h-7", icon: 15, title: "text-base", sub: "text-[8px]", gap: "gap-2" },
  md: { box: "w-9 h-9", icon: 18, title: "text-lg", sub: "text-[10px]", gap: "gap-2.5" },
  lg: { box: "w-11 h-11", icon: 22, title: "text-2xl", sub: "text-[10px]", gap: "gap-3" },
};

// Logo de AuGmao. Un clic siempre vuelve al inicio (Dashboard si hay sesión, login si no).
export default function Logo({ size = "md", variant = "accent", subtitle = true, className = "" }) {
  const s = SIZES[size] || SIZES.md;
  const boxClass = variant === "navy" ? "bg-navy" : "bg-brand-600 shadow-[0_8px_20px_-8px_rgba(67,119,239,0.7)]";
  const iconClass = variant === "navy" ? "text-cream" : "text-white";
  const titleClass = variant === "navy" ? "text-navy" : "text-cream";

  return (
    <Link to="/" className={`flex items-center ${s.gap} group ${className}`} aria-label="AuGmao · ir al inicio">
      <span className={`flex shrink-0 items-center justify-center rounded-xl ${s.box} ${boxClass} transition-transform duration-200 group-hover:scale-105`}>
        <Wrench size={s.icon} strokeWidth={2.2} className={iconClass} aria-hidden="true" />
      </span>
      <span className="flex flex-col leading-none">
        <span className={`font-heading font-bold tracking-tight ${s.title} ${titleClass}`}>AuGmao</span>
        {subtitle && (
          <span className={`mt-1 font-mono uppercase tracking-[0.2em] ${s.sub} ${variant === "navy" ? "text-mutedText" : "text-cream/55"}`}>
            Mantenimiento
          </span>
        )}
      </span>
    </Link>
  );
}