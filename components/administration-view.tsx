"use client";

import React, { useState, useTransition } from "react";
import { toast, Toaster } from "sonner";
import { 
  UserPlus, 
  Mail, 
  Lock, 
  Phone, 
  Fingerprint, 
  User, 
  Loader2, 
  Eye, 
  EyeOff,
  ShieldCheck,
  GraduationCap,
  Users,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
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
import { 
  Tabs, 
  TabsList, 
  TabsTrigger, 
  TabsContent 
} from "@/components/ui/tabs";
import { getApiPrefix } from "@/lib/utils";

interface AdministrationViewProps {
  user: {
    email?: string;
    given_name?: string;
    family_name?: string;
    name?: string;
    role?: string;
    "cognito:groups"?: string[];
  } | null;
}

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  documentNumber: string;
  phone: string;
  password: string;
}

const initialFormState: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  documentNumber: "",
  phone: "",
  password: ""
};

export function AdministrationView({ user }: AdministrationViewProps) {
  const userGroups = user?.["cognito:groups"] || [];
  const isAdmin = userGroups.includes("admin");
  const isTeacher = userGroups.includes("teacher");

  // Determine available tabs
  const defaultTab = isAdmin ? "teachers" : "parents";

  return (
    <div className="space-y-6 font-sans">
      {isAdmin ? (
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-[400px] mb-6">
            <TabsTrigger value="teachers" className="cursor-pointer gap-2">
              <GraduationCap className="h-4 w-4" />
              Crear Docente
            </TabsTrigger>
            <TabsTrigger value="parents" className="cursor-pointer gap-2">
              <Users className="h-4 w-4" />
              Crear Apoderado
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="teachers">
            <UserCreationForm type="teacher" />
          </TabsContent>
          
          <TabsContent value="parents">
            <UserCreationForm type="parent" />
          </TabsContent>
        </Tabs>
      ) : isTeacher ? (
        // Teachers can only create parents
        <UserCreationForm type="parent" />
      ) : (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-red-700 flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">Acceso Denegado</p>
            <p className="text-xs text-red-500">No tienes permisos de administración en tu cuenta actual.</p>
          </div>
        </div>
      )}
      <Toaster position="top-right" closeButton richColors theme="light" />
    </div>
  );
}

function UserCreationForm({ type }: { type: "teacher" | "parent" }) {
  const [form, setForm] = useState<FormState>(initialFormState);
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const getCookie = (name: string) => {
    if (typeof document === 'undefined') return '';
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || '';
    return '';
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setForm(prev => ({
      ...prev,
      [id]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    // Client-side validations
    if (!form.firstName || !form.lastName || !form.email || !form.documentNumber || !form.phone || !form.password) {
      setStatus({ type: "error", message: "Por favor, completa todos los campos del formulario." });
      return;
    }

    if (!/^\d{8}$/.test(form.documentNumber)) {
      setStatus({ type: "error", message: "El número de documento debe contener exactamente 8 dígitos." });
      return;
    }

    if (!/^9\d{8}$/.test(form.phone)) {
      setStatus({ type: "error", message: "El teléfono debe empezar con 9 y contener exactamente 9 dígitos." });
      return;
    }

    startTransition(async () => {
      try {
        const token = getCookie("id_token");
        const apiPrefix = getApiPrefix();
        const endpoint = `${apiPrefix}/administration/${type}`;

        const payload = {
          user: {
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            email: form.email.trim()
          },
          documentNumber: form.documentNumber,
          phone: form.phone,
          password: form.password
        };

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        if (response.status !== 201) {
          throw new Error("No se pudo completar el registro. Por favor, intente nuevamente.");
        }

        setStatus({
          type: "success",
          message: `¡${type === "teacher" ? "Docente" : "Apoderado"} registrado con éxito!`
        });
        setForm(initialFormState); // Clear form
      } catch (error: any) {
        console.error("Creation error:", error);
        setStatus({
          type: "error",
          message: "Ocurrió un error al registrar el usuario. Por favor, intente nuevamente."
        });
      }
    });
  };

  const typeLabel = type === "teacher" ? "Docente" : "Apoderado";

  return (
    <Card className="bg-white border-slate-200 shadow-sm rounded-2xl max-w-2xl">
      <CardHeader className="border-b border-slate-100 pb-5">
        <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-primary" />
          Registrar Nuevo {typeLabel}
        </CardTitle>
        <CardDescription className="text-xs text-slate-500">
          Crea las credenciales de acceso para un {typeLabel.toLowerCase()} en AWS Cognito e ingrésalo a la base de datos.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* User Fields Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="firstName" className="text-xs font-semibold text-slate-700">Nombres</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="firstName"
                  placeholder="Juan Carlos"
                  value={form.firstName}
                  onChange={handleInputChange}
                  className="pl-10 h-10 border-slate-200 text-slate-950 placeholder:text-slate-400 focus-visible:ring-primary/10 rounded-lg"
                  disabled={isPending}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lastName" className="text-xs font-semibold text-slate-700">Apellidos</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="lastName"
                  placeholder="Pérez Gómez"
                  value={form.lastName}
                  onChange={handleInputChange}
                  className="pl-10 h-10 border-slate-200 text-slate-950 placeholder:text-slate-400 focus-visible:ring-primary/10 rounded-lg"
                  disabled={isPending}
                  required
                />
              </div>
            </div>
          </div>

          {/* Email Field */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-semibold text-slate-700">Correo Electrónico</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="email"
                type="email"
                placeholder="usuario@colegio.com"
                value={form.email}
                onChange={handleInputChange}
                className="pl-10 h-10 border-slate-200 text-slate-950 placeholder:text-slate-400 focus-visible:ring-primary/10 rounded-lg"
                disabled={isPending}
                required
              />
            </div>
          </div>

          {/* Document and Phone Rows */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="documentNumber" className="text-xs font-semibold text-slate-700">Número de Documento (DNI - 8 dígitos)</Label>
              <div className="relative">
                <Fingerprint className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="documentNumber"
                  placeholder="45678912"
                  value={form.documentNumber}
                  onChange={handleInputChange}
                  className="pl-10 h-10 border-slate-200 text-slate-950 placeholder:text-slate-400 focus-visible:ring-primary/10 rounded-lg"
                  disabled={isPending}
                  maxLength={8}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-xs font-semibold text-slate-700">Teléfono (9 dígitos, inicia con 9)</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="phone"
                  placeholder="987654321"
                  value={form.phone}
                  onChange={handleInputChange}
                  className="pl-10 h-10 border-slate-200 text-slate-950 placeholder:text-slate-400 focus-visible:ring-primary/10 rounded-lg"
                  disabled={isPending}
                  maxLength={9}
                  required
                />
              </div>
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-xs font-semibold text-slate-700">Contraseña Temporal</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Contraseña del usuario"
                value={form.password}
                onChange={handleInputChange}
                className="pl-10 pr-10 h-10 border-slate-200 text-slate-950 placeholder:text-slate-400 focus-visible:ring-primary/10 rounded-lg"
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
                Guardando registro...
              </>
            ) : (
              `Crear ${typeLabel}`
            )}
          </Button>

          {/* Status Message */}
          {status && (
            <div
              className={`p-4 rounded-xl border flex items-start gap-3 transition-all duration-200 animate-in fade-in slide-in-from-top-2 ${
                status.type === "success"
                  ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                  : "bg-red-50 border-red-100 text-red-800"
              }`}
            >
              {status.type === "success" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-slate-900">
                  {status.type === "success" ? "Registro Exitoso" : "Error de Registro"}
                </p>
                <p className={`text-xs leading-normal ${status.type === "success" ? "text-emerald-700" : "text-red-700"}`}>
                  {status.message}
                </p>
              </div>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
