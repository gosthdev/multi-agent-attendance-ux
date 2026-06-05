"use client";

import React, { useEffect, useState, startTransition } from "react";
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
import { RefreshCw, BookOpen, Hash, ShieldAlert, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getApiPrefix } from "@/lib/utils";

interface Course {
  id: string;
  name: string;
  code: string;
}

export function CoursesView() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const getCookie = (name: string) => {
    if (typeof document === "undefined") return "";
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(";").shift() || "";
    return "";
  };

  const fetchCourses = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = getCookie("id_token");
      const apiUrl = getApiPrefix();

      const response = await fetch(`${apiUrl}/courses`, {
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
      setCourses(data);
    } catch (e: any) {
      console.error("Backend fetch failed:", e);
      setError(e.message || "Error al conectar con el servidor backend.");
      setCourses([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

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
            <BookOpen className="h-5 w-5 text-primary" />
            Cursos Registrados
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Listado completo de cursos académicos disponibles en el sistema.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            startTransition(() => {
              fetchCourses();
            });
          }}
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
            <div className="flex space-x-4">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-6 w-1/3" />
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
              <p className="text-sm font-semibold text-slate-900">
                Error al cargar los cursos
              </p>
              <p className="text-xs text-slate-500 max-w-md leading-relaxed mx-auto">
                No pudimos obtener los datos del servidor. Asegúrate de que el
                backend esté ejecutándose correctamente.
              </p>
            </div>
            <div className="text-xs text-red-500 font-mono bg-red-50/50 px-3 py-1.5 rounded border border-red-100/50 max-w-sm overflow-hidden text-ellipsis whitespace-nowrap">
              {error}
            </div>
            <Button
              onClick={() => {
                startTransition(() => {
                  fetchCourses();
                });
              }}
              variant="outline"
              size="sm"
              className="mt-2 h-8 px-4 border-slate-200 text-slate-700 hover:bg-slate-50 text-xs cursor-pointer"
            >
              Intentar de nuevo
            </Button>
          </div>
        ) : courses.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2 flex flex-col items-center justify-center">
            <BookOpen className="h-8 w-8 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">
              No se encontraron cursos
            </p>
            <p className="text-xs text-slate-400">
              No hay cursos registrados en el sistema actualmente.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50 border-b border-slate-100">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-bold text-slate-700 text-xs px-6 py-3">
                  ID Curso
                </TableHead>
                <TableHead className="font-bold text-slate-700 text-xs px-6 py-3">
                  Nombre del Curso
                </TableHead>
                <TableHead className="font-bold text-slate-700 text-xs px-6 py-3">
                  Código
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses.map((course) => (
                <TableRow
                  key={course.id}
                  className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                >
                  <TableCell className="px-6 py-4 font-mono text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="truncate max-w-[80px]"
                        title={course.id}
                      >
                        {course.id}
                      </span>
                      <button
                        onClick={() => handleCopy(course.id)}
                        className="p-1 rounded hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                        title="Copiar ID"
                      >
                        {copiedId === course.id ? (
                          <Check className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 font-semibold text-slate-900 text-sm">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-slate-400 shrink-0" />
                      <span>{course.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-slate-600 text-sm">
                    <div className="flex items-center gap-1.5">
                      <Hash className="h-4 w-4 text-slate-400 shrink-0" />
                      <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">
                        {course.code}
                      </span>
                      <button
                        onClick={() => handleCopy(course.code)}
                        className="p-1 rounded hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                        title="Copiar código"
                      >
                        {copiedId === course.code ? (
                          <Check className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
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
