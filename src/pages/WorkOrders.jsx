import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FileDown, FileSpreadsheet, CalendarDays, ClipboardList, SearchX } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { fetchAll } from "@/api/data";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import useDebounce from "@/hooks/useDebounce";
import useReferenceData from "@/hooks/useReferenceData";
import PageHeader from "@/components/common/PageHeader";
import Pagination from "@/components/common/Pagination";
import EmptyState, { LoadingBlock } from "@/components/common/EmptyState";
import WorkOrderFilters from "@/components/workorders/WorkOrderFilters";
import WorkOrderTable from "@/components/workorders/WorkOrderTable";
import WorkOrderCards from "@/components/workorders/WorkOrderCards";
import NewWorkOrderModal from "@/components/workorders/NewWorkOrderModal";
import { exportGridList } from "@/lib/gridExport";
import { can } from "@/lib/permissions";
import { WO_PRIORITY, WO_STATUS, WO_TYPE } from "@/lib/constants";
import { formatDate, formatMinutes } from "@/lib/format";

const PAGE_SIZE = 15;
const EMPTY_FILTERS = { search: "", assetId: "all", type: "all", status: "all", priority: "all" };

const MOBILE_SORTS = [
  { value: "default", label: "Orden predeterminado" },
  { value: "scheduled_asc", label: "Programada (más próxima)" },
  { value: "scheduled_desc", label: "Programada (más lejana)" },
  { value: "time_asc", label: "Tiempo (menor a mayor)" },
  { value: "time_desc", label: "Tiempo (mayor a mayor)" },
];

function sortList(list, sort) {
  const sorted = [...list];
  if (sort.key && sort.dir) {
    sorted.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av === null || av === undefined || av === "") return 1;
      if (bv === null || bv === undefined || bv === "") return -1;
      const at = sort.key === "scheduled_at" ? new Date(av).getTime() : Number(av);
      const bt = sort.key === "scheduled_at" ? new Date(bv).getTime() : Number(bv);
      return sort.dir === "asc" ? at - bt : bt - at;
    });
    return sorted;
  }
  sorted.sort((a, b) => {
    const pa = WO_PRIORITY[a.priority]?.rank || 0;
    const pb = WO_PRIORITY[b.priority]?.rank || 0;
    if (pa !== pb) return pb - pa;
    return new Date(b.created_date || 0) - new Date(a.created_date || 0);
  });
  return sorted;
}

export default function WorkOrders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { assets, users, loading: loadingRefs } = useReferenceData();

  const [workOrders, setWorkOrders] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [mobileSort, setMobileSort] = useState("default");
  const [sort, setSort] = useState({ key: null, dir: null });
  const [page, setPage] = useState(1);
  const [newOpen, setNewOpen] = useState(false);

  const search = useDebounce(filters.search, 350);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pageResult, total] = await Promise.all([
        fetchAll("WorkOrder", {}, { sort: "-created_date" }),
        base44.entities.WorkOrder.count({}),
      ]);
      setWorkOrders(pageResult.items || []);
      setTotalCount(total);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, filters.assetId, filters.type, filters.status, filters.priority, sort, mobileSort]);

  const assetsById = useMemo(() => Object.fromEntries(assets.map((a) => [a.id, a])), [assets]);

  const effectiveSort = useMemo(() => {
    if (sort.key) return sort;
    if (mobileSort === "default") return { key: null, dir: null };
    const [key, dir] = mobileSort.split("_");
    return { key: key === "scheduled" ? "scheduled_at" : "estimated_minutes", dir };
  }, [sort, mobileSort]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return workOrders.filter((wo) => {
      if (term && !`${wo.code || ""} ${wo.title || ""}`.toLowerCase().includes(term)) return false;
      if (filters.assetId !== "all" && wo.asset_id !== filters.assetId) return false;
      if (filters.type !== "all" && wo.type !== filters.type) return false;
      if (filters.status !== "all" && wo.status !== filters.status) return false;
      if (filters.priority !== "all" && wo.priority !== filters.priority) return false;
      return true;
    });
  }, [workOrders, search, filters]);

  const sorted = useMemo(() => sortList(filtered, effectiveSort), [filtered, effectiveSort]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const visible = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasFilters = Boolean(
    filters.search || filters.assetId !== "all" || filters.type !== "all" || filters.status !== "all" || filters.priority !== "all"
  );

  const toggleSort = (key) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return { key: null, dir: null };
    });
    setMobileSort("default");
  };

  const filterLabels = [];
  if (filters.assetId !== "all") filterLabels.push("Activo: " + (assetsById[filters.assetId]?.code || "-"));
  if (filters.type !== "all") filterLabels.push("Tipo: " + (WO_TYPE[filters.type]?.label || "-"));
  if (filters.status !== "all") filterLabels.push("Estado: " + (WO_STATUS[filters.status]?.label || "-"));
  if (filters.priority !== "all") filterLabels.push("Prioridad: " + (WO_PRIORITY[filters.priority]?.label || "-"));
  if (search.trim()) filterLabels.push("Búsqueda: " + search.trim());
  if (effectiveSort.key) {
    filterLabels.push(
      "Orden: " + (effectiveSort.key === "scheduled_at" ? "Programada" : "Tiempo") + (effectiveSort.dir === "asc" ? " ascendente" : " descendente")
    );
  }

  const exportColumns = [
    { label: "Código", weight: 1.4 },
    { label: "Título", weight: 3 },
    { label: "Activo", weight: 2.2 },
    { label: "Técnico", weight: 1.8 },
    { label: "Tipo", weight: 1.2 },
    { label: "Estado", weight: 1.2 },
    { label: "Prioridad", weight: 1.2 },
    { label: "Programada", weight: 1.3 },
    { label: "Tiempo est.", weight: 1.2, align: "right" },
  ];

  const exportRows = sorted.map((wo) => [
    wo.code,
    wo.title,
    assetsById[wo.asset_id] ? `${assetsById[wo.asset_id].code} - ${assetsById[wo.asset_id].name}` : "",
    wo.assigned_to_name || "",
    WO_TYPE[wo.type]?.label || "",
    WO_STATUS[wo.status]?.label || "",
    WO_PRIORITY[wo.priority]?.label || "",
    wo.scheduled_at ? formatDate(wo.scheduled_at) : "",
    formatMinutes(wo.estimated_minutes) === "-" ? "" : formatMinutes(wo.estimated_minutes),
  ]);

  const handleExport = (format) => {
    try {
      exportGridList({
        format,
        title: "Órdenes de trabajo",
        fileBase: "Ordenes-de-trabajo",
        columns: exportColumns,
        rows: exportRows,
        filters: filterLabels,
        userName: user?.full_name || user?.email,
      });
    } catch (e) {
      toast({ title: "No se pudo exportar", variant: "destructive" });
    }
  };

  const subtitle = hasFilters
    ? `${filtered.length} ordenes con los filtros aplicados`
    : `${totalCount} ordenes en total`;

  return (
    <div>
      <PageHeader
        eyebrow="Mantenimiento"
        title="Ordenes de trabajo"
        subtitle={subtitle}
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => navigate("/work-orders/calendar")}>
              <CalendarDays size={16} aria-hidden="true" />
              <span className="hidden sm:inline">Ver en calendario</span>
            </button>
            <button type="button" className="btn-secondary" onClick={() => handleExport("pdf")} disabled={!sorted.length}>
              <FileDown size={16} aria-hidden="true" />
              PDF
            </button>
            <button type="button" className="btn-secondary" onClick={() => handleExport("excel")} disabled={!sorted.length}>
              <FileSpreadsheet size={16} aria-hidden="true" />
              Excel
            </button>
            {can.createWorkOrder(user) && (
              <button type="button" className="btn-primary" onClick={() => setNewOpen(true)}>
                <Plus size={16} aria-hidden="true" />
                Nueva OT
              </button>
            )}
          </>
        }
      />

      <WorkOrderFilters
        filters={filters}
        onChange={setFilters}
        assets={assets}
        hasFilters={hasFilters}
        onClear={() => setFilters(EMPTY_FILTERS)}
      />

      {loading || loadingRefs ? (
        <div className="card-surface">
          <LoadingBlock label="Cargando órdenes de trabajo..." />
        </div>
      ) : sorted.length === 0 ? (
        <div className="card-surface">
          {hasFilters ? (
            <EmptyState
              icon={SearchX}
              title="Sin resultados"
              description="Ninguna orden coincide con los filtros."
              action={
                <button type="button" className="btn-secondary" onClick={() => setFilters(EMPTY_FILTERS)}>
                  Limpiar filtros
                </button>
              }
            />
          ) : (
            <EmptyState
              icon={ClipboardList}
              title="Sin ordenes de trabajo"
              description="Crea la primera OT para empezar a registrar el mantenimiento."
              action={
                can.createWorkOrder(user) ? (
                  <button type="button" className="btn-primary" onClick={() => setNewOpen(true)}>
                    <Plus size={16} aria-hidden="true" />
                    Nueva OT
                  </button>
                ) : null
              }
            />
          )}
        </div>
      ) : (
        <>
          <div className="mb-3 lg:hidden">
            <label className="field-label" htmlFor="mobile-sort">Ordenar por</label>
            <select id="mobile-sort" className="field-input" value={mobileSort} onChange={(e) => setMobileSort(e.target.value)}>
              {MOBILE_SORTS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="card-surface overflow-hidden">
            <WorkOrderTable workOrders={visible} assetsById={assetsById} sort={sort} onSort={toggleSort} />
            <WorkOrderCards workOrders={visible} assetsById={assetsById} />
            <Pagination page={page} totalPages={totalPages} total={sorted.length} onChange={setPage} />
          </div>
        </>
      )}

      <NewWorkOrderModal
        open={newOpen}
        onOpenChange={setNewOpen}
        assets={assets}
        users={users}
        onCreated={(workOrder) => {
          toast({ title: "Orden de trabajo creada", description: workOrder?.code });
          if (workOrder?.id) navigate(`/work-orders/${workOrder.id}`);
          else load();
        }}
      />
    </div>
  );
}