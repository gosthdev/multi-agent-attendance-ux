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
import { RefreshCw, Users, Phone, FileText, ShieldAlert, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getApiPrefix } from "@/lib/utils";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface Parent {
  id: string;
  documentNumber: string;
  phone: string;
  userId: string;
  user: User;
}

export function ParentsView() {
  const [parents, setParents] = useState<Parent[]>([]);
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

  const fetchParents = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = getCookie("id_token");
      const apiUrl = getApiPrefix();
      
      const response = await fetch(`${apiUrl}/parents`, {
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
      setParents(data);
    } catch (e: any) {
      console.error("Backend fetch failed:", e);
      setError(e.message || "Error al conectar con el servidor backend.");
      setParents([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchParents();
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
            <Users className="h-5 w-5 text-primary" />
            Apoderados de Familia
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Listado completo de apoderados (padres/tutores) registrados en el sistema con sus datos de contacto.
          </CardDescription>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => {
            startTransition(() => {
              fetchParents();
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
              <p className="text-sm font-semibold text-slate-900">Error al cargar los apoderados</p>
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
                  fetchParents();
                });
              }}
              variant="outline"
              size="sm"
              className="mt-2 h-8 px-4 border-slate-200 text-slate-700 hover:bg-slate-50 text-xs cursor-pointer"
            >
              Intentar de nuevo
            </Button>
          </div>
        ) : parents.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2 flex flex-col items-center justify-center">
            <Users className="h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">No se encontraron apoderados</p>
            <p className="text-xs text-slate-400">No hay registros de apoderados en el sistema actualmente.</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50 border-b border-slate-100">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[120px] font-bold text-slate-700 text-xs px-6 py-3">ID Apoderado</TableHead>
                <TableHead className="font-bold text-slate-700 text-xs px-6 py-3">Nombre Completo</TableHead>
                <TableHead className="font-bold text-slate-700 text-xs px-6 py-3">Correo</TableHead>
                <TableHead className="font-bold text-slate-700 text-xs px-6 py-3">DNI</TableHead>
                <TableHead className="font-bold text-slate-700 text-xs px-6 py-3">Teléfono</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {parents.map((parent) => (
                <TableRow key={parent.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                  <TableCell className="px-6 py-4 font-mono text-xs text-slate-500">
                    <div className="flex items-center gap-1.5 group">
                      <span className="truncate max-w-[80px]" title={parent.id}>
                        {parent.id}
                      </span>
                      <button
                        onClick={() => handleCopy(parent.id)}
                        className="p-1 rounded hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                        title="Copiar ID completo"
                      >
                        {copiedId === parent.id ? (
                          <Check className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 font-semibold text-slate-900 text-sm">
                    {parent.user.firstName} {parent.user.lastName}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-slate-600 text-sm">
                    <a href={`mailto:${parent.user.email}`} className="text-primary hover:underline">
                      {parent.user.email}
                    </a>
                  </TableCell>
                  <TableCell className="px-6 py-4 font-mono text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-slate-400" />
                      <span>{parent.documentNumber}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-slate-600 text-sm">
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      <span>{parent.phone}</span>
                    </div>
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
