"use client";

import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import {
  Bot, Paperclip, ArrowUp, RefreshCw, AlertCircle, Users,
  FileText, X, CheckCircle2, Loader2
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { getApiPrefix } from "@/lib/utils";

// ─── Interfaces ──────────────────────────────────────────────────────────────

interface FileAttachment {
  id: string;
  file: File;
  name: string;
  size: number;
  mimeType: string;
  status: "uploading" | "uploaded" | "error";
  progress: number;
  key?: string;
  errorMsg?: string;
  localUrl?: string;
}

interface SentAttachment {
  name: string;
  mimeType: string;
  localUrl?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  attachments?: SentAttachment[];
}

interface Student {
  id: string;
  firstName?: string;
  lastName?: string;
  documentNumber?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 6 * 1024 * 1024; // 6 MB

// ─── Helpers ─────────────────────────────────────────────────────────────────

const createSessionId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
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
    if (typeof window !== "undefined") window.location.href = "/auth/sign-in";
    throw new Error("No se encontró el token de sesión. Inicia sesión nuevamente.");
  }
  return token;
};

const formatStudentLabel = (student: Student) => {
  const name = `${student.firstName || ""} ${student.lastName || ""}`.trim();
  if (name) return name;
  if (student.documentNumber) return `DNI ${student.documentNumber}`;
  return student.id;
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const isImage = (mimeType: string) => mimeType.startsWith("image/");

// ─── Upload via internal Next.js proxy (avoids browser CORS on R2) ────────────

async function uploadViaProxy(
  putUrl: string,
  file: File,
  contentType: string,
  onProgress: (pct: number) => void,
): Promise<void> {
  // Signal indeterminate start
  onProgress(10);

  const proxyUrl =
    `/api/upload-proxy?putUrl=${encodeURIComponent(putUrl)}&contentType=${encodeURIComponent(contentType)}`;

  const res = await fetch(proxyUrl, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: file,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Upload failed: HTTP ${res.status} – ${text}`);
  }

  onProgress(100);
}

// ─── Component ───────────────────────────────────────────────────────────────

export function JustifyChatView() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(true);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hola, soy el agente de justificación. Indica el motivo de la inasistencia. Puedes adjuntar imágenes o documentos PDF como respaldo.",
      createdAt: new Date().toISOString(),
    },
  ]);
  const [isSending, setIsSending] = useState(false);
  const [agentStatus, setAgentStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<FileAttachment[]>([]);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const apiPrefix = useMemo(() => getApiPrefix(), []);

  // ── Fetch parent's students ────────────────────────────────────────────────

  useEffect(() => {
    const fetchStudents = async () => {
      setStudentsLoading(true);
      setStudentsError(null);
      try {
        const token = requireToken();
        const response = await fetch(`${apiPrefix}/students/own`, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText || "Error del servidor"}`);
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error("Formato inválido en estudiantes.");
        setStudents(data);
        if (data.length > 0) setSelectedStudentId(data[0].id || "");
      } catch (err) {
        console.error("Students fetch error:", err);
        setStudentsError(err instanceof Error ? err.message : "Error al cargar estudiantes.");
        setStudents([]);
      } finally {
        setStudentsLoading(false);
      }
    };
    fetchStudents();
  }, [apiPrefix]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending, pendingFiles]);

  // ── Update file attachment state helper ───────────────────────────────────

  const updateFile = useCallback((id: string, patch: Partial<FileAttachment>) => {
    setPendingFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }, []);

  // ── File picking & uploading ───────────────────────────────────────────────

  const handleAttach = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (!files.length) return;

      // ── Validate ───────────────────────────────────────────────────────────
      const validFiles: File[] = [];
      for (const file of files) {
        const isImg = file.type.startsWith("image/");
        const isPdf = file.type === "application/pdf";

        if (!isImg && !isPdf) {
          toast.error(`"${file.name}" no es un formato aceptado. Solo imágenes y PDF.`);
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`"${file.name}" supera el límite de 6 MB (${formatBytes(file.size)}).`);
          continue;
        }
        validFiles.push(file);
      }
      if (!validFiles.length) return;

      // ── Create local state entries ─────────────────────────────────────────
      const newEntries: FileAttachment[] = validFiles.map((file) => ({
        id: crypto.randomUUID(),
        file,
        name: file.name,
        size: file.size,
        mimeType: file.type,
        status: "uploading",
        progress: 0,
        localUrl: isImage(file.type) ? URL.createObjectURL(file) : undefined,
      }));

      setPendingFiles((prev) => [...prev, ...newEntries]);

      // ── Request presigned PUT URLs from backend ────────────────────────────
      let presignedResults: { key: string; putUrl: string; requiredHeaders: Record<string, string> }[];
      try {
        const token = requireToken();
        const body = {
          studentId: selectedStudentId || undefined,
          files: validFiles.map((f) => ({ filename: f.name, contentType: f.type })),
        };
        const res = await fetch(`${apiPrefix}/attendance/justify/presigned-urls`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          throw new Error(`HTTP ${res.status}: ${errText}`);
        }
        presignedResults = await res.json();
      } catch (err) {
        console.error("Presigned URLs error:", err);
        const msg = err instanceof Error ? err.message : "Error al solicitar URL de subida.";
        toast.error(msg);
        // Mark all newly added files as errored
        setPendingFiles((prev) =>
          prev.map((f) =>
            newEntries.some((e) => e.id === f.id) ? { ...f, status: "error", errorMsg: msg } : f
          )
        );
        return;
      }

      // ── Upload each file directly to Cloudflare R2 ────────────────────────
      await Promise.all(
        newEntries.map(async (entry, idx) => {
          const result = presignedResults[idx];
          if (!result) {
            updateFile(entry.id, { status: "error", errorMsg: "No se recibió URL de subida." });
            return;
          }
          try {
            await uploadViaProxy(
              result.putUrl,
              entry.file,
              result.requiredHeaders?.["Content-Type"] ?? entry.mimeType,
              (pct) => updateFile(entry.id, { progress: pct }),
            );
            updateFile(entry.id, { status: "uploaded", progress: 100, key: result.key });
          } catch (err) {
            console.error(`Upload error for ${entry.name}:`, err);
            const msg = err instanceof Error ? err.message : "Error al subir el archivo.";
            updateFile(entry.id, { status: "error", errorMsg: msg });
            toast.error(`Error subiendo "${entry.name}": ${msg}`);
          }
        })
      );
    },
    [apiPrefix, selectedStudentId, updateFile]
  );

  // ── Remove a pending file ──────────────────────────────────────────────────

  const removeAttachment = useCallback((id: string) => {
    setPendingFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.localUrl) URL.revokeObjectURL(target.localUrl);
      return prev.filter((f) => f.id !== id);
    });
  }, []);

  // ── Send message ──────────────────────────────────────────────────────────

  const handleSend = async () => {
    const hasText = input.trim().length > 0;
    const uploadedFiles = pendingFiles.filter((f) => f.status === "uploaded");
    const uploadingFiles = pendingFiles.filter((f) => f.status === "uploading");

    if (!hasText && uploadedFiles.length === 0) return;
    if (!selectedStudentId) {
      setError("Selecciona un estudiante antes de enviar.");
      return;
    }
    if (uploadingFiles.length > 0) {
      toast.warning("Espera a que todos los archivos terminen de subirse.");
      return;
    }

    const attachmentKeys = uploadedFiles.map((f) => f.key!);
    const sentAttachments: SentAttachment[] = uploadedFiles.map((f) => ({
      name: f.name,
      mimeType: f.mimeType,
      localUrl: f.localUrl,
    }));

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
      createdAt: new Date().toISOString(),
      attachments: sentAttachments.length > 0 ? sentAttachments : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setPendingFiles([]);
    setError(null);
    setIsSending(true);

    try {
      const token = requireToken();

      const requestBody: Record<string, unknown> = {
        studentId: selectedStudentId,
        content: userMessage.content,
      };
      if (sessionId) requestBody.sessionId = sessionId;
      if (attachmentKeys.length > 0) requestBody.attachments = attachmentKeys;

      const response = await fetch(`${apiPrefix}/attendance/justify/chat`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText || "Error del servidor"}`);
      if (!response.body) throw new Error("No hay respuesta del servidor.");

      setAgentStatus("Iniciando...");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;
      let buffer = "";
      let currentEventType = "";
      let assistantContent = "";

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("event:")) {
              currentEventType = line.replace("event:", "").trim();
            } else if (line.startsWith("data:")) {
              const eventData = line.replace("data:", "").trim();

              if (currentEventType === "session_created") {
                try {
                  const sessionData = JSON.parse(eventData);
                  const newSessionId = sessionData.sessionId || sessionData.session_id;
                  if (newSessionId) setSessionId(newSessionId);
                } catch (e) {
                  console.error("Failed to parse session_created data:", e);
                }
              } else if (currentEventType === "status") {
                try {
                  const statusData = JSON.parse(eventData);
                  if (statusData.message) setAgentStatus(statusData.message);
                } catch (e) {
                  console.error("Failed to parse status data:", e);
                }
              } else if (currentEventType === "error") {
                try {
                  const errorObj = JSON.parse(eventData);
                  let errorMessage = errorObj.message || "Error del servidor";
                  if (typeof errorMessage === "string" && errorMessage.includes('{"type":"error"')) {
                    try {
                      const nestedError = JSON.parse(errorMessage);
                      errorMessage = nestedError.error?.message || errorMessage;
                    } catch {
                      errorMessage = errorMessage.split("\n")[0];
                    }
                  }
                  throw new Error(errorMessage);
                } catch {
                  throw new Error(eventData || "Error desconocido del servidor");
                }
              } else if (currentEventType === "message") {
                try {
                  const msgData = JSON.parse(eventData);
                  const content = msgData.content || msgData.message || msgData.response || msgData.answer;
                  if (content) assistantContent = content;
                } catch (e) {
                  console.error("Failed to parse message data:", e);
                }
              }
            }
          }
        }
      }

      if (!assistantContent) {
        assistantContent = "No se recibió una respuesta del agente, o el formato es inesperado.";
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: assistantContent,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      console.error("Chat error:", err);
      setError(err instanceof Error ? err.message : "Error al enviar el mensaje al agente.");
    } finally {
      setIsSending(false);
      setAgentStatus(null);
    }
  };

  // ── Reset session ─────────────────────────────────────────────────────────

  const resetSession = () => {
    // Revoke all object URLs to free memory
    pendingFiles.forEach((f) => { if (f.localUrl) URL.revokeObjectURL(f.localUrl); });
    setPendingFiles([]);
    setSessionId(createSessionId());
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "Sesión reiniciada. Continúa con el motivo de la inasistencia.",
        createdAt: new Date().toISOString(),
      },
    ]);
    setInput("");
    setError(null);
  };

  // ── Key shortcut ──────────────────────────────────────────────────────────

  const isUploading = pendingFiles.some((f) => f.status === "uploading");
  const canSend = !isSending && !isUploading && (input.trim().length > 0 || pendingFiles.some((f) => f.status === "uploaded"));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) {
        handleSend();
      }
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Card className="bg-white border-slate-200 shadow-sm rounded-2xl overflow-hidden font-sans">
      {/* ── Header ── */}
      <CardHeader className="flex flex-col gap-3 border-b border-slate-100">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              Agente de Justificación
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Adjunta imágenes o PDFs (máx. 6 MB) como respaldo de la justificación.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={resetSession}
            className="h-8 gap-1.5 px-3 border-slate-200 text-slate-700 hover:bg-slate-50 text-xs cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Nueva sesión
          </Button>
        </div>

        {/* Student selector */}
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
        {/* ── Messages ── */}
        <div className="border-b border-slate-100">
          <ScrollArea className="h-[420px] px-6 py-6">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"}`}
                >
                  {/* Attachment previews shown above the text bubble */}
                  {message.attachments && message.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-1.5 max-w-[75%] justify-end">
                      {message.attachments.map((att, i) => (
                        <div key={i} className="relative group">
                          {isImage(att.mimeType) && att.localUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={att.localUrl}
                              alt={att.name}
                              className="h-24 w-24 object-cover rounded-xl border border-slate-200 shadow-sm"
                            />
                          ) : (
                            <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 shadow-sm max-w-[160px]">
                              <FileText className="h-5 w-5 text-slate-500 shrink-0" />
                              <span className="text-xs text-slate-700 truncate">{att.name}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Text bubble — only render if there's content */}
                  {message.content && (
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
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  )}
                </div>
              ))}

              {/* Typing indicator */}
              {isSending && (
                <div className="flex justify-start">
                  <div className="max-w-[70%] rounded-2xl px-4 py-3 text-sm bg-slate-100 text-slate-500 flex items-center gap-3">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-500" />
                    </span>
                    {agentStatus || "Escribiendo..."}
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </ScrollArea>
        </div>

        {/* ── Input Area ── */}
        <div className="border-t border-slate-100 p-4">

          {/* Error banner */}
          {error && (
            <div className="mb-3 flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-600">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Pending file chips */}
          {pendingFiles.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {pendingFiles.map((f) => (
                <div
                  key={f.id}
                  className={`relative flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs shadow-sm transition-colors ${
                    f.status === "error"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : f.status === "uploaded"
                      ? "border-green-200 bg-green-50 text-green-800"
                      : "border-slate-200 bg-slate-50 text-slate-700"
                  }`}
                >
                  {/* Thumbnail or icon */}
                  {isImage(f.mimeType) && f.localUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.localUrl} alt={f.name} className="h-8 w-8 rounded-lg object-cover border border-slate-200 shrink-0" />
                  ) : (
                    <div className="h-8 w-8 rounded-lg bg-slate-200 flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4 text-slate-500" />
                    </div>
                  )}

                  <div className="flex flex-col min-w-0 max-w-[120px]">
                    <span className="truncate font-medium text-[11px]">{f.name}</span>
                    <span className="text-[10px] opacity-70">{formatBytes(f.size)}</span>

                    {/* Progress bar */}
                    {f.status === "uploading" && (
                      <div className="mt-1 h-1 w-full rounded-full bg-slate-200 overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-200"
                          style={{ width: `${f.progress}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Status icon */}
                  <div className="shrink-0">
                    {f.status === "uploading" && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
                    {f.status === "uploaded" && <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />}
                    {f.status === "error" && (
                      <span title={f.errorMsg}>
                        <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                      </span>
                    )}
                  </div>

                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => removeAttachment(f.id)}
                    className="shrink-0 rounded-full p-0.5 hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors"
                    title="Quitar archivo"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Composer */}
          <div className="relative flex flex-col w-full rounded-3xl border border-slate-200 bg-white shadow-sm focus-within:ring-1 focus-within:ring-primary/30">
            <Textarea
              placeholder="Escribe el motivo de la inasistencia… (Enter para enviar)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[56px] w-full resize-none border-0 bg-transparent px-5 py-3 text-base text-slate-950 placeholder:text-slate-400 shadow-none focus-visible:ring-0"
              disabled={isSending}
            />
            <div className="flex items-center justify-between px-3 pb-3">
              <div>
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
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
                  disabled={isSending}
                  onClick={() => fileInputRef.current?.click()}
                  title="Adjuntar imagen o PDF"
                >
                  <Paperclip className="h-5 w-5" />
                  <span className="sr-only">Adjuntar archivo</span>
                </Button>
              </div>
              <Button
                onClick={handleSend}
                disabled={!canSend}
                size="icon"
                className="h-10 w-10 rounded-full bg-slate-900 text-white hover:bg-slate-900/80 disabled:opacity-40"
              >
                {isUploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ArrowUp className="h-5 w-5" />
                )}
                <span className="sr-only">Enviar mensaje</span>
              </Button>
            </div>
          </div>

          <p className="mt-2 text-center text-[10px] text-slate-400">
            Imágenes y PDF · máx. 6 MB · Enter para enviar · Shift+Enter para nueva línea
          </p>
        </div>
      </CardContent>
    </Card>
  );
}