import React from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell,
} from "recharts";
import { WO_TYPE, WO_STATUS } from "@/lib/constants";

const TOOLTIP_STYLE = { borderRadius: 12, border: "1px solid #DBDFE6", fontSize: 12, color: "#1E2631" };

export function TypeBarChart({ counts, height = 240 }) {
  const data = Object.entries(WO_TYPE).map(([key, cfg]) => ({ name: cfg.label, value: counts[key] || 0 }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid vertical={false} stroke="#DBDFE6" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#607085" }} axisLine={false} tickLine={false} interval={0} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#607085" }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(67,119,239,0.06)" }} />
        <Bar dataKey="value" name="OTs" fill="#4377EF" radius={[6, 6, 0, 0]} maxBarSize={56} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StatusDonut({ counts, height = 220 }) {
  const data = Object.entries(WO_STATUS)
    .map(([key, cfg]) => ({ key, name: cfg.label, value: counts[key] || 0, color: cfg.chart }))
    .filter((item) => item.value > 0);

  if (!data.length) {
    return <p className="py-14 text-center text-sm text-mutedText">Sin datos</p>;
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="84%" paddingAngle={2} stroke="none">
            {data.map((item) => (
              <Cell key={item.key} fill={item.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} />
        </PieChart>
      </ResponsiveContainer>
      <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1">
        {data.map((item) => (
          <li key={item.key} className="inline-flex items-center gap-1.5 text-xs text-mutedText">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} aria-hidden="true" />
            {item.name} ({item.value})
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ChartCard({ title, children, className = "" }) {
  return (
    <section className={`card-surface p-5 ${className}`}>
      <h2 className="mb-4 font-heading text-base font-bold text-navy">{title}</h2>
      {children}
    </section>
  );
}