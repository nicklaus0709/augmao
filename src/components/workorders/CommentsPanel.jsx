import React, { useCallback, useEffect, useState } from "react";
import { Send, MessageSquare, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { formatDateTime } from "@/lib/format";
import { can } from "@/lib/permissions";
import { Spinner } from "@/components/common/EmptyState";

export default function CommentsPanel({ workOrderId, user, onCountChange }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await base44.entities.WorkOrderComment.filter(
        { work_order_id: workOrderId },
        { sort: "created_date", limit: 200 }
      );
      const items = result.items || [];
      setComments(items);
      if (onCountChange) onCountChange(items.length);
    } finally {
      setLoading(false);
    }
  }, [workOrderId, onCountChange]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async (event) => {
    event.preventDefault();
    const text = content.trim();
    if (!text || text.length > 2000) return;
    setSending(true);
    try {
      await base44.entities.WorkOrderComment.create({
        work_order_id: workOrderId,
        user_id: user?.id || null,
        user_name: user?.full_name || user?.email || "Usuario",
        content: text,
      });
      setContent("");
      await load();
    } finally {
      setSending(false);
    }
  };

  const remove = async (comment) => {
    await base44.entities.WorkOrderComment.delete(comment.id);
    await load();
  };

  const canDelete = can.deleteAttachments(user);

  return (
    <section className="card-surface p-5">
      <h2 className="mb-4 flex items-center gap-2 font-heading text-base font-bold text-navy">
        <MessageSquare size={17} className="text-brand-600" aria-hidden="true" />
        Comentarios
      </h2>

      {loading ? (
        <div className="flex justify-center py-6">
          <Spinner className="h-5 w-5" />
        </div>
      ) : comments.length === 0 ? (
        <p className="py-3 text-sm text-mutedText">Sin comentarios</p>
      ) : (
        <ul className="space-y-4">
          {comments.map((comment) => (
            <li key={comment.id} className="flex gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 font-mono text-[11px] font-medium text-brand-700">
                {(comment.user_name || "U").slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 text-sm">
                  <span className="font-medium text-navy">{comment.user_name || "Usuario"}</span>
                  <span className="text-xs text-mutedText">{formatDateTime(comment.created_date)}</span>
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-navy/90">{comment.content}</p>
              </div>
              {canDelete && (
                <button
                  type="button"
                  className="btn-icon h-8 w-8 text-red-500 hover:bg-red-50"
                  aria-label="Eliminar comentario"
                  onClick={() => remove(comment)}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={send} className="mt-5 flex items-center gap-2">
        <input
          className="field-input"
          placeholder="Agregar comentario..."
          aria-label="Agregar comentario"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={2000}
        />
        <button type="submit" className="btn-primary shrink-0" disabled={sending || !content.trim()} aria-label="Enviar comentario">
          {sending ? <Spinner className="h-4 w-4 text-cream" /> : <Send size={16} aria-hidden="true" />}
        </button>
      </form>
    </section>
  );
}