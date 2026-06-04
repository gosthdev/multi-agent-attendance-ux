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
  const [sessionId, setSessionId] = useState(() => createSessionId());
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hola, soy el agente de justificacion. Indica el motivo de la inasistencia.",
      createdAt: new Date().toISOString()
    }
  ]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const apiPrefix = useMemo(() => getApiPrefix(), []);

  useEffect(() => {
    const fetchStudents = async () => {
      setStudentsLoading(true);
      setStudentsError(null);
      try {
        const token = requireToken();
        const response = await fetch(`${apiPrefix}/students/own`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText || "Error del servidor"}`);

        const data = await response.json();
        if (!Array.isArray(data)) throw new Error("Formato invalido en estudiantes.");

        setStudents(data);
        if (data.length > 0) setSelectedStudentId(data[0].id || "");
      } catch (err: any) {
        console.error("Students fetch error:", err);
        setStudentsError(err?.message || "Error al cargar estudiantes.");
        setStudents([]);
      } finally {
        setStudentsLoading(false);
      }
    };

    fetchStudents();
  }, [apiPrefix]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  const handleSend = async () => {
    if (!input.trim()) return;
    if (!selectedStudentId) {
      setError("Selecciona un estudiante antes de enviar.");
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
      createdAt: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setError(null);
    setIsSending(true);

    try {
      const token = requireToken();
      const response = await fetch(`${apiPrefix}/astendance/justify/chat`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sessionId,
          studentId: selectedStudentId,
          content: userMessage.content,
          attachments: []
        })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText || "Error del servidor"}`);

      const data = await response.json();
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: extractResponseMessage(data),
        createdAt: new Date().toISOString()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error("Chat error:", err);
      setError(err?.message || "Error al enviar el mensaje al agente.");
    } finally {
      setIsSending(false);
    }
  };

  const resetSession = () => {
    setSessionId(createSessionId());
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "Sesion reiniciada. Continua con el motivo de la inasistencia.",
        createdAt: new Date().toISOString()
      }
    ]);
    setInput("");
    setError(null);
  };

  const handleAttach = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    event.target.value = "";
  };

  return (
    <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden font-sans">
      <CardHeader className="flex flex-col gap-3 border-b border-slate-100">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              Agente de Justificacion
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Envia el motivo de la falta. Los adjuntos se agregaran en una siguiente version.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={resetSession}
            className="h-8 gap-1.5 px-3 border-slate-200 text-slate-700 hover:bg-slate-50 text-xs cursor-pointer">
            <RefreshCw className="h-3.5 w-3.5" />
            Nueva sesion
          </Button>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700">Estudiante</Label>
          <Select
            value={selectedStudentId}
            onValueChange={setSelectedStudentId}
            disabled={studentsLoading || students.length === 0}
          >
            <SelectTrigger className="h-9 border-slate-200 text-slate-950 focus:ring-primary/10 rounded-lg">
              <SelectValue placeholder={studentsLoading ? "Cargando estudiantes..." : "Selecciona un estudiante"} />
            </SelectTrigger>
            <SelectContent>
              {students.map((student) => (
                <SelectItem key={student.id} value={student.id}>
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    <span>{formatStudentLabel(student)}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {studentsError && (
            <div className="flex items-center gap-2 text-xs text-red-600">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>{studentsError}</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="border-b border-slate-100">
          <ScrollArea className="h-[420px] px-6 py-6">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    <p>{message.content}</p>
                    <span
                      className={`mt-2 block text-[10px] ${
                        message.role === "user" ? "text-primary-foreground/70" : "text-slate-400"
                      }`}
                    >
                      {new Date(message.createdAt).toLocaleTimeString("es-ES", {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </span>
                  </div>
                </div>
              ))}
              {isSending && (
                <div className="flex justify-start">
                  <div className="max-w-[70%] rounded-2xl px-4 py-3 text-sm bg-slate-100 text-slate-500">
                    Escribiendo...
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>
        </div>
        <div className="border-t border-slate-100 p-6">
          <div className="relative flex flex-col w-full rounded-3xl border border-slate-200 bg-white shadow-sm focus-within:ring-1 focus-within:ring-primary/30">
            <Textarea
              placeholder="Pregunta cualquier cosa..."
              value={input}
              onChange={(event) => setInput(event.target.value)}
              className="min-h-[56px] w-full resize-none border-0 bg-transparent px-5 py-3 text-base text-slate-950 placeholder:text-slate-400 shadow-none focus-visible:ring-0"
              disabled={isSending}
            />
            <div className="flex items-center justify-between px-3 pb-3">
              <div>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf"
                  multiple
                  onChange={handleAttach}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full text-slate-400 hover:text-slate-900"
                  type="button"
                >
                  <Paperclip className="h-5 w-5" />
                  <span className="sr-only">Adjuntar archivo</span>
                </Button>
              </label>
              </div>
              <Button
                onClick={handleSend}
                disabled={isSending || !input.trim()}
                size="icon"
                className="h-10 w-10 rounded-full bg-slate-900 text-white hover:bg-slate-900/80"
              >
                <ArrowUp className="h-5 w-5" />
                <span className="sr-only">Enviar mensaje</span>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}