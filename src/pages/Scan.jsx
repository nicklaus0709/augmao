import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ScanLine, Search, CameraOff, Loader2, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/common/PageHeader";

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export default function Scan() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const lockRef = useRef(false);
  const cameraOnRef = useRef(false);

  const [status, setStatus] = useState("starting");
  const [message, setMessage] = useState("");
  const [code, setCode] = useState("");
  const [searching, setSearching] = useState(false);

  const lookUp = useCallback(
    async (key, isId) => {
      if (isId) {
        const asset = await base44.entities.Asset.get(key).catch(() => null);
        if (asset) {
          navigate(`/scan/asset/${asset.id}`);
          return;
        }
        setMessage("El QR no corresponde a un activo de AuGmao");
        return;
      }
      const result = await base44.entities.Asset.filter({ code: key }, { limit: 1 });
      const asset = (result.items || [])[0];
      if (asset) {
        navigate(`/scan/asset/${asset.id}`);
        return;
      }
      setMessage(`No se encontró el activo ${key}`);
    },
    [navigate]
  );

  const handleText = useCallback(
    async (raw) => {
      const text = String(raw || "").trim();
      if (!text) return;
      setMessage("");
      const match = text.match(UUID_RE);
      if (match) {
        await lookUp(match[0], true);
        return;
      }
      if (/^https?:\/\//i.test(text)) {
        setMessage("El QR no corresponde a un activo de AuGmao");
        return;
      }
      await lookUp(text, false);
    },
    [lookUp]
  );

  useEffect(() => {
    let cancelled = false;
    let intervalId = null;
    let detector = null;

    const start = async () => {
      if (!window.isSecureContext) {
        setStatus("insecure");
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("nocamera");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        cameraOnRef.current = true;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setStatus("scanning");

        if ("BarcodeDetector" in window) {
          detector = new window.BarcodeDetector({ formats: ["qr_code"] });
          intervalId = setInterval(async () => {
            const video = videoRef.current;
            if (!video || video.readyState < 2 || lockRef.current) return;
            try {
              const found = await detector.detect(video);
              if (found.length) {
                lockRef.current = true;
                setStatus("processing");
                await handleText(found[0].rawValue);
                setTimeout(() => {
                  lockRef.current = false;
                  setStatus(cameraOnRef.current ? "scanning" : "nocamera");
                }, 2500);
              }
            } catch (e) {
              /* se reintenta en el próximo ciclo */
            }
          }, 450);
        }
      } catch (e) {
        setStatus("nocamera");
      }
    };

    start();

    return () => {
      cancelled = true;
      cameraOnRef.current = false;
      if (intervalId) clearInterval(intervalId);
      if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
    };
  }, [handleText]);

  const submitManual = async (event) => {
    event.preventDefault();
    const value = code.trim();
    if (!value) return;
    setSearching(true);
    setStatus("processing");
    try {
      await handleText(value);
    } finally {
      setSearching(false);
      setStatus(cameraOnRef.current ? "scanning" : status);
    }
  };

  const statusText = () => {
    switch (status) {
      case "starting":
        return "Iniciando cámara...";
      case "processing":
        return "Buscando activo...";
      case "nocamera":
        return "No se detectó ninguna cámara";
      case "insecure":
        return "La cámara solo funciona con HTTPS o en localhost";
      default:
        return "Escaneando... o podés ingresar el código del activo a mano";
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Escaneo"
        title="Escanear QR"
        subtitle="Apuntá la cámara al código QR de la máquina para ver su historial"
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="card-surface overflow-hidden">
            <div className="relative aspect-square w-full bg-navy-950 sm:aspect-video">
              <video
                ref={videoRef}
                playsInline
                muted
                className={`h-full w-full object-cover ${status === "scanning" || status === "processing" ? "" : "opacity-30"}`}
              />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-3/5 w-3/5 max-w-[280px] rounded-2xl border-2 border-brand-500/80 shadow-[0_0_0_9999px_rgba(10,15,20,0.35)]" />
              </div>
              {status === "nocamera" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-cream/80">
                  <CameraOff size={28} aria-hidden="true" />
                  <span className="text-sm">No se detectó ninguna cámara</span>
                </div>
              )}
              {status === "processing" && (
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-navy-950/80 py-2 text-sm text-cream">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Buscando activo...
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 border-t border-line px-4 py-3">
              <ScanLine size={16} className="shrink-0 text-brand-600" aria-hidden="true" />
              <p className="text-sm text-mutedText">{statusText()}</p>
            </div>

            {message && (
              <div className="flex items-start gap-2 border-t border-line bg-red-50 px-4 py-3 text-sm text-red-700">
                <span className="flex-1">{message}</span>
                <button type="button" onClick={() => setMessage("")} aria-label="Cerrar aviso" className="btn-icon h-6 w-6">
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div>
          <form onSubmit={submitManual} className="card-surface p-5">
            <span className="eyebrow mb-3">Ingreso manual</span>
            <label className="field-label" htmlFor="asset-code">Código del activo</label>
            <div className="flex items-center gap-2">
              <input
                id="asset-code"
                className="field-input field-mono"
                placeholder="PUMP-001"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <button type="submit" className="btn-primary shrink-0" disabled={searching} aria-label="Buscar activo">
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search size={16} aria-hidden="true" />}
              </button>
            </div>
            <p className="mt-3 text-xs text-mutedText">
              Los códigos QR de AuGmao abren el historial en vivo del activo dentro de la app.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}