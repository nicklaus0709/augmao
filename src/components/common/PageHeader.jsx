import React from "react";

export default function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <span className="eyebrow mb-2">{eyebrow}</span>}
        <h1 className="font-heading text-2xl font-bold text-navy sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-mutedText">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}