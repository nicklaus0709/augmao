import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FileDown, FileSpreadsheet, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown, AlertTriangle, Boxes, SearchX, Search } from "lucide-react";
import { fetchAll } from "@/api/data";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import useDebounce from "@/hooks/useDebounce";
import PageHeader from "@/components/common/PageHeader";
import Pagination from "@/components/common/Pagination";
import EmptyState, { LoadingBlock } from "@/components/common/EmptyState";
import { unitLabel } from "@/components/common/Badges";
import NewSparePartModal from "@/components/inventory/NewSparePartModal";
import { exportGridList } from "@/lib/gridExport";
import { can } from "@/lib/permissions";
import { PART_UNIT } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;
const EMPTY = { code: "", name: "", unit: "all", order: "name" };

function isLow(part) {
  return Number(part.stock_current || 0) <= Number(part.stock_minimum || 0);
}

export default function Inventory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [parts, setParts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(EMPTY);
  const [lowOnly, setLowOnly] = useState(false);
  const [stockSort, setStockSort] = useState(null);
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);

  const codeTerm = useDebounce(filters.code, 350);
  const nameTerm = useDebounce(filters.name, 350);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchAll("SparePart", {}, { sort: "code" });
      setParts(result.items || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [codeTerm, nameTerm, filters.unit, filters.order, lowOnly, stockSort]);

  const filtered = useMemo(() => {
    const has = (value, term) => !term.trim() || String(value || "").toLowerCase().includes(term.trim().toLowerCase());
    const list = parts.filter(
      (part) =>
        has(part.code, codeTerm) &&
        has(part.name, nameTerm) &&
        (filters.unit === "all" || part.unit === filters.unit) &&
        (!lowOnly || isLow(part))
    );
    const sorted = [...list];
    if (stockSort) {
      sorted.sort((a, b) => {
        const diff = Number(a.stock_current || 0) - Number(b.stock_current || 0);
        return stockSort === "asc" ? diff : -diff;
      });
    } else if (filters.order === "name") {
      sorted.sort((a, b) => String(a.name).localeCompare(String(b.name), "es"));
    } else if (filters.order === "stock_asc") {
      sorted.sort((a, b) => Number(a.stock_current || 0) - Number(b.stock_current || 0));
    } else {
      sorted.sort((a, b) => Number(b.stock_current || 0) - Number(a.stock_current || 0));
    }
    return sorted;
  }, [parts, codeTerm, nameTerm, filters.unit, filters.order, lowOnly, stockSort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasFilters = Boolean(filters.code || filters.name || filters.unit !== "all" || filters.order !== "name" || lowOnly);

  const toggleStockSort = () => {
    setStockSort((prev) => (prev === null ? "asc" : prev === "asc" ? "desc" : null));
  };

  const exportColumns = [
    { label: "Código", weight: 1.2 },
    { label: "Nombre", weight: 3 },
    { label: "Unidad", weight: 1.2 },
    { label: "Stock actual", weight: 1.2, align: "right" },
    { label: "Stock mínimo", weight: 1.2, align: "right" },
    { label: "Stock bajo", weight: 1.2 },
    { label: "Ubicación", weight: 2 },
    { label: "Proveedor", weight: 2 },
    { label: "Costo unit.", weight: 1.4, align: "right" },
  ];

  const exportRows = filtered.map((part) => [
    part.code,
    part.name,
    unitLabel(part.unit),
    Number(part.stock_current || 0),
    Number(part.stock_minimum || 0),
    isLow(part) ? "Sí" : "No",
    part.location || "",
    part.supplier || "",
    part.unit_cost === null || part.unit_cost === undefined ? "" : Number(part.unit_cost),
  ]);

  const filterLabels = [];
  if (codeTerm.trim()) filterLabels.push("Código: " + codeTerm.trim());
  if (nameTerm.trim()) filterLabels.push("Nombre: " + nameTerm.trim());
  if (filters.unit !== "all") filterLabels.push("Unidad: " + unitLabel(filters.unit));
  if (lowOnly) filterLabels.push("Stock bajo");
  filterLabels.push(
    "Orden: " +
      (stockSort ? `Stock ${stockSort === "asc" ? "menor a mayor" : "mayor a menor"}` : filters.order === "name" ? "por nombre" : filters.order === "stock_asc" ? "stock menor a mayor" : "stock mayor a menor")
  );

  const handleExport = (format) => {
    try {
      exportGridList({
        format,
        title: "Inventario",
        fileBase: "Inventario",
        columns: exportColumns,
        rows: exportRows,
        filters: filterLabels,
        userName: user?.full_name || user?.email,
      });
    } catch (e) {
      toast({ title: "No se pudo exportar", variant: "destructive" });
    }
  };

  const StockIcon = stockSort === "asc" ? ChevronUp : stockSort === "desc" ? ChevronDown : ChevronsUpDown;
  const lowCount = parts.filter(isLow).length;

  return (
    <div>
      <PageHeader
        eyebrow="Almacén"
        title="Inventario de repuestos"
        subtitle={`${filtered.length} repuestos · control de stock y movimientos`}
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => handleExport("pdf")} disabled={!filtered.length}>
              <FileDown size={16} aria-hidden="true" /> PDF
            </button>
            <button type="button" className="btn-secondary" onClick={() => handleExport("excel")} disabled={!filtered.length}>
              <FileSpreadsheet size={16} aria-hidden="true" /> Excel
            </button>
            <button
              type="button"
              className={lowOnly ? "btn-primary" : "btn-secondary"}
              aria-pressed={lowOnly}
              onClick={() => setLowOnly((prev) => !prev)}
            >
              <AlertTriangle size={16} aria-hidden="true" />
              Stock bajo {lowCount ? `(${lowCount})` : ""}
            </button>
            {can.manageSpareParts(user) && (
              <button type="button" className="btn-primary" onClick={() => setModalOpen(true)}>
                <Plus size={16} aria-hidden="true" /> Nuevo repuesto
              </button>
            )}
          </>
        }
      />

      <div className="card-surface mb-5 p-4 sm:p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mutedText" size={15} aria-hidden="true" />
            <input
              className="field-input pl-9"
              placeholder="REP-0001"
              aria-label="Buscar por código"
              value={filters.code}
              onChange={(e) => setFilters((prev) => ({ ...prev, code: e.target.value }))}
            />
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mutedText" size={15} aria-hidden="true" />
            <input
              className="field-input pl-9"
              placeholder="Filtro"
              aria-label="Buscar por nombre"
              value={filters.name}
              onChange={(e) => setFilters((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <select
            className="field-input"
            aria-label="Unidad"
            value={filters.unit}
            onChange={(e) => setFilters((prev) => ({ ...prev, unit: e.target.value }))}
          >
            <option value="all">Todas las unidades</option>
            {Object.entries(PART_UNIT).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select
            className="field-input"
            aria-label="Ordenar por"
            value={filters.order}
            onChange={(e) => {
              setStockSort(null);
              setFilters((prev) => ({ ...prev, order: e.target.value }));
            }}
          >
            <option value="name">Ordenar por nombre</option>
            <option value="stock_asc">Stock: menor a mayor</option>
            <option value="stock_desc">Stock: mayor a menor</option>
          </select>
        </div>
        {hasFilters && (
          <button
            type="button"
            className="mt-3 text-sm font-medium text-brand-600 hover:underline"
            onClick={() => {
              setFilters(EMPTY);
              setLowOnly(false);
            }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {loading ? (
        <div className="card-surface"><LoadingBlock label="Cargando inventario..." /></div>
      ) : filtered.length === 0 ? (
        <div className="card-surface">
          <EmptyState
            icon={hasFilters ? SearchX : Boxes}
            title={hasFilters ? "Sin resultados" : "Sin repuestos"}
            description={hasFilters ? "Ningún repuesto coincide con los filtros." : "Cargá el primer repuesto del almacén."}
            action={
              hasFilters ? (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setFilters(EMPTY);
                    setLowOnly(false);
                  }}
                >
                  Limpiar filtros
                </button>
              ) : can.manageSpareParts(user) ? (
                <button type="button" className="btn-primary" onClick={() => setModalOpen(true)}>
                  <Plus size={16} aria-hidden="true" /> Nuevo repuesto
                </button>
              ) : null
            }
          />
        </div>
      ) : (
        <div className="card-surface overflow-hidden">
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-line bg-cream/60">
                  <th className="table-head px-4 py-3 text-left">Código</th>
                  <th className="table-head px-4 py-3 text-left">Nombre</th>
                  <th className="table-head px-4 py-3 text-left">Unidad</th>
                  <th className="px-4 py-3 text-left">
                    <button type="button" onClick={toggleStockSort} className={`table-head inline-flex items-center gap-1.5 hover:text-navy ${stockSort ? "text-brand-600" : ""}`}>
                      Stock actual
                      <StockIcon size={13} aria-hidden="true" />
                    </button>
                  </th>
                  <th className="table-head px-4 py-3 text-right">Stock mínimo</th>
                  <th className="table-head px-4 py-3 text-left">Ubicación</th>
                  <th className="table-head px-4 py-3 text-right">Costo unitario</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {visible.map((part) => {
                  const low = isLow(part);
                  return (
                    <tr
                      key={part.id}
                      onClick={() => navigate(`/inventory/${part.id}`)}
                      className="cursor-pointer border-b border-line/70 transition-colors hover:bg-cream"
                    >
                      <td className="px-4 py-3 font-mono text-[13px] text-brand-600">{part.code}</td>
                      <td className="px-4 py-3 font-medium text-navy">{part.name}</td>
                      <td className="px-4 py-3 text-mutedText">{unitLabel(part.unit)}</td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center gap-1 font-semibold", low ? "text-red-600" : "text-navy")}>
                          {low && <AlertTriangle size={14} aria-hidden="true" />}
                          {part.stock_current ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-navy">{part.stock_minimum ?? 0}</td>
                      <td className="px-4 py-3 text-mutedText">{part.location || "-"}</td>
                      <td className="px-4 py-3 text-right text-navy">{formatMoney(part.unit_cost)}</td>
                      <td className="px-4 py-3 text-right text-mutedText"><ChevronRight size={16} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-line/70 lg:hidden">
            {visible.map((part) => {
              const low = isLow(part);
              return (
                <li key={part.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/inventory/${part.id}`)}
                    className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-cream"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="font-mono text-xs text-brand-600">{part.code}</span>
                      <span className="mt-1 block truncate font-medium text-navy">{part.name}</span>
                      <span className="mt-0.5 block text-xs text-mutedText">
                        {unitLabel(part.unit)} · {part.location || "sin ubicación"}
                      </span>
                      <span className={cn("mt-1 inline-flex items-center gap-1 text-sm font-semibold", low ? "text-red-600" : "text-navy")}>
                        {low && <AlertTriangle size={14} aria-hidden="true" />}
                        {part.stock_current ?? 0} / mínimo {part.stock_minimum ?? 0}
                      </span>
                    </span>
                    <ChevronRight size={16} className="text-mutedText" />
                  </button>
                </li>
              );
            })}
          </ul>

          <Pagination page={page} totalPages={totalPages} total={filtered.length} onChange={setPage} />
        </div>
      )}

      <NewSparePartModal open={modalOpen} onOpenChange={setModalOpen} part={null} onSaved={load} />
    </div>
  );
}