"use client";

import React, { useEffect, useState, startTransition, useTransition } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  RefreshCw,
  User,
  ShieldAlert,
  Copy,
  Check,
  UserPlus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Fingerprint,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getApiPrefix } from "@/lib/utils";

interface Student {
  id: string;
  documentNumber: string;
  firstName: string;
  lastName: string;
  parentId: string | null;
  baseClassroomId: string | null;
  rekognitionId: string | null;
  isActive: boolean;
  parent?: { id: string; documentNumber: string; phone: string } | null;
  baseClassroom?: { id: string; name: string; building: string } | null;
}

interface StudentsViewProps {
  user: {
    email?: string;
    given_name?: string;
    family_name?: string;
    "cognito:groups"?: string[];
  } | null;
}

const getCookie = (name: string) => {
  if (typeof document === "undefined") return "";
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift() || "";
  return "";
};

// ─────────────────────────────────────────────
// LIST VIEW (admin + teacher)
// ─────────────────────────────────────────────
function StudentsList({
  endpoint,
  title,
  description,
  emptyText,
}: {
  endpoint: string;
  title: string;
  description: string;
  emptyText: string;
}) {
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchStudents = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = getCookie("id_token");
      const apiUrl = getApiPrefix();
      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${response.statusText || "Error del servidor"}`
        );
      }

      const data = await response.json();
      setStudents(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message || "Error al conectar con el servidor.");
      setStudents([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [endpoint]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden font-sans">
      <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-5">
        <div className="space-y-1">
          <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {title}
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            {description}
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => startTransition(() => fetchStudents())}
          disabled={isLoading}
          className="h-8 gap-1.5 px-3 border-slate-200 text-slate-700 hover:bg-slate-50 text-xs cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Recargar
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="p-12 text-center space-y-3 flex flex-col items-center justify-center">
            <div className="h-10 w-10 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-500">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-slate-900">
              Error al cargar estudiantes
            </p>
            <div className="text-xs text-red-500 font-mono bg-red-50/50 px-3 py-1.5 rounded border border-red-100/50 max-w-sm overflow-hidden text-ellipsis whitespace-nowrap">
              {error}
            </div>
            <Button
              onClick={() => startTransition(() => fetchStudents())}
              variant="outline"
              size="sm"
              className="mt-2 h-8 px-4 border-slate-200 text-slate-700 hover:bg-slate-50 text-xs cursor-pointer"
            >
              Intentar de nuevo
            </Button>
          </div>
        ) : students.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2 flex flex-col items-center justify-center">
            <Users className="h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">{emptyText}</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50 border-b border-slate-100">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-bold text-slate-700 text-xs px-6 py-3">
                  ID
                </TableHead>
                <TableHead className="font-bold text-slate-700 text-xs px-6 py-3">
                  Nombre Completo
                </TableHead>
                <TableHead className="font-bold text-slate-700 text-xs px-6 py-3">
                  DNI
                </TableHead>
                <TableHead className="font-bold text-slate-700 text-xs px-6 py-3">
                  Aula
                </TableHead>
                <TableHead className="font-bold text-slate-700 text-xs px-6 py-3">
                  Estado
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => (
                <TableRow
                  key={student.id}
                  className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                >
                  <TableCell className="px-6 py-4 font-mono text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate max-w-[80px]" title={student.id}>
                        {student.id}
                      </span>
                      <button
                        onClick={() => handleCopy(student.id)}
                        className="p-1 rounded hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                        title="Copiar ID"
                      >
                        {copiedId === student.id ? (
                          <Check className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-slate-900 text-sm font-semibold">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-slate-400 shrink-0" />
                      {student.firstName} {student.lastName}
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-slate-600 text-sm">
                    <div className="flex items-center gap-1.5">
                      <Fingerprint className="h-4 w-4 text-slate-400" />
                      <span className="font-mono text-xs">
                        {student.documentNumber}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-slate-600 text-sm">
                    {student.baseClassroom ? (
                      <span className="text-xs bg-slate-100 px-2 py-0.5 rounded font-medium">
                        {student.baseClassroom.name}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">
                        Sin asignar
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <Badge
                      variant={student.isActive ? "default" : "destructive"}
                      className="text-[10px] h-5"
                    >
                      {student.isActive ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// CREATE STUDENT FORM (admin + teacher)
// ─────────────────────────────────────────────
interface CreateStudentForm {
  documentNumber: string;
  firstName: string;
  lastName: string;
  parentId: string;
  baseClassroomId: string;
}

interface Parent {
  id: string;
  documentNumber: string;
  phone: string;
  user: {
    firstName: string;
    lastName: string;
  };
}

interface Classroom {
  id: string;
  name: string;
  building: string;
  capacity: number;
}

const initialForm: CreateStudentForm = {
  documentNumber: "",
  firstName: "",
  lastName: "",
  parentId: "",
  baseClassroomId: "",
};

function CreateStudentForm() {
  const [form, setForm] = useState<CreateStudentForm>(initialForm);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [parents, setParents] = useState<Parent[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  useEffect(() => {
    const fetchOptions = async () => {
      setLoadingOptions(true);
      try {
        const token = getCookie("id_token");
        const apiUrl = getApiPrefix();

        const [parentsRes, classroomsRes] = await Promise.all([
          fetch(`${apiUrl}/parents`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${apiUrl}/classroom`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (parentsRes.ok) {
          setParents(await parentsRes.json());
        }
        if (classroomsRes.ok) {
          setClassrooms(await classroomsRes.json());
        }
      } catch (err) {
        console.error("Error loading options:", err);
      } finally {
        setLoadingOptions(false);
      }
    };

    fetchOptions();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setForm((prev) => ({ ...prev, [id]: value }));
  };

  const handleSelectChange = (field: "parentId" | "baseClassroomId", value: string) => {
    // Select items cannot use empty string as value, so we use a sentinel
    // string "__none" for the UI option and convert it to empty string
    // for the payload stored in the form state.
    const normalized = value === "__none" ? "" : value;
    setForm((prev) => ({ ...prev, [field]: normalized }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);

    if (!form.documentNumber || !form.firstName || !form.lastName) {
      setStatus({
        type: "error",
        message: "Nombre, apellido y DNI son obligatorios.",
      });
      return;
    }

    if (!/^\d{8}$/.test(form.documentNumber)) {
      setStatus({
        type: "error",
        message: "El DNI debe tener exactamente 8 dígitos.",
      });
      return;
    }

    startTransition(async () => {
      try {
        const token = getCookie("id_token");
        const apiUrl = getApiPrefix();

        const payload: Record<string, string> = {
          documentNumber: form.documentNumber,
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
        };
        if (form.parentId.trim()) payload.parentId = form.parentId.trim();
        if (form.baseClassroomId.trim())
          payload.baseClassroomId = form.baseClassroomId.trim();

        const response = await fetch(`${apiUrl}/students`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}: No se pudo registrar el estudiante.`
          );
        }

        setStatus({
          type: "success",
          message: "¡Estudiante registrado con éxito!",
        });
        setForm(initialForm);
      } catch (err: any) {
        setStatus({
          type: "error",
          message:
            err?.message ||
            "Error al registrar el estudiante. Intenta nuevamente.",
        });
      }
    });
  };

  return (
    <Card className="bg-white border-slate-200 shadow-sm rounded-2xl max-w-2xl font-sans">
      <CardHeader className="border-b border-slate-100 pb-5">
        <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-primary" />
          Registrar Nuevo Estudiante
        </CardTitle>
        <CardDescription className="text-xs text-slate-500">
          Crea un nuevo estudiante en el sistema. Nombre, apellido y DNI son
          obligatorios.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Nombre y Apellido */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="firstName" className="text-xs font-semibold text-slate-700">
                Nombres
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="firstName"
                  placeholder="Juan Carlos"
                  value={form.firstName}
                  onChange={handleChange}
                  className="pl-10 h-10 border-slate-200 text-slate-950 placeholder:text-slate-400 focus-visible:ring-primary/10 rounded-lg"
                  disabled={isPending}
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName" className="text-xs font-semibold text-slate-700">
                Apellidos
              </Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="lastName"
                  placeholder="Pérez Gómez"
                  value={form.lastName}
                  onChange={handleChange}
                  className="pl-10 h-10 border-slate-200 text-slate-950 placeholder:text-slate-400 focus-visible:ring-primary/10 rounded-lg"
                  disabled={isPending}
                  required
                />
              </div>
            </div>
          </div>

          {/* DNI */}
          <div className="space-y-1.5">
            <Label htmlFor="documentNumber" className="text-xs font-semibold text-slate-700">
              DNI (8 dígitos)
            </Label>
            <div className="relative">
              <Fingerprint className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="documentNumber"
                placeholder="45678912"
                value={form.documentNumber}
                onChange={handleChange}
                className="pl-10 h-10 border-slate-200 text-slate-950 placeholder:text-slate-400 focus-visible:ring-primary/10 rounded-lg"
                disabled={isPending}
                maxLength={8}
                required
              />
            </div>
          </div>

          {/* Opcionales - Selects de Apoderado y Aula */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Apoderado{" "}
                <span className="font-normal text-slate-400">(opcional)</span>
              </Label>
              <Select value={form.parentId} onValueChange={(value) => handleSelectChange("parentId", value)}>
                <SelectTrigger className="w-full h-10 border-slate-200 text-slate-950 rounded-lg" disabled={isPending || loadingOptions}>
                  <SelectValue placeholder={loadingOptions ? "Cargando..." : "Seleccionar apoderado"} />
                </SelectTrigger>
                <SelectContent position="popper" align="start" className="rounded-lg border-slate-200 bg-white min-w-[220px]">
                  <SelectItem value="__none">Sin apoderado</SelectItem>
                  {parents.map((parent) => (
                    <SelectItem key={parent.id} value={parent.id}>
                      {parent.user.firstName} {parent.user.lastName} ({parent.documentNumber})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Aula Base{" "}
                <span className="font-normal text-slate-400">(opcional)</span>
              </Label>
              <Select value={form.baseClassroomId} onValueChange={(value) => handleSelectChange("baseClassroomId", value)}>
                <SelectTrigger className="w-full h-10 border-slate-200 text-slate-950 rounded-lg" disabled={isPending || loadingOptions}>
                  <SelectValue placeholder={loadingOptions ? "Cargando..." : "Seleccionar aula"} />
                </SelectTrigger>
                <SelectContent position="popper" align="start" className="rounded-lg border-slate-200 bg-white min-w-[220px]">
                  <SelectItem value="__none">Sin aula asignada</SelectItem>
                  {classrooms.map((classroom) => (
                    <SelectItem key={classroom.id} value={classroom.id}>
                      {classroom.name} - {classroom.building} ({classroom.capacity} alumnos)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            className="w-full h-10 bg-primary hover:bg-primary/95 text-white font-medium shadow-sm transition-all rounded-lg flex items-center justify-center gap-2 border-0 cursor-pointer"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Registrando...
              </>
            ) : (
              "Crear Estudiante"
            )}
          </Button>

          {/* Status */}
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
                  {status.type === "success"
                    ? "Registro Exitoso"
                    : "Error de Registro"}
                </p>
                <p
                  className={`text-xs leading-normal ${
                    status.type === "success"
                      ? "text-emerald-700"
                      : "text-red-700"
                  }`}
                >
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

// MAIN EXPORT
export function StudentsView({ user }: StudentsViewProps) {
  const userGroups = user?.["cognito:groups"] || [];
  const isAdminOrTeacher =
    userGroups.includes("admin") || userGroups.includes("teacher");
  const isParent = userGroups.includes("parent");

  // Parent: only sees own students
  if (isParent && !isAdminOrTeacher) {
    return (
      <StudentsList
        endpoint="/students/own"
        title="Mis Estudiantes"
        description="Estudiantes vinculados a tu cuenta de apoderado."
        emptyText="No tienes estudiantes vinculados a tu cuenta."
      />
    );
  }

  // Admin / Teacher: full list + create
  return (
    <div className="space-y-6 font-sans">
      <Tabs defaultValue="list" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[360px] mb-6">
          <TabsTrigger value="list" className="cursor-pointer gap-2">
            <Users className="h-4 w-4" />
            Listado
          </TabsTrigger>
          <TabsTrigger value="create" className="cursor-pointer gap-2">
            <UserPlus className="h-4 w-4" />
            Nuevo Estudiante
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <StudentsList
            endpoint="/students"
            title="Todos los Estudiantes"
            description="Listado completo de estudiantes registrados en el sistema."
            emptyText="No hay estudiantes registrados actualmente."
          />
        </TabsContent>

        <TabsContent value="create">
          <CreateStudentForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}
