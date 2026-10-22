import React, { useCallback, useEffect, useState } from "react";
import { Paperclip, Upload, Trash2, Image as ImageIcon, FileText } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { callFunction } from "@/api/data";
import { formatDateTime, formatBytes } from "@/lib/format";
import { ALLOWED_ATTACHMENT_TYPES, MAX_FILE_SIZE } from "@/lib/constants";
import EmptyState, { Spinner } from "@/components/common/EmptyState";
import ConfirmDialog from "@/components/common/ConfirmDialog";

// Entidad de adjuntos -> destino que valida la función "attachments".
const TARGET_BY_ENTITY = { WorkOrderAttachment: "work_order", AssetAttachment: "asset" };

// Panel de adjuntos: archivos privados de Base44, abiertos con URL firmada temporal.
export default function AttachmentPanel({ entity, field, recordId, canUpload, canDelete, onCountChange }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const target = TARGET_BY_ENTITY[entity];

  const load = useCallback(async () => {
    if (!recordId) return;
    setLoading(true);
    try {
      const result = await base44.entities[entity].filter({ [field]: recordId }, { sort: "-created_date", limit: 100 });
      const items = result.items || [];
      setFiles(items);
      if (onCountChange) onCountChange(items.length);
    } finally {
      setLoading(false);
    }
  }, [entity, field, recordId, onCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    if (file.size > MAX_FILE_SIZE) {
      setError("El archivo supera los 10 MB");
      return;
    }
    if (ALLOWED_ATTACHMENT_TYPES.length && !ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
      setError("No se pudo subir el archivo");
      return;
    }
    setUploading(true);
    try {
      const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
      await callFunction(
        "attachments",
        {
          action: "create",
          target,
          record_id: recordId,
          file_name: file.name,
          file_uri,
          file_type: file.type,
          size_bytes: file.size,
        },
        "No se pudo subir el archivo"
      );
      await load();
    } catch (e) {
      setError(e.message || "No se pudo subir el archivo");
    } finally {
      setUploading(false);
    }
  };

  const openFile = async (record) => {
    try {
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: record.file_uri });
      window.open(signed_url, "_blank", "noopener");
    } catch (e) {
      setError("No se pudo abrir el archivo");
    }
  };

  const remove = async (record) => {
    setError("");
    try {
      await callFunction("attachments", { action: "delete", target, id: record.id }, "No se pudo eliminar el archivo");
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="card-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-heading text-base font-bold text-navy">
          <Paperclip size={17} className="text-brand-600" aria-hidden="true" />
          Adjuntos
        </h2>
        {canUpload && (
          <label className="btn-secondary cursor-pointer">
            {uploading ? <Spinner className="h-4 w-4" /> : <Upload size={15} aria-hidden="true" />}
            <span>Subir</span>
            <input type="file" className="hidden" onChange={handleUpload} aria-label="Subir adjunto" />
          </label>
        )}
      </div>

      {error && <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-6">
          <Spinner className="h-5 w-5" />
        </div>
      ) : files.length === 0 ? (
        <EmptyState icon={Paperclip} title="Sin adjuntos" description="Todavía no se cargó ningún archivo." />
      ) : (
        <ul className="space-y-2">
          {files.map((record) => (
            <li key={record.id} className="flex items-start gap-3 rounded-xl border border-line/70 px-3 py-2">
              <span className="mt-0.5 text-mutedText">
                {record.file_type?.startsWith("image/") ? <ImageIcon size={16} /> : <FileText size={16} />}
              </span>
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => openFile(record)}
                  className="block max-w-full truncate text-left text-sm font-medium text-brand-600 hover:underline"
                >
                  {record.file_name}
                </button>
                <p className="mt-0.5 text-[11px] text-mutedText">
                  {formatDateTime(record.created_date)} · {formatBytes(record.size_bytes)}
                </p>
              </div>
              {canDelete && (
                <button
                  type="button"
                  onClick={() => setPendingDelete(record)}
                  aria-label={`Eliminar ${record.file_name}`}
                  className="btn-icon text-red-500 hover:bg-red-50"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`¿Eliminar ${pendingDelete?.file_name || "el archivo"}?`}
        description="El archivo deja de estar disponible para todo el equipo."
        onConfirm={() => {
          const record = pendingDelete;
          setPendingDelete(null);
          remove(record);
        }}
      />
    </div>
  );
}