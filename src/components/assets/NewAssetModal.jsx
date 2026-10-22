import React, { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { ASSET_CATEGORY, ASSET_STATUS, options } from "@/lib/constants";

const EMPTY = {
  code: "",
  name: "",
  category: "MACHINERY",
  status: "OPERATIONAL",
  location: "",
  manufacturer: "",
  model: "",
  serial_number: "",
  warranty_expires: "",
  parent_id: "",
};

function descendantsOf(assetId, assets) {
  const out = new Set();
  let queue = [assetId];
  while (queue.length) {
    const current = queue.pop();
    for (const asset of assets) {
      if (asset.parent_id === current && !out.has(asset.id)) {
        out.add(asset.id);
        queue.push(asset.id);
      }
    }
  }
  return out;
}

export default function NewAssetModal({ open, onOpenChange, asset, assets, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setForm(
      asset
        ? {
            code: asset.code || "",
            name: asset.name || "",
            category: asset.category || "MACHINERY",
            status: asset.status || "OPERATIONAL",
            location: asset.location || "",
            manufacturer: asset.manufacturer || "",
            model: asset.model || "",
            serial_number: asset.serial_number || "",
            warranty_expires: asset.warranty_expires || "",
            parent_id: asset.parent_id || "",
          }
        : EMPTY
    );
  }, [open, asset]);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const parentOptions = useMemo(() => {
    if (!asset) return assets;
    const blocked = descendantsOf(asset.id, assets);
    blocked.add(asset.id);
    return assets.filter((item) => !blocked.has(item.id));
  }, [asset, assets]);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.code.trim() || !form.name.trim() || !form.location.trim()) {
      setError("Completá código, nombre y ubicación");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        category: form.category,
        status: form.status,
        location: form.location.trim(),
        manufacturer: form.manufacturer.trim(),
        model: form.model.trim(),
        serial_number: form.serial_number.trim(),
        warranty_expires: form.warranty_expires || null,
        parent_id: form.parent_id || null,
      };

      const existing = await base44.entities.Asset.filter({ code: payload.code }, { limit: 5 });
      const duplicate = (existing.items || []).find((item) => item.id !== asset?.id);
      if (duplicate) {
        setError("Error al crear el activo. Verificá que el codigo no este en uso.");
        return;
      }

      if (asset) await base44.entities.Asset.update(asset.id, payload);
      else await base44.entities.Asset.create(payload);
      onOpenChange(false);
      onSaved();
    } catch (e) {
      setError("Error al crear el activo. Verificá que el codigo no este en uso.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading">{asset ? "Editar activo" : "Nuevo activo"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="asset-code">Código *</label>
              <input id="asset-code" className="field-input field-mono" placeholder="PUMP-002" value={form.code} onChange={set("code")} required />
            </div>
            <div>
              <label className="field-label" htmlFor="asset-name">Nombre *</label>
              <input id="asset-name" className="field-input" value={form.name} onChange={set("name")} required />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="asset-category">Categoría *</label>
              <select id="asset-category" className="field-input" value={form.category} onChange={set("category")}>
                {Object.entries(ASSET_CATEGORY).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="asset-status">Estado</label>
              <select id="asset-status" className="field-input" value={form.status} onChange={set("status")}>
                {options(ASSET_STATUS).map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="asset-location">Ubicación *</label>
            <input id="asset-location" className="field-input" placeholder="Planta 1 - Sector Norte" value={form.location} onChange={set("location")} required />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="field-label" htmlFor="asset-manufacturer">Fabricante</label>
              <input id="asset-manufacturer" className="field-input" placeholder="Grundfos" value={form.manufacturer} onChange={set("manufacturer")} />
            </div>
            <div>
              <label className="field-label" htmlFor="asset-model">Modelo</label>
              <input id="asset-model" className="field-input" placeholder="CM5-6" value={form.model} onChange={set("model")} />
            </div>
            <div>
              <label className="field-label" htmlFor="asset-serial">Número de serie</label>
              <input id="asset-serial" className="field-input" value={form.serial_number} onChange={set("serial_number")} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="asset-warranty">Vencimiento de garantía</label>
              <input id="asset-warranty" type="date" className="field-input" value={form.warranty_expires} onChange={set("warranty_expires")} />
            </div>
            <div>
              <label className="field-label" htmlFor="asset-parent">Activo padre</label>
              <select id="asset-parent" className="field-input" value={form.parent_id} onChange={set("parent_id")}>
                <option value="">Sin activo padre</option>
                {parentOptions.map((item) => (
                  <option key={item.id} value={item.id}>{item.code} - {item.name}</option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <button type="button" className="btn-secondary" onClick={() => onOpenChange(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {asset ? "Guardar cambios" : "Crear activo"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}