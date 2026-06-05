"use client";

import React, { useEffect, useState, startTransition } from "react";
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableHead, 
  TableRow, 
  TableCell 
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { RefreshCw, GraduationCap, Phone, FileText, ShieldAlert, Copy, Check, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getApiPrefix } from "@/lib/utils";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Teacher {
  id: string;
  documentNumber: string;
  phone: string;
  isActive: boolean;
  userId: string;
  user: User;
  teacherCourses: any[];
}

export function TeachersView() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const getCookie = (name: string) => {
    if (typeof document === 'undefined') return '';
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || '';
    return '';
  };

  const fetchTeachers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = getCookie("id_token");
      const apiUrl = getApiPrefix();
      
      const response = await fetch(`${apiUrl}/teachers`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText || 'Error del servidor'}`);
      }
      
      const data = await response.json();
      setTeachers(data);
    } catch (e: any) {
      console.error("Backend fetch failed:", e);
      setError(e.message || "Error al conectar con el servidor backend.");
      setTeachers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTeachers();
  }, []);

  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden font-sans">
      <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-5">
        <div className="space-y-1">
          <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            Docentes del Colegio
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Listado completo de docentes registrados en el sistema con sus datos de contacto y estado.
          </CardDescription>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => {
            startTransition(() => {
              fetchTeachers();
            });
          }}
          disabled={isLoading}
          className="h-8 gap-1.5 px-3 border-slate-200 text-slate-700 hover:bg-slate-50 text-xs cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Recargar
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 space-y-4">
            <div className="flex space-x-4">
              <Skeleton className="h-6 w-1/5" />
              <Skeleton className="h-6 w-1/5" />
              <Skeleton className="h-6 w-1/5" />
              <Skeleton className="h-6 w-1/5" />
              <Skeleton className="h-6 w-1/5" />
            </div>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : error ? (
          <div className="p-12 text-center space-y-3 flex flex-col items-center justify-center border-t border-slate-100 bg-slate-50/30">
            <div className="h-10 w-10 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-500">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-900">Error al cargar los docentes</p>
              <p className="text-xs text-slate-500 max-w-md leading-relaxed mx-auto">
                No pudimos obtener los datos del servidor. Asegúrate de que el backend esté ejecutándose correctamente.
              </p>
            </div>
            <div className="text-xs text-red-500 font-mono bg-red-50/50 px-3 py-1.5 rounded border border-red-100/50 max-w-sm overflow-hidden text-ellipsis whitespace-nowrap">
              {error}
            </div>
            <Button 
              onClick={() => {
                startTransition(() => {
                  fetchTeachers();
                });
              }}
              variant="outline"
              size="sm"
              className="mt-2 h-8 px-4 border-slate-200 text-slate-700 hover:bg-slate-50 text-xs cursor-pointer"
            >
              Intentar de nuevo
            </Button>
          </div>
        ) : teachers.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2 flex flex-col items-center justify-center">
            <GraduationCap className="h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">No se encontraron docentes</p>
            <p className="text-xs text-slate-400">No hay registros de docentes en el sistema actualmente.</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50 border-b border-slate-100">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[120px] font-bold text-slate-700 text-xs px-6 py-3">ID Docente</TableHead>
                <TableHead className="font-bold text-slate-700 text-xs px-6 py-3">Nombre Completo</TableHead>
                <TableHead className="font-bold text-slate-700 text-xs px-6 py-3">Correo</TableHead>
                <TableHead className="font-bold text-slate-700 text-xs px-6 py-3">DNI</TableHead>
                <TableHead className="font-bold text-slate-700 text-xs px-6 py-3">Teléfono</TableHead>
                <TableHead className="w-[80px] text-center font-bold text-slate-700 text-xs px-6 py-3">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teachers.map((teacher) => (
                <TableRow key={teacher.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <TableCell className="px-6 py-4 font-mono text-xs text-slate-500">
                    <div className="flex items-center gap-1.5 group">
                      <span className="truncate max-w-[80px]" title={teacher.id}>
                        {teacher.id}
                      </span>
                      <button
                        onClick={() => handleCopy(teacher.id)}
                        className="p-1 rounded hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                        title="Copiar ID completo"
                      >
                        {copiedId === teacher.id ? (
                          <Check className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 font-semibold text-slate-900 text-sm">
                    {teacher.user.firstName} {teacher.user.lastName}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-slate-600 text-sm">
                    <a href={`mailto:${teacher.user.email}`} className="text-primary hover:underline">
                      {teacher.user.email}
                    </a>
                  </TableCell>
                  <TableCell className="px-6 py-4 font-mono text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-slate-400" />
                      <span>{teacher.documentNumber}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-slate-600 text-sm">
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      <span>{teacher.phone}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-center">
                    {teacher.isActive ? (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                        <CheckCircle2 className="h-3 w-3" />
                        Activo
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                        <AlertCircle className="h-3 w-3" />
                        Inactivo
                      </div>
                    )}
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
