"use client";

import React, { useState, useTransition, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast, Toaster } from "sonner";
import { Mail, Lock, Eye, EyeOff, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent 
} from "@/components/ui/card";
import { loginWithCognito } from "@/lib/cognito";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Por favor, completa todos los campos.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await loginWithCognito(email, password);

        // Store Cognito ID Token in cookie
        const maxAge = result.ExpiresIn || 3600;
        document.cookie = `id_token=${result.IdToken}; path=/; max-age=${maxAge}; SameSite=Strict; Secure`;
        
        toast.success("¡Inicio de sesión exitoso!");

        // Refresh page and redirect
        router.refresh();
        router.push(callbackUrl);
      } catch (error: any) {
        console.error("Login error:", error);
        toast.error(error.message || "Credenciales incorrectas o error de conexión.");
      }
    });
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-slate-50/50 text-slate-900 overflow-hidden font-sans">
      {/* Soft Decorative Blur Blobs */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-blue-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none" />

      <div className="z-10 w-full max-w-md px-6">
        {/* Brand / Logo Section */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center shadow-md mb-4">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700">
            Colegio Narvez
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Sistema de control de asistencia inteligente & justificaciones
          </p>
        </div>

        {/* Login Card using shadcn UI elements */}
        <Card className="bg-white border-slate-200 shadow-xl rounded-2xl">
          <CardHeader className="space-y-1.5 pb-5">
            <CardTitle className="text-xl font-bold text-slate-900">
              Iniciar Sesión
            </CardTitle>
            <CardDescription className="text-slate-500 text-xs">
              Ingresa tus credenciales para acceder a la plataforma
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-5">
              {/* Email Field */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                  Correo Electrónico
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu.correo@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-10 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:border-primary/50 focus-visible:ring-primary/10 transition-all rounded-lg"
                    disabled={isPending}
                    required
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-semibold text-slate-700">
                  Contraseña
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-10 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:border-primary/50 focus-visible:ring-primary/10 transition-all rounded-lg"
                    disabled={isPending}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                    disabled={isPending}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="w-full h-10 bg-primary hover:bg-primary/95 text-white font-medium shadow-sm transition-all rounded-lg flex items-center justify-center gap-2 border-0 cursor-pointer"
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Iniciando sesión...
                  </>
                ) : (
                  "Ingresar"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer info */}
        <p className="mt-8 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Smart Attendance System. Todos los derechos reservados.
        </p>
      </div>
      <Toaster position="top-right" closeButton richColors theme="light" />
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 text-slate-600 font-sans">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <SignInForm />
    </Suspense>
  );
}
