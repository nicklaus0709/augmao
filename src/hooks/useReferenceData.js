import { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

// Activos, repuestos y equipo: datos que usan casi todas las pantallas.
export default function useReferenceData() {
  const [state, setState] = useState({ assets: [], parts: [], users: [], loading: true });

  const load = useCallback(async () => {
    const [assetsPage, partsPage, teamResponse] = await Promise.all([
      base44.entities.Asset.filter({}, { sort: "code", limit: 500 }),
      base44.entities.SparePart.filter({}, { sort: "code", limit: 500 }),
      base44.functions.invoke("manageUsers", { action: "list" }).catch(() => ({ data: { users: [] } })),
    ]);
    setState({
      assets: assetsPage.items || [],
      parts: partsPage.items || [],
      users: teamResponse.data?.users || [],
      loading: false,
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}