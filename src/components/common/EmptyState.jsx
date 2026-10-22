import React from "react";
import { SearchX, Loader2 } from "lucide-react";

export function Spinner({ className = "" }) {
  return <Loader2 className={`animate-spin text-brand-600 ${className}`} aria-hidden="true" />;
}

export function LoadingBlock({ label = "Cargando..." }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-mutedText">
      <Spinner className="h-5 w-5" />
      {label}
    </div>
  );
}

export default function EmptyState({ icon: Icon = SearchX, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <Icon className="mb-4 text-slate-300" size={34} aria-hidden="true" />
      <h3 className="font-heading text-lg font-bold text-navy">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-sm text-mutedText">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}