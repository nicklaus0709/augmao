import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FileDown, FileSpreadsheet, ChevronRight, SearchX, Package2, Search } from "lucide-react";
import { fetchAll } from "@/api/data";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import useDebounce from "@/hooks/useDebounce";
import PageHeader from "@/components/common/PageHeader";
import Pagination from "@/components/common/Pagination";
import EmptyState, { LoadingBlock } from "@/components/common/EmptyState";
import { AssetStatusBadge, categoryLabel } from "@/components/common/Badges";
import NewAssetModal from "@/components/assets/NewAssetModal";
import { exportGridList } from "@/lib/gridExport";
import { can } from "@/lib/permissions";
import { ASSET_CATEGORY, ASSET_STATUS, options } from "@/lib/constants";
import { formatDate } from "@/lib/format";

const PAGE_SIZE = 25;
const EMPTY = { code: "", name: "", location: "", category: "all", status: "all" };

export default function Assets() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);

  const codeTerm = useDebounce(filters.code, 350);
  const nameTerm = useDebounce(filters.name, 350);
  const locationTerm = useDebounce(filters.location, 350);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchAll("Asset", {}, { sort: "code" });
      setAssets(result.items || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [codeTerm, nameTerm, locationTerm, filters.category, filters.status]);

  const filtered = useMemo(() => {
    const has = (value, term) => !term.trim() || String(value || "").toLowerCase().includes(term.trim().toLowerCase());
    return assets.filter(
      (asset) =>
        has(asset.code, codeTerm) &&
        has(asset.name, nameTerm) &&
        has(asset.location, locationTerm) &&
        (filters.category === "all" || asset.category === filters.category) &&
        (filters.status === "all" || asset.status === filters.status)
    );
  }, [assets, codeTerm, nameTerm, locationTerm, filters.category, filters.status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasFilters = Boolean(
    filters.code || filters.name || filters.location || filters.category !== "all" || filters.status !== "all"
  );

  const exportColumns = [
    { label: "Código", weight: 1.2 },
    { label: "Nombre", weight: 2.6 },
    { label: "Categoría", weight: 1.4 },
    { label: "Ubicación", weight: 2 },
    { label: "Estado", weight: 1.4 },
    { label: "Fabricante", weight: 1.6 },
    { label: "Modelo", weight: 1.4 },
    { label: "Garantía", weight: 1.3, align: "right" },
  ];

  const exportRows = filtered.map((asset) => [
    asset.code,
    asset.name,
    categoryLabel(asset.category),
    asset.location,
    ASSET_STATUS[asset.status]?.label || "",
    asset.manufacturer || "",
    asset.model || "",
    asset.warranty_expires ? formatDate(asset.warranty_expires) : "",
  ]);

  const filterLabels = [];
  if (codeTerm.trim()) filterLabels.push("Código: " + codeTerm.trim());
  if (nameTerm.trim()) filterLabels.push("Nombre: " + nameTerm.trim());
  if (locationTerm.trim()) filterLabels.push("Ubicación: " + locationTerm.trim());
  if (filters.category !== "all") filterLabels.push("Categoría: " + categoryLabel(filters.category));
  if (filters.status !== "all") filterLabels.push("Estado: " + ASSET_STATUS[filters.status]?.label);

  const handleExport = (format) => {
    try {
      exportGridList({
        format,
        title: "Activos",
        fileBase: "Activos",
        columns: exportColumns,
        rows: exportRows,
        filters: filterLabels,
        userName: user?.full_name || user?.email,
      });
    } catch (e) {
      toast({ title: "No se pudo exportar", variant: "destructive" });
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Equipos"
        title="Activos"
        subtitle={hasFilters ? `${filtered.length} activos con los filtros aplicados` : `${filtered.length} activos · equipos, maquinaria e instalaciones`}
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => handleExport("pdf")} disabled={!filtered.length}>
              <FileDown size={16} aria-hidden="true" /> PDF
            </button>
            <button type="button" className="btn-secondary" onClick={() => handleExport("excel")} disabled={!filtered.length}>
              <FileSpreadsheet size={16} aria-hidden="true" /> Excel
            </button>
            {can.manageAssets(user) && (
              <button type="button" className="btn-primary" onClick={() => setModalOpen(true)}>
                <Plus size={16} aria-hidden="true" /> Nuevo activo
              </button>
            )}
          </>
        }
      />

      <div className="card-surface mb-5 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {[
            { key: "code", label: "Código", placeholder: "PUMP-001" },
            { key: "name", label: "Nombre", placeholder: "Bomba" },
            { key: "location", label: "Ubicación", placeholder: "Sector Norte" },
          ].map((field) => (
            <div key={field.key} className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mutedText" size={15} aria-hidden="true" />
              <input
                className="field-input pl-9"
                placeholder={field.placeholder}
                aria-label={field.label}
                value={filters[field.key]}
                onChange={(e) => setFilters((prev) => ({ ...prev, [field.key]: e.target.value }))}
              />
            </div>
          ))}
          <select
            className="field-input"
            aria-label="Categoría"
            value={filters.category}
            onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
          >
            <option value="all">Todas las categorías</option>
            {Object.entries(ASSET_CATEGORY).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select
            className="field-input"
            aria-label="Estado"
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
          >
            <option value="all">Todos los estados</option>
            {options(ASSET_STATUS).map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          {hasFilters && (
            <button type="button" className="btn-ghost justify-start text-sm font-medium text-brand-600" onClick={() => setFilters(EMPTY)}>
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="card-surface"><LoadingBlock label="Cargando activos..." /></div>
      ) : filtered.length === 0 ? (
        <div className="card-surface">
          <EmptyState
            icon={hasFilters ? SearchX : Package2}
            title={hasFilters ? "Sin resultados" : "Sin activos"}
            description={hasFilters ? "Ningún activo coincide con los filtros." : "Cargá el primer activo de la planta."}
            action={
              hasFilters ? (
                <button type="button" className="btn-secondary" onClick={() => setFilters(EMPTY)}>Limpiar filtros</button>
              ) : can.manageAssets(user) ? (
                <button type="button" className="btn-primary" onClick={() => setModalOpen(true)}>
                  <Plus size={16} aria-hidden="true" /> Nuevo activo
                </button>
              ) : null
            }
          />
        </div>
      ) : (
        <div className="card-surface overflow-hidden">
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-line bg-cream/60">
                  <th className="table-head px-4 py-3 text-left">Código</th>
                  <th className="table-head px-4 py-3 text-left">Nombre</th>
                  <th className="table-head px-4 py-3 text-left">Categoría</th>
                  <th className="table-head px-4 py-3 text-left">Ubicación</th>
                  <th className="table-head px-4 py-3 text-left">Estado</th>
                  <th className="table-head px-4 py-3 text-left">Garantía</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {visible.map((asset) => (
                  <tr
                    key={asset.id}
                    onClick={() => navigate(`/assets/${asset.id}`)}
                    className="cursor-pointer border-b border-line/70 transition-colors hover:bg-cream"
                  >
                    <td className="px-4 py-3 font-mono text-[13px] text-brand-600">{asset.code}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-navy">{asset.name}</p>
                      <p className="text-xs text-mutedText">{[asset.manufacturer, asset.model].filter(Boolean).join(" ") || "-"}</p>
                    </td>
                    <td className="px-4 py-3 text-mutedText">{categoryLabel(asset.category)}</td>
                    <td className="px-4 py-3 text-navy">{asset.location}</td>
                    <td className="px-4 py-3"><AssetStatusBadge value={asset.status} /></td>
                    <td className="px-4 py-3 text-navy">{asset.warranty_expires ? formatDate(asset.warranty_expires) : "-"}</td>
                    <td className="px-4 py-3 text-right text-mutedText"><ChevronRight size={16} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-line/70 lg:hidden">
            {visible.map((asset) => (
              <li key={asset.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/assets/${asset.id}`)}
                  className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-cream"
                >
                  <span className="min-w-0 flex-1">
                    <span className="font-mono text-xs text-brand-600">{asset.code}</span>
                    <span className="mt-1 block truncate font-medium text-navy">{asset.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-mutedText">
                      {categoryLabel(asset.category)} · {asset.location}
                    </span>
                    <span className="mt-2 inline-block"><AssetStatusBadge value={asset.status} /></span>
                  </span>
                  <ChevronRight size={16} className="text-mutedText" />
                </button>
              </li>
            ))}
          </ul>

          <Pagination page={page} totalPages={totalPages} total={filtered.length} onChange={setPage} />
        </div>
      )}

      <NewAssetModal open={modalOpen} onOpenChange={setModalOpen} asset={null} assets={assets} onSaved={load} />
    </div>
  );
}