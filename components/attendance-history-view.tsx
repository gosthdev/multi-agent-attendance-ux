"use client";

import { useEffect, useState, startTransition } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { 
  Calendar as CalendarIcon, 
  Clock, 
  School, 
  RefreshCw, 
  AlertCircle, 
  Check, 
  Copy,
  ChevronRight,
  History,
  Users,
  Search,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { getApiPrefix, cn } from "@/lib/utils";

interface Course {
  id: string;
  name: string;
  code: string;
}

interface Classroom {
  id: string;
  name: string;
  building: string;
}

interface Schedule {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  course: Course;
  classroom: Classroom;
}

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  documentNumber: string;
}

interface AttendanceRecord {
  id: string;
  date: string;
  checkInTime: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED" | "JUSTIFIED";
  confidenceScore: string;
}

interface AttendanceItem {
  student: Student;
  attendance: AttendanceRecord | null;
}

export function AttendanceHistoryView() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [attendanceList, setAttendanceList] = useState<AttendanceItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  // Loading and Error States
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [schedulesError, setSchedulesError] = useState<string | null>(null);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  
  // Copied states
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const getCookie = (name: string) => {
    if (typeof document === 'undefined') return '';
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || '';
    return '';
  };

  const fetchSchedules = async () => {
    setLoadingSchedules(true);
    setSchedulesError(null);
    try {
      const token = getCookie("id_token");
      const apiUrl = getApiPrefix();
      
      const response = await fetch(`${apiUrl}/schedule/teacher`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setSchedules(data);
      if (data.length > 0) {
        setSelectedSchedule(data[0]);
      }
    } catch (e: any) {
      console.error("Failed to fetch schedules:", e);
      setSchedulesError(e.message || "Error al conectar con el servidor para obtener los horarios.");
    } finally {
      setLoadingSchedules(false);
    }
  };

  const fetchAttendance = async (scheduleId: string, date: Date) => {
    setLoadingAttendance(true);
    setAttendanceError(null);
    try {
      const token = getCookie("id_token");
      const apiUrl = getApiPrefix();
      
      // Format date in YYYY-MM-DD in local time
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;
      
      const response = await fetch(`${apiUrl}/attendance/teacher/schedule/${scheduleId}?time=${formattedDate}T12:00:00`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setAttendanceList(data);
    } catch (e: any) {
      console.error("Failed to fetch attendance:", e);
      setAttendanceError(e.message || "Error al obtener el historial de asistencia.");
      setAttendanceList([]);
    } finally {
      setLoadingAttendance(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  useEffect(() => {
    if (selectedSchedule) {
      fetchAttendance(selectedSchedule.id, selectedDate);
    } else {
      setAttendanceList([]);
    }
  }, [selectedSchedule, selectedDate]);

  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getDayName = (dayNum: number): string => {
    const days: Record<number, string> = {
      1: "Lunes",
      2: "Martes",
      3: "Miércoles",
      4: "Jueves",
      5: "Viernes",
      6: "Sábado",
      7: "Domingo"
    };
    return days[dayNum] || `Día ${dayNum}`;
  };

  // Filter students based on search query
  const filteredAttendance = attendanceList.filter(item => {
    const fullName = `${item.student.firstName} ${item.student.lastName}`.toLowerCase();
    const docNumber = item.student.documentNumber.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase()) || docNumber.includes(searchQuery.toLowerCase());
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-sans items-start">
      
      {/* LEFT COLUMN: Schedule List (col-span-4) */}
      <div className="lg:col-span-4 space-y-4">
        <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-slate-100 pb-4 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <History className="h-4.5 w-4.5 text-primary" />
                Mis Horarios
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Selecciona una clase para visualizar el registro.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                startTransition(() => {
                  fetchSchedules();
                });
              }}
              disabled={loadingSchedules}
              className="h-8 w-8 border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
              title="Recargar horarios"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loadingSchedules && "animate-spin")} />
            </Button>
          </CardHeader>
          
          <CardContent className="p-3">
            {loadingSchedules ? (
              <div className="space-y-3 p-2">
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </div>
            ) : schedulesError ? (
              <div className="p-6 text-center space-y-3 flex flex-col items-center justify-center">
                <div className="h-9 w-9 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-500">
                  <AlertCircle className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-900">Error al obtener horarios</p>
                  <p className="text-[11px] text-slate-500 leading-normal max-w-xs">{schedulesError}</p>
                </div>
                <Button 
                  onClick={fetchSchedules}
                  variant="outline"
                  size="sm"
                  className="h-7 px-3 border-slate-200 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Reintentar
                </Button>
              </div>
            ) : schedules.length === 0 ? (
              <div className="p-8 text-center text-slate-400 space-y-2 flex flex-col items-center justify-center">
                <Clock className="h-8 w-8 text-slate-300" />
                <p className="text-xs font-medium text-slate-600">Sin horarios asignados</p>
                <p className="text-[11px] text-slate-400">No se encontraron horarios para tu cuenta.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {schedules.map((schedule) => {
                  const isSelected = selectedSchedule?.id === schedule.id;
                  return (
                    <button
                      key={schedule.id}
                      onClick={() => setSelectedSchedule(schedule)}
                      className={cn(
                        "w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-start justify-between gap-3 group cursor-pointer",
                        isSelected 
                          ? "bg-slate-900 border-slate-900 text-white shadow-md"
                          : "bg-white border-slate-200 text-slate-900 hover:bg-slate-50 hover:border-slate-300"
                      )}
                    >
                      <div className="space-y-2 flex-1 min-w-0">
                        {/* Day & Code Header */}
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider",
                            isSelected 
                              ? "bg-white/15 text-white" 
                              : "bg-slate-100 text-slate-700"
                          )}>
                            {getDayName(schedule.dayOfWeek)}
                          </span>
                          <span className={cn(
                            "text-[10px] font-mono",
                            isSelected ? "text-slate-300" : "text-slate-500"
                          )}>
                            {schedule.course.code}
                          </span>
                        </div>
                        
                        {/* Course Name */}
                        <h4 className="font-bold text-sm truncate leading-tight">
                          {schedule.course.name}
                        </h4>
                        
                        {/* Time & Classroom Metadata */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs">
                            <Clock className={cn("h-3.5 w-3.5 shrink-0", isSelected ? "text-slate-300" : "text-slate-400")} />
                            <span className={isSelected ? "text-slate-200" : "text-slate-600"}>
                              {schedule.startTime.substring(0, 5)} - {schedule.endTime.substring(0, 5)}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1.5 text-xs">
                            <School className={cn("h-3.5 w-3.5 shrink-0", isSelected ? "text-slate-300" : "text-slate-400")} />
                            <span className={cn("truncate", isSelected ? "text-slate-200" : "text-slate-600")}>
                              {schedule.classroom.name} • {schedule.classroom.building}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <ChevronRight className={cn(
                        "h-4 w-4 shrink-0 self-center transition-transform group-hover:translate-x-0.5",
                        isSelected ? "text-white" : "text-slate-400"
                      )} />
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* RIGHT COLUMN: Attendance Log Detail (col-span-8) */}
      <div className="lg:col-span-8">
        {selectedSchedule ? (
          <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden">
            {/* Detailed Header */}
            <CardHeader className="border-b border-slate-100 pb-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                      {selectedSchedule.course.code}
                    </span>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <School className="h-3.5 w-3.5 text-slate-400" />
                      {selectedSchedule.classroom.name} ({selectedSchedule.classroom.building})
                    </span>
                  </div>
                  <CardTitle className="text-lg font-bold text-slate-900 leading-tight">
                    {selectedSchedule.course.name}
                  </CardTitle>
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    Horario de clase: {getDayName(selectedSchedule.dayOfWeek)} de {selectedSchedule.startTime.substring(0, 5)} a {selectedSchedule.endTime.substring(0, 5)}
                  </p>
                </div>
                
                {/* Date Picker Calendar Filter */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-semibold hidden md:inline">Fecha:</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-10 justify-start text-left font-normal border-slate-200 text-slate-700 hover:bg-slate-50 text-xs rounded-xl gap-2 cursor-pointer min-w-[180px]"
                      >
                        <CalendarIcon className="h-4 w-4 text-slate-400 shrink-0" />
                        <span>{format(selectedDate, "PPP", { locale: es })}</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => date && setSelectedDate(date)}
                        locale={es}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Search input and reload */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar estudiante por nombre o documento..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:bg-white transition-all h-9"
                  />
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    startTransition(() => {
                      fetchAttendance(selectedSchedule.id, selectedDate);
                    });
                  }}
                  disabled={loadingAttendance}
                  className="h-9 border-slate-200 text-slate-700 hover:bg-slate-50 gap-1.5 px-3 rounded-xl cursor-pointer text-xs shrink-0"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", loadingAttendance && "animate-spin")} />
                  <span className="hidden sm:inline">Recargar Asistencia</span>
                </Button>
              </div>
            </CardHeader>

            {/* Attendance Table Content */}
            <CardContent className="p-0">
              {loadingAttendance ? (
                <div className="p-6 space-y-4">
                  <div className="flex space-x-4">
                    <Skeleton className="h-6 w-1/4" />
                    <Skeleton className="h-6 w-1/4" />
                    <Skeleton className="h-6 w-1/4" />
                    <Skeleton className="h-6 w-1/4" />
                  </div>
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : attendanceError ? (
                <div className="p-12 text-center space-y-3 flex flex-col items-center justify-center bg-slate-50/20">
                  <div className="h-10 w-10 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-red-500">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">Error al cargar la asistencia</p>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      Ocurrió un error al obtener la lista de asistencia del servidor para esta fecha.
                    </p>
                  </div>
                  <div className="text-xs text-red-500 font-mono bg-red-50 px-3 py-1.5 rounded border border-red-100 max-w-sm overflow-hidden text-ellipsis whitespace-nowrap">
                    {attendanceError}
                  </div>
                  <Button 
                    onClick={() => fetchAttendance(selectedSchedule.id, selectedDate)}
                    variant="outline"
                    size="sm"
                    className="mt-2 h-8 px-4 border-slate-200 text-slate-700 hover:bg-slate-50 text-xs cursor-pointer rounded-lg"
                  >
                    Reintentar
                  </Button>
                </div>
              ) : filteredAttendance.length === 0 ? (
                <div className="p-16 text-center text-slate-400 space-y-3 flex flex-col items-center justify-center">
                  <Users className="h-10 w-10 text-slate-300" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-600">Sin registros de asistencia</p>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto">
                      {searchQuery 
                        ? "Ningún estudiante coincide con el criterio de búsqueda."
                        : "No se encontraron registros de estudiantes para este horario en la fecha seleccionada."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50 border-b border-slate-100">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[110px] font-bold text-slate-700 text-xs px-6 py-3">ID Estudiante</TableHead>
                        <TableHead className="font-bold text-slate-700 text-xs px-6 py-3">Estudiante</TableHead>
                        <TableHead className="font-bold text-slate-700 text-xs px-6 py-3">Documento</TableHead>
                        <TableHead className="font-bold text-slate-700 text-xs px-6 py-3">Ingreso</TableHead>
                        <TableHead className="font-bold text-slate-700 text-xs px-6 py-3 text-right">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAttendance.map((item) => {
                        const { student, attendance } = item;
                        
                        // Status styling configuration
                        let statusConfig = {
                          label: "SIN REGISTRO",
                          bg: "bg-slate-100 border-slate-300 text-slate-700 text-[11px]",
                        };
                        
                        if (attendance) {
                          if (attendance.status === "PRESENT") {
                            statusConfig = { label: "PRESENTE", bg: "bg-emerald-100 border-emerald-300 text-emerald-900 text-xs" };
                          } else if (attendance.status === "LATE") {
                            statusConfig = { label: "TARDE", bg: "bg-amber-100 border-amber-300 text-amber-900 text-xs" };
                          } else if (attendance.status === "ABSENT") {
                            statusConfig = { label: "FALTA", bg: "bg-red-100 border-red-300 text-red-900 text-xs" };
                          } else if (attendance.status === "EXCUSED" || attendance.status === "JUSTIFIED" as any) {
                            statusConfig = { label: "JUSTIFICADO", bg: "bg-blue-100 border-blue-300 text-blue-900 text-xs" };
                          }
                        }

                        return (
                          <TableRow key={student.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                            {/* Student UUID */}
                            <TableCell className="px-6 py-4 font-mono text-xs text-slate-500">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate max-w-[80px]" title={student.id}>
                                  {student.id}
                                </span>
                                <button
                                  onClick={() => handleCopy(student.id)}
                                  className="p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
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
                            
                            {/* Student Name */}
                            <TableCell className="px-6 py-4 font-semibold text-slate-900 text-sm">
                              {student.lastName}, {student.firstName}
                            </TableCell>
                            
                            {/* Document number */}
                            <TableCell className="px-6 py-4 font-mono text-xs text-slate-500">
                              {student.documentNumber}
                            </TableCell>
                            
                            {/* Check in Time */}
                            <TableCell className="px-6 py-4 text-slate-600 text-xs font-mono">
                              {attendance?.checkInTime ? (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3 text-slate-400" />
                                  {attendance.checkInTime.substring(0, 5)}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic font-sans">—</span>
                              )}
                            </TableCell>
                            

                             {/* Status Badge */}
                            <TableCell className="px-6 py-4 text-right">
                              <span className={cn(
                                "inline-block font-extrabold px-3 py-1.5 rounded-xl border tracking-wider shadow-xs text-xs",
                                statusConfig.bg
                              )}>
                                {statusConfig.label}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center space-y-3 flex flex-col items-center justify-center min-h-[300px]">
            <Clock className="h-10 w-10 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">Selecciona un horario</p>
            <p className="text-xs text-slate-400 max-w-xs">
              Por favor, elige uno de tus horarios asignados en la columna izquierda para cargar la lista de asistencia.
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
