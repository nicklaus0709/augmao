import React from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { reportClientError } from "@/lib/errorReporting";

// Evita la pantalla en blanco ante un error de render y lo reporta.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    const withStack = Object.assign(new Error(error?.message || String(error)), {
      stack: (error?.stack || "") + "\n" + (info?.componentStack || ""),
    });
    reportClientError(withStack, "render");
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card-surface mx-auto my-10 max-w-md p-8 text-center" role="alert">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600">
          <AlertTriangle size={24} aria-hidden="true" />
        </span>
        <h1 className="font-heading text-xl font-bold text-navy">Algo salió mal en esta pantalla</h1>
        <p className="mt-2 text-sm text-mutedText">
          El error quedó registrado para el administrador. Podés volver a intentar o ir al inicio.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <button type="button" className="btn-secondary" onClick={() => this.setState({ error: null })}>
            <RotateCw size={16} aria-hidden="true" />
            Reintentar
          </button>
          <a href="/" className="btn-primary">Ir al inicio</a>
        </div>
      </div>
    );
  }
}
