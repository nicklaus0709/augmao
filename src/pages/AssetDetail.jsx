import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, FileDown, QrCode, History, Pencil, SearchX, ClipboardList } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import PageHeader from "@/components/common/PageHeader";
import { LoadingBlock } from "@/components/common/EmptyState";
import { AssetStatusBadge, StatusBadge, TypeBadge, categoryLabel } from "@/components/common/Badges";
import AttachmentPanel from "@/components/common/AttachmentPanel";
import NewAssetModal from "@/components/assets/NewAssetModal";
import { exportAssetPdf, exportQrLabelPdf } from "@/lib/exports/pdf";
import { can } from "@/lib/permissions";
import { frequencyText } from "@/lib/constants";
import { formatDate, formatDateTime, formatMinutes } from "@/lib/format";

function InfoRow({ label, value }) {
  return (
    <div className="border-b border-line/70 pb-2">
      <p className="text-[11px] uppercase tracking-wide text-mutedText">{label}</p>
      <p className="text-sm font-medium text-navy">{value || "-"}</p>
    </div>
  );
}

export default function AssetDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [asset, setAsset] = useState(null);
  const [assets, setAssets] = useState([]);
  const [parent, setParent] = useState(null);
  const [children, setChildren] = useState([]);
  const [plans, setPlans] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const record = await base44.entities.Asset.get(id).catch(() => null);
      if (!record) {
        setMissing(true);
        return;
      }
      setAsset(record);

      const [allAssets, plansResult, ordersResult] = await Promise.all([
        base44.entities.Asset.filter({}, { sort: "code", limit: 500 }),
        base44.entities.MaintenancePlan.filter({}, { limit: 200 }),
        base44.entities.WorkOrder.filter({ asset_id: record.id }, { sort: "-created_date", limit: 200 }),
      ]);

      const list = allAssets.items || [];
      setAssets(list);
      setChildren(list.filter((item) => item.parent_id === record.id));
      setParent(record.parent_id ? list.find((item) => item.id === record.parent_id) || null : null);
      setPlans((plansResult.items || []).filter((plan) => plan.asset_id === record.id));
      setWorkOrders(ordersResult.items || []);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const stats = (() => {
    const completed = workOrders.filter((wo) => wo.status === "COMPLETED");
    const minutes = completed.reduce((sum, wo) => sum + Number(wo.actual_minutes || 0), 0);
    return {
      total: workOrders.length,
      completed: completed.length,
      mttr: completed.length ? minutes / completed.length : 0,
    };
  })();

  const downloadPdf = () => {
    exportAssetPdf({
      asset,
      parent,
      plans: plans.filter((plan) => plan.active),
      workOrders,
      stats,
      userName: user?.full_name || user?.email,
      filename: `Activo-${asset.code}.pdf`,
    });
  };

  const downloadQr = async () => {
    try {
      await exportQrLabelPdf({
        asset,
        url: `${window.location.origin}/scan/asset/${asset.id}`,
        filename: `QR-${asset.code}.pdf`,
      });
    } catch (e) {
      toast({ title: "No se pudo generar el QR", variant: "destructive" });
    }
  };

  if (missing) {
    return (
      <div className="card-surface">
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <SearchX className="mb-4 text-slate-300" size={34} aria-hidden="true" />
          <h1 className="font-heading text-xl font-bold text-navy">Activo no encontrado</h1>
          <Link to="/assets" className="btn-secondary mt-6">
            <ArrowLeft size={16} aria-hidden="true" /> Volver a activos
          </Link>
        </div>
      </div>
    );
  }

  if (loading || !asset) {
    return <div className="card-surface"><LoadingBlock label="Cargando activo..." /></div>;
  }

  const attributes = Object.entries(asset.attributes || {});

  return (
    <div>
      <Link to="/assets" className="btn-ghost mb-4 -ml-3">
        <ArrowLeft size={16} aria-hidden="true" /> Volver a activos
      </Link>

      <PageHeader
        eyebrow="Activo"
        title={asset.name}
        subtitle={`${categoryLabel(asset.category)} · ${asset.location}`}
        actions={
          <>
            <Link to={`/scan/asset/${asset.id}`} className="btn-secondary">
              <History size={16} aria-hidden="true" /> Historial en vivo
            </Link>
            <button type="button" className="btn-secondary" onClick={downloadPdf}>
              <FileDown size={16} aria-hidden="true" /> PDF
            </button>
            <button type="button" className="btn-secondary" onClick={downloadQr}>
              <QrCode size={16} aria-hidden="true" /> Generar QR
            </button>
            {can.manageAssets(user) && (
              <button type="button" className="btn-primary" onClick={() => setEditing(true)}>
                <Pencil size={16} aria-hidden="true" /> Editar
              </button>
            )}
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm text-brand-600">{asset.code}</span>
        <AssetStatusBadge value={asset.status} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <section className="card-surface p-5">
            <h2 className="mb-4 font-heading text-base font-bold text-navy">Información técnica</h2>
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <InfoRow label="Código" value={asset.code} />
              <InfoRow label="Categoría" value={categoryLabel(asset.category)} />
              <InfoRow label="Fabricante" value={asset.manufacturer} />
              <InfoRow label="Modelo" value={asset.model} />
              <InfoRow label="Número de serie" value={asset.serial_number} />
              <InfoRow label="Vencimiento de garantía" value={asset.warranty_expires ? formatDate(asset.warranty_expires) : null} />
              <InfoRow label="Activo padre" value={parent ? `${parent.code} - ${parent.name}` : null} />
              {attributes.map(([key, value]) => (
                <InfoRow key={key} label={key} value={String(value)} />
              ))}
            </div>
          </section>

          <section className="card-surface p-5">
            <h2 className="mb-3 font-heading text-base font-bold text-navy">Planes de mantenimiento</h2>
            {plans.length === 0 ? (
              <p className="text-sm text-mutedText">Sin planes de mantenimiento.</p>
            ) : (
              <ul className="space-y-3">
                {plans.map((plan) => (
                  <li key={plan.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-line/70 pb-2 last:border-0 last:pb-0">
                    <span className="text-sm text-navy">{plan.name}</span>
                    <span className="text-xs text-mutedText">
                      {frequencyText(plan.frequency_type, plan.frequency_value)} · Próxima: {formatDate(plan.next_run_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card-surface p-5">
            <h2 className="mb-4 font-heading text-base font-bold text-navy">Últimas órdenes de trabajo</h2>
            {workOrders.length === 0 ? (
              <p className="text-sm text-mutedText">Sin órdenes de trabajo registradas.</p>
            ) : (
              <ul className="divide-y divide-line/70">
                {workOrders.slice(0, 10).map((wo) => (
                  <li key={wo.id}>
                    <Link to={`/work-orders/${wo.id}`} className="flex flex-wrap items-center gap-2 py-2.5 transition-colors hover:bg-cream">
                      <span className="font-mono text-xs text-brand-600">{wo.code}</span>
                      <span className="min-w-0 flex-1 truncate text-sm text-navy">{wo.title}</span>
                      <TypeBadge value={wo.type} />
                      <StatusBadge value={wo.status} />
                      <span className="text-xs text-mutedText">{formatDate(wo.completed_at || wo.scheduled_at || wo.created_date)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-5">
          <section className="card-surface p-5">
            <h2 className="mb-3 font-heading text-base font-bold text-navy">Estadísticas</h2>
            <div className="space-y-3">
              <InfoRow label="Total de OTs" value={String(stats.total)} />
              <InfoRow label="Completadas" value={String(stats.completed)} />
              <InfoRow label="MTTR promedio" value={formatMinutes(stats.mttr)} />
            </div>
          </section>

          <section className="card-surface p-5">
            <h2 className="mb-3 font-heading text-base font-bold text-navy">Subcomponentes</h2>
            {children.length === 0 ? (
              <p className="text-sm text-mutedText">Sin subcomponentes.</p>
            ) : (
              <ul className="space-y-2">
                {children.map((child) => (
                  <li key={child.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/assets/${child.id}`)}
                      className="flex w-full items-center justify-between gap-2 rounded-xl border border-line/70 px-3 py-2 text-left transition-colors hover:bg-cream"
                    >
                      <span className="min-w-0">
                        <span className="block font-mono text-xs text-brand-600">{child.code}</span>
                        <span className="block truncate text-sm text-navy">{child.name}</span>
                      </span>
                      <AssetStatusBadge value={child.status} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <AttachmentPanel
            entity="AssetAttachment"
            field="asset_id"
            recordId={asset.id}
            canUpload={can.uploadAttachments(user)}
            canDelete={can.deleteAttachments(user)}
          />
        </div>
      </div>

      <NewAssetModal open={editing} onOpenChange={setEditing} asset={asset} assets={assets} onSaved={load} />
    </div>
  );
}