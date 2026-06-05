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