import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

// Espera un tiempo antes de devolver el valor: se usa para los buscadores.
export default function useDebounce(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}