"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { Toaster, toast } from "sonner";
import {
  Camera,
  CameraOff,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  BookOpen,
  Loader2,
  RefreshCw,
  Scan,
  ShieldAlert,
  UserPlus,
  Search,
  Fingerprint,
  ArrowLeft,
  BadgeCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getApiPrefix } from "@/lib/utils";

type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  documentNumber: string;
  rekognitionId?: string | null;
  isActive?: boolean;
  baseClassroom?: { name?: string } | null;
}

interface AttendanceResult {
  status: AttendanceStatus;
  student: {
    id: string;
    firstName?: string;
    lastName?: string;
    documentNumber?: string;
  };
  schedule: {
    id: string;
    startTime: string;
    endTime: string;
    course?: { name?: string };
    classroom?: { name?: string };
  };
}

type ScanPhase =
  | { phase: "idle" }
  | { phase: "scanning" }
  | { phase: "processing" }
  | { phase: "success"; result: AttendanceResult }
  | { phase: "error"; message: string };

type FaceRegStep =
  | { step: "search" }
  | { step: "capture"; student: Student }
  | { step: "uploading"; student: Student }
  | { step: "done"; student: Student; message: string }
  | { step: "error"; student?: Student; message: string };


const STATUS_CONFIG: Record<
  AttendanceStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  PRESENT: {
    label: "Presente",
    color: "bg-emerald-500/15 text-emerald-700 border-emerald-200",
    icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
  },
  LATE: {
    label: "Tardanza",
    color: "bg-amber-500/15 text-amber-700 border-amber-200",
    icon: <Clock className="h-5 w-5 text-amber-500" />,
  },
  ABSENT: {
    label: "Ausente",
    color: "bg-red-500/15 text-red-700 border-red-200",
    icon: <AlertCircle className="h-5 w-5 text-red-500" />,
  },
  EXCUSED: {
    label: "Justificado",
    color: "bg-blue-500/15 text-blue-700 border-blue-200",
    icon: <CheckCircle2 className="h-5 w-5 text-blue-600" />,
  },
};

function getStudentName(s: { firstName?: string; lastName?: string }): string {
  return `${s.firstName || ""} ${s.lastName || ""}`.trim() || "Estudiante";
}

function blobToFile(blob: Blob, filename: string, maxKB: number): File {
  // We just wrap; caller handles quality reduction
  return new File([blob], filename, { type: blob.type });
}

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift() || "";
  return "";
}

function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setCameraReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setCameraReady(true);
        };
      }
    } catch {
      setCameraError(
        "No se pudo acceder a la cámara. Permite el acceso en tu navegador."
      );
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraReady(false);
  }, []);

  const captureJpeg = useCallback(
    async (qualityHigh: number, qualityLow: number, maxKB: number): Promise<File | null> => {
      if (!videoRef.current || !canvasRef.current || !cameraReady) return null;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const toBlob = (quality: number): Promise<Blob> =>
        new Promise((resolve, reject) =>
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("Canvas empty"))),
            "image/jpeg",
            quality
          )
        );

      let blob = await toBlob(qualityHigh);
      if (blob.size > maxKB * 1024) {
        blob = await toBlob(qualityLow);
      }
      return new File([blob], "photo.jpg", { type: "image/jpeg" });
    },
    [cameraReady]
  );

  return { videoRef, canvasRef, cameraReady, cameraError, startCamera, stopCamera, captureJpeg };
}

interface CameraFeedProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  cameraReady: boolean;
  cameraError: string | null;
  onRetry: () => void;
  scanning?: boolean;
  processing?: boolean;
  processingLabel?: string;
}

function CameraFeed({
  videoRef,
  canvasRef,
  cameraReady,
  cameraError,
  onRetry,
  scanning = false,
  processing = false,
  processingLabel = "Procesando…",
}: CameraFeedProps) {
  return (
    <div className="relative bg-zinc-950 aspect-video flex items-center justify-center overflow-hidden rounded-xl">
      {cameraError ? (
        <div className="flex flex-col items-center gap-3 text-center p-6">
          <CameraOff className="h-10 w-10 text-zinc-600" />
          <p className="text-xs text-zinc-400 max-w-xs">{cameraError}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={onRetry}
            className="text-xs gap-1.5 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Reintentar
          </Button>
        </div>
      ) : (
        <>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            ref={videoRef}
            className="w-full h-full object-cover scale-x-[-1]"
            autoPlay
            playsInline
            muted
          />

          {/* Scan frame (always) */}
          {!scanning && !processing && cameraReady && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="relative w-44 h-52 opacity-30">
                <span className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white rounded-tl-md" />
                <span className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white rounded-tr-md" />
                <span className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white rounded-bl-md" />
                <span className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white rounded-br-md" />
              </div>
            </div>
          )}

          {/* Scanning overlay */}
          {scanning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[1px]">
              <div className="relative w-44 h-52">
                <span className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-primary rounded-tl-md animate-pulse" />
                <span className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-primary rounded-tr-md animate-pulse" />
                <span className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-primary rounded-bl-md animate-pulse" />
                <span className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-primary rounded-br-md animate-pulse" />
                <div className="absolute left-0 right-0 h-0.5 bg-primary/70 top-1/2 animate-[scanLine_1.5s_ease-in-out_infinite]" />
              </div>
              <p className="mt-4 text-xs text-white/80 animate-pulse">
                Escaneando rostro…
              </p>
            </div>
          )}

          {/* Processing overlay */}
          {processing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <p className="mt-3 text-xs text-white/80">{processingLabel}</p>
            </div>
          )}
        </>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

export function AttendanceView() {
  return (
    <div className="space-y-6 font-sans">
      <Toaster position="top-right" closeButton richColors theme="light" />

      <Tabs defaultValue="asistencia" className="w-full">
        <TabsList className="mb-6 max-w-sm">
          <TabsTrigger value="asistencia" className="gap-2 cursor-pointer" id="tab-asistencia">
            <Scan className="h-4 w-4" />
            Registrar Asistencia
          </TabsTrigger>
          <TabsTrigger value="rostro" className="gap-2 cursor-pointer" id="tab-rostro">
            <UserPlus className="h-4 w-4" />
            Registrar Rostro
          </TabsTrigger>
        </TabsList>

        <TabsContent value="asistencia">
          <AttendanceScanPanel />
        </TabsContent>

        <TabsContent value="rostro">
          <FaceRegistrationPanel />
        </TabsContent>
      </Tabs>

      <style>{`
        @keyframes scanLine {
          0%   { transform: translateY(-80px); opacity: 0.8; }
          50%  { transform: translateY(80px);  opacity: 1;   }
          100% { transform: translateY(-80px); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}

function AttendanceScanPanel() {
  const { videoRef, canvasRef, cameraReady, cameraError, startCamera, stopCamera, captureJpeg } =
    useCamera();
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [uiState, setUiState] = useState<ScanPhase>({ phase: "idle" });

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    };
  }, [startCamera, stopCamera]);

  const captureAndSend = useCallback(async () => {
    setUiState({ phase: "processing" });
    const photo = await captureJpeg(0.85, 0.5, 50);
    if (!photo) {
      setUiState({ phase: "error", message: "No se pudo capturar la imagen." });
      return;
    }

    const formData = new FormData();
    formData.append("photo", photo);

    try {
      const res = await fetch(`${getApiPrefix()}/attendance/schedule`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        const msg =
          data?.message ||
          (res.status === 409
            ? "La asistencia ya fue registrada para este horario hoy."
            : res.status === 400
            ? "No se encontró coincidencia facial o no hay horario activo."
            : "Error al registrar la asistencia.");
        setUiState({ phase: "error", message: msg });
        return;
      }
      setUiState({ phase: "success", result: data as AttendanceResult });
      toast.success("Asistencia registrada correctamente");
    } catch {
      setUiState({ phase: "error", message: "No se pudo conectar con el servidor." });
    }
  }, [captureJpeg]);

  const startScan = useCallback(() => {
    setUiState({ phase: "scanning" });
    scanTimerRef.current = setTimeout(() => captureAndSend(), 2000);
  }, [captureAndSend]);

  const reset = useCallback(() => {
    if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    setUiState({ phase: "idle" });
  }, []);

  const isProcessing = uiState.phase === "scanning" || uiState.phase === "processing";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
      {/* Camera card */}
      <div className="lg:col-span-3 space-y-4">
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          {/* Header */}
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Camera className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground leading-tight">
                  Reconocimiento Facial
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Coloca tu rostro frente a la cámara
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  cameraReady ? "bg-emerald-500 animate-pulse" : "bg-red-400"
                }`}
              />
              <span className="text-[11px] text-muted-foreground">
                {cameraReady ? "En vivo" : "Sin señal"}
              </span>
            </div>
          </div>

          {/* Feed */}
          <div className="p-4">
            <CameraFeed
              videoRef={videoRef}
              canvasRef={canvasRef}
              cameraReady={cameraReady}
              cameraError={cameraError}
              onRetry={startCamera}
              scanning={uiState.phase === "scanning"}
              processing={uiState.phase === "processing"}
              processingLabel="Verificando identidad…"
            />
          </div>

          {/* Actions */}
          <div className="px-5 pb-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
            {uiState.phase === "idle" && (
              <>
                <p className="text-xs text-muted-foreground">
                  Presiona el botón y coloca tu rostro en el encuadre.
                </p>
                <Button
                  onClick={startScan}
                  disabled={!cameraReady}
                  className="gap-2 cursor-pointer"
                  id="btn-scan-attendance"
                >
                  <Scan className="h-4 w-4" />
                  Registrar Asistencia
                </Button>
              </>
            )}
            {isProcessing && (
              <>
                <p className="text-xs text-muted-foreground animate-pulse">
                  {uiState.phase === "scanning" ? "Preparando captura…" : "Enviando al servidor…"}
                </p>
                <Button
                  variant="outline"
                  onClick={reset}
                  disabled={uiState.phase === "processing"}
                  className="gap-2 cursor-pointer"
                >
                  Cancelar
                </Button>
              </>
            )}
            {(uiState.phase === "success" || uiState.phase === "error") && (
              <>
                <p className="text-xs text-muted-foreground">
                  {uiState.phase === "success"
                    ? "Asistencia registrada. ¿Siguiente estudiante?"
                    : "Ocurrió un problema. Intenta de nuevo."}
                </p>
                <Button
                  onClick={reset}
                  variant={uiState.phase === "error" ? "destructive" : "outline"}
                  className="gap-2 cursor-pointer"
                  id="btn-scan-again"
                >
                  <RefreshCw className="h-4 w-4" />
                  Escanear de nuevo
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Info / result panel */}
      <div className="lg:col-span-2 space-y-4">
        {uiState.phase === "success" && <AttendanceResultCard result={uiState.result} />}
        {uiState.phase === "error" && <ErrorCard message={uiState.message} />}
        {(uiState.phase === "idle" || isProcessing) && (
          <AttendanceInstructionsCard scanning={isProcessing} />
        )}
      </div>
    </div>
  );
}

function FaceRegistrationPanel() {
  const [faceStep, setFaceStep] = useState<FaceRegStep>({ step: "search" });

  const goToCapture = (student: Student) => setFaceStep({ step: "capture", student });
  const goToSearch = () => setFaceStep({ step: "search" });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
      {/* Left: step content */}
      <div className="lg:col-span-3 space-y-4">
        {faceStep.step === "search" && <StudentSearchStep onSelect={goToCapture} />}
        {(faceStep.step === "capture" ||
          faceStep.step === "uploading" ||
          faceStep.step === "done" ||
          faceStep.step === "error") && (
          <FaceCaptureStep
            faceStep={faceStep}
            setFaceStep={setFaceStep}
            onBack={goToSearch}
          />
        )}
      </div>

      {/* Right: guide card */}
      <div className="lg:col-span-2">
        <FaceRegGuideCard step={faceStep.step} />
      </div>
    </div>
  );
}

function StudentSearchStep({ onSelect }: { onSelect: (s: Student) => void }) {
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setSearched(false);
    try {
      const token = getCookie("id_token");
      const res = await fetch(`${getApiPrefix()}/students`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error al obtener estudiantes");
      const all: Student[] = await res.json();
      const q = query.toLowerCase();
      const filtered = all.filter(
        (s) =>
          s.firstName?.toLowerCase().includes(q) ||
          s.lastName?.toLowerCase().includes(q) ||
          s.documentNumber?.includes(q)
      );
      setStudents(filtered);
      setSearched(true);
    } catch {
      setError("No se pudieron cargar los estudiantes. Verifica la conexión.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") search();
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center">
          <Search className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Buscar Estudiante</p>
          <p className="text-[11px] text-muted-foreground">
            Busca por nombre, apellido o DNI
          </p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Search input */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
            <Input
              id="student-search-input"
              placeholder="Nombre, apellido o DNI…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-9 h-10 text-sm"
            />
          </div>
          <Button
            onClick={search}
            disabled={loading || !query.trim()}
            className="gap-2 cursor-pointer shrink-0"
            id="btn-search-student"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Buscar
          </Button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        {/* Results */}
        {searched && students.length === 0 && !loading && (
          <p className="text-xs text-muted-foreground text-center py-6">
            No se encontraron estudiantes con ese criterio.
          </p>
        )}

        {students.length > 0 && (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {students.map((s) => (
              <button
                key={s.id}
                onClick={() => onSelect(s)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-left group"
                id={`student-item-${s.id}`}
              >
                <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {getStudentName(s)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    DNI: {s.documentNumber}
                    {s.baseClassroom?.name ? ` · ${s.baseClassroom.name}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {s.rekognitionId ? (
                    <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 border-emerald-200 border font-medium">
                      <Fingerprint className="h-3 w-3 mr-1" />
                      Registrado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground">
                      Sin rostro
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}