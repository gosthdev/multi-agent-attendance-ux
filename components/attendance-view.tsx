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