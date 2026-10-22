import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wrench, Eye, EyeOff, Loader2 } from "lucide-react";
import GoogleIcon from "@/components/GoogleIcon";
import Footer from "@/components/layout/Footer";
import { safeReturnTo } from "@/lib/authReturnTo";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // Destino posterior al login (por ejemplo al abrir un QR sin sesión). Solo rutas internas.
  const returnTo = safeReturnTo();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await base44.auth.loginViaEmailPassword(email, password);
      window.location.href = returnTo;
    } catch (err) {
      setError("Email o contraseña incorrectos");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    base44.auth.loginWithProvider("google", returnTo);
  };

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <div className="relative flex flex-1 items-center justify-center px-4 py-10">
        <div className="bp-grid-light pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-600/10 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-brand-600/5 blur-3xl" aria-hidden="true" />

        <div className="relative w-full max-w-md">
          <div className="mb-8 flex flex-col items-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy">
              <Wrench size={22} strokeWidth={2.2} className="text-cream" aria-hidden="true" />
            </span>
            <span className="mt-3 font-heading text-2xl font-bold tracking-tight text-navy">AuGmao</span>
            <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-mutedText">Gestión de Mantenimiento</span>
          </div>

          <div className="card-surface p-6 sm:p-8">
            <span className="eyebrow mb-3">Acceso</span>
            <h1 className="font-heading text-2xl font-bold text-navy">Iniciar sesión</h1>
            <p className="mt-2 text-sm text-mutedText">Ingresá tus credenciales para continuar</p>

            {error && (
              <p className="mt-5 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
                {error}
              </p>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="field-label">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="tu@empresa.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field-input h-auto py-2.5"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="field-label">Contraseña</Label>
                  <Link to="/forgot-password" className="text-xs font-medium text-brand-600 hover:underline">
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="field-input h-auto py-2.5 pr-11"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-mutedText hover:text-navy"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Ingresar
              </button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-line" />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-mutedText">o</span>
              <span className="h-px flex-1 bg-line" />
            </div>

            <Button variant="outline" className="h-11 w-full rounded-full text-sm font-semibold" onClick={handleGoogle}>
              <GoogleIcon className="mr-2 h-5 w-5" />
              Continuar con Google
            </Button>
          </div>

          <p className="mt-6 text-center text-xs text-mutedText">
            El acceso se otorga por invitación. Si no tenés cuenta, pedile al administrador que te invite.
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}