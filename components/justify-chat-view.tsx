"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import {
  Bot, Paperclip, ArrowUp, RefreshCw, AlertCircle, Users
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { getApiPrefix } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface Student {
  id: string;
  firstName?: string;
  lastName?: string;
  documentNumber?: string;
}

const createSessionId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const getCookie = (name: string) => {
  if (typeof document === "undefined") return "";
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift() || "";
  return "";
};

const requireToken = () => {
  const token = getCookie("id_token");
  if (!token) {
    throw new Error("No se encontro el token de sesion. Inicia sesion nuevamente.");
  }
  return token;
};

const extractResponseMessage = (data: unknown) => {
  if (!data) return "No se recibio respuesta del agente.";
  if (typeof data === "string") return data;
  if (typeof data === "object") {
    const candidate = data as Record<string, unknown>;
    const message = candidate.content || candidate.message || candidate.response || candidate.answer;
    if (typeof message === "string" && message.trim()) return message;
  }
  return "Respuesta recibida, pero con formato inesperado.";
};

const formatStudentLabel = (student: Student) => {
  const name = `${student.firstName || ""} ${student.lastName || ""}`.trim();
  if (name) return name;
  if (student.documentNumber) return `DNI ${student.documentNumber}`;
  return student.id;
};

export function JustifyChatView() {
  return null;
}