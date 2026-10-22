import React from "react";
import { Search, Filter } from "lucide-react";
import { WO_STATUS, WO_PRIORITY, WO_TYPE, options } from "@/lib/constants";

const ALL = "all";

export default function WorkOrderFilters({ filters, onChange, assets, onClear, hasFilters }) {
  const set = (key) => (event) => onChange({ ...filters, [key]: event.target.value });

  return (
    <div className="card-surface mb-5 p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2 text-mutedText">
        <Filter size={15} aria-hidden="true" />
        <span className="stat-title">Filtros</span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mutedText" size={15} aria-hidden="true" />
          <input
            type="search"
            className="field-input pl-9"
            placeholder="Buscar por código o título"
            aria-label="Buscar por código o título"
            value={filters.search}
            onChange={set("search")}
          />
        </div>

        <select className="field-input" aria-label="Activo" value={filters.assetId} onChange={set("assetId")}>
          <option value={ALL}>Todos los activos</option>
          {assets.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.code} - {asset.name}
            </option>
          ))}
        </select>

        <select className="field-input" aria-label="Tipo" value={filters.type} onChange={set("type")}>
          <option value={ALL}>Todos los tipos</option>
          {options(WO_TYPE).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select className="field-input" aria-label="Estado" value={filters.status} onChange={set("status")}>
          <option value={ALL}>Todos los estados</option>
          {options(WO_STATUS).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select className="field-input" aria-label="Prioridad" value={filters.priority} onChange={set("priority")}>
          <option value={ALL}>Todas las prioridades</option>
          {options(WO_PRIORITY).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {hasFilters && (
        <button type="button" onClick={onClear} className="mt-3 text-sm font-medium text-brand-600 hover:underline">
          Limpiar
        </button>
      )}
    </div>
  );
}