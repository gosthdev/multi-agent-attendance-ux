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
  reasoning?: string;
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

const parseReasoningAndContent = (text: string) => {
  const thinkStart = text.indexOf("<think>");
  if (thinkStart !== -1) {
    const thinkEnd = text.indexOf("</think>", thinkStart);
    if (thinkEnd !== -1) {
      const reasoning = text.substring(thinkStart + 7, thinkEnd);
      const content = text.substring(0, thinkStart) + text.substring(thinkEnd + 8);
      return { reasoning: reasoning.trim(), content: content.trim() };
    } else {
      const reasoning = text.substring(thinkStart + 7);
      const content = text.substring(0, thinkStart);
      return { reasoning: reasoning.trim(), content: content.trim() };
    }
  }
  return { reasoning: "", content: text };
};

const renderMarkdown = (text: string) => {
  if (!text) return "";
  
  // Escape HTML tags to prevent custom injected HTML/XSS, while preserving markdown formatting tags
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Bold **text**
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Italics *text*
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");

  // Bullet points
  const lines = html.split("\n");
  let inList = false;
  const processedLines = lines.map(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const content = trimmed.substring(2);
      if (!inList) {
        inList = true;
        return `<ul class="list-disc pl-5 my-2 space-y-1"><li>${content}</li>`;
      }
      return `<li>${content}</li>`;
    } else {
      if (inList) {
        inList = false;
        return `</ul>\n${line}`;
      }
    }
    return line;
  });
  
  if (inList) {
    processedLines.push("</ul>");
  }
  
  html = processedLines.join("\n");

  // Inline code `code`
  html = html.replace(/`(.*?)`/g, "<code class='bg-slate-100 px-1 py-0.5 rounded font-mono text-xs text-slate-800'>$1</code>");

  // Paragraphs
  const paragraphs = html.split(/\n{2,}/);
  html = paragraphs.map(p => {
    const trimmed = p.trim();
    if (trimmed.startsWith("<ul") || trimmed.endsWith("</ul>")) {
      return trimmed;
    }
    return `<p class="my-2 leading-relaxed">${trimmed.replace(/\n/g, "<br />")}</p>`;
  }).join("");

  return html;
};

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
  const [activeAssistantMessageId, setActiveAssistantMessageId] = useState<string | null>(null);

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

    const assistantMessageId = `assistant-${Date.now()}`;

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

      // Add a placeholder message for the assistant stream
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          role: "assistant",
          content: "",
          reasoning: "",
          createdAt: new Date().toISOString(),
        },
      ]);
      setActiveAssistantMessageId(assistantMessageId);

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;
      let buffer = "";
      
      let currentEventType = "";
      let jsonBuffer = "";
      
      let accumulatedText = "";
      let accumulatedReasoning = "";

      const updateAssistantMessage = (content: string, reasoning: string) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessageId
              ? { ...m, content, reasoning }
              : m
          )
        );
      };

      const handleEventObject = (type: string, dataObj: any) => {
        if (type === "session_created" || dataObj.type === "session_created") {
          const newSessionId = dataObj.sessionId || dataObj.session_id;
          if (newSessionId) setSessionId(newSessionId);
        } else if (type === "status" || dataObj.type === "status") {
          const statusMessage = dataObj.message || dataObj.status;
          if (statusMessage) setAgentStatus(statusMessage);
        } else if (type === "error" || dataObj.type === "error") {
          const errorMessage = dataObj.message || "Error del servidor";
          throw new Error(errorMessage);
        } else if (type === "reasoning") {
          const agentName = dataObj.agent ? dataObj.agent.toUpperCase() : "AGENTE";
          const msg = dataObj.message || "";
          
          let detailsText = "";
          if (dataObj.details && typeof dataObj.details === "object") {
            const d = dataObj.details;
            const detailsList: string[] = [];
            if (d.tipoDocumento) detailsList.push(`• Tipo de Documento: ${d.tipoDocumento}`);
            if (d.fechasAusencia && d.fechasAusencia.length > 0) detailsList.push(`• Fechas de Ausencia: ${d.fechasAusencia.join(", ")}`);
            if (d.numDias) detailsList.push(`• Días: ${d.numDias}`);
            if (d.motivoAusencia) detailsList.push(`• Motivo: ${d.motivoAusencia}`);
            if (d.diagnostico) detailsList.push(`• Diagnóstico: ${d.diagnostico}`);
            if (d.paciente) detailsList.push(`• Paciente: ${d.paciente}`);
            if (d.institucionEmisora) detailsList.push(`• Institución: ${d.institucionEmisora}`);
            if (d.medicoOResponsable) detailsList.push(`• Médico/Responsable: ${d.medicoOResponsable}`);
            if (d.fechaEmision) detailsList.push(`• Fecha de Emisión: ${d.fechaEmision}`);
            if (d.esValido !== undefined) detailsList.push(`• Válido: ${d.esValido ? "SÍ" : "NO"}`);
            if (d.observaciones) detailsList.push(`• Observaciones: "${d.observaciones}"`);
            
            // Format generic keys
            Object.keys(d).forEach(key => {
              const standardKeys = ["tipoDocumento", "fechasAusencia", "numDias", "motivoAusencia", "diagnostico", "paciente", "institucionEmisora", "medicoOResponsable", "fechaEmision", "esValido", "observaciones"];
              if (!standardKeys.includes(key) && d[key] !== null && d[key] !== undefined) {
                const val = typeof d[key] === "object" ? JSON.stringify(d[key]) : d[key];
                detailsList.push(`• ${key}: ${val}`);
              }
            });

            if (detailsList.length > 0) {
              detailsText = "\n" + detailsList.join("\n");
            }
          }
          
          const reasoningChunk = `**${agentName}**\n${msg}${detailsText}\n\n`;
          accumulatedReasoning += reasoningChunk;
        } else if (type === "message") {
          const content = dataObj.content || dataObj.message || dataObj.response || dataObj.answer;
          if (content) {
            accumulatedText = content;
          }
        }
      };

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // Check if the line starts with one of the known event prefixes
            const match = trimmed.match(/^(status|reasoning|message|done|event|data):\s*(.*)$/);
            
            if (match) {
              // If we already have an unparsed block, try to parse it first before starting a new one
              if (currentEventType && jsonBuffer) {
                try {
                  const dataObj = JSON.parse(jsonBuffer.trim());
                  handleEventObject(currentEventType, dataObj);
                } catch (e) {
                  // Not complete, but we matched a new key, so previous was partial or invalid
                  console.error("Discarding incomplete JSON buffer:", jsonBuffer, e);
                }
                jsonBuffer = "";
              }

              const prefix = match[1];
              const rest = match[2];

              if (prefix === "event") {
                currentEventType = rest.trim();
              } else if (prefix === "data") {
                try {
                  const dataObj = JSON.parse(rest.trim());
                  handleEventObject(currentEventType, dataObj);
                } catch {
                  if (currentEventType === "message") {
                    accumulatedText += rest;
                  }
                }
              } else {
                currentEventType = prefix;
                jsonBuffer = rest;
              }
            } else {
              // It's a continuation line for the current JSON block
              if (currentEventType) {
                jsonBuffer += " " + trimmed;
              }
            }

            // Check if jsonBuffer has accumulated a valid JSON object
            if (currentEventType && jsonBuffer && !["event", "data"].includes(currentEventType)) {
              try {
                const dataObj = JSON.parse(jsonBuffer.trim());
                handleEventObject(currentEventType, dataObj);
                currentEventType = "";
                jsonBuffer = "";
              } catch {
                // Not complete yet
              }
            }
          }

          // Parse any <think> tags in the accumulated message text
          const parsed = parseReasoningAndContent(accumulatedText);
          const finalContent = parsed.content;
          const finalReasoning = parsed.reasoning || accumulatedReasoning;

          updateAssistantMessage(finalContent, finalReasoning);
        }
      }

      // Final check for any remaining buffer
      if (currentEventType && jsonBuffer && !["event", "data"].includes(currentEventType)) {
        try {
          const dataObj = JSON.parse(jsonBuffer.trim());
          handleEventObject(currentEventType, dataObj);
          
          const parsed = parseReasoningAndContent(accumulatedText);
          const finalContent = parsed.content;
          const finalReasoning = parsed.reasoning || accumulatedReasoning;

          updateAssistantMessage(finalContent, finalReasoning);
        } catch (e) {
          console.error("Failed to parse final buffer:", e);
        }
      }

      setMessages((prev) => {
        const lastMsg = prev.find((m) => m.id === assistantMessageId);
        if (lastMsg && !lastMsg.content && !lastMsg.reasoning) {
          return prev.map((m) =>
            m.id === assistantMessageId
              ? { ...m, content: "No se recibió una respuesta del agente, o el formato es inesperado." }
              : m
          );
        }
        return prev;
      });
    } catch (err) {
      console.error("Chat error:", err);
      setError(err instanceof Error ? err.message : "Error al enviar el mensaje al agente.");
      // Remove placeholder message if it remains empty on error
      setMessages((prev) => {
        const lastMsg = prev.find((m) => m.id === assistantMessageId);
        if (lastMsg && !lastMsg.content && !lastMsg.reasoning) {
          return prev.filter((m) => m.id !== assistantMessageId);
        }
        return prev;
      });
    } finally {
      setIsSending(false);
      setAgentStatus(null);
      setActiveAssistantMessageId(null);
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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-white text-slate-900 font-sans">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 px-6 py-4 bg-white/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-3 w-full md:max-w-md">
          <div className="w-full">
            <Select
              value={selectedStudentId}
              onValueChange={setSelectedStudentId}
              disabled={studentsLoading || students.length === 0}
            >
              <SelectTrigger className="h-9 border-slate-200 text-slate-900 focus:ring-slate-100 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
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
          </div>
          {studentsError && (
            <div className="flex items-center gap-2 text-xs text-red-600 shrink-0">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>{studentsError}</span>
            </div>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={resetSession}
          className="h-9 gap-1.5 px-4 border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs cursor-pointer shrink-0"
        >
          <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
          Nueva sesión
        </Button>
      </div>

      {/* ── Messages Area ── */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="w-full flex flex-col">
          {messages.map((message) => (
            <div key={message.id} className="w-full">
              {message.role === "assistant" ? (
                <div className="w-full flex items-start gap-4 py-6 px-6 md:px-12 border-b border-slate-100 bg-white">
                  <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center border border-slate-200 shrink-0 select-none">
                    <Bot className="h-4.5 w-4.5 text-slate-500" />
                  </div>
                  <div className="flex-1 space-y-4 min-w-0">
                    {/* 1. Initial State (No content and no reasoning yet) */}
                    {isSending && message.id === activeAssistantMessageId && !message.reasoning && !message.content && (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2.5 text-slate-500 text-[14px]">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span className="font-semibold">{agentStatus || "Analizando solicitud..."}</span>
                        </div>
                        {/* Sleek pulsing skeleton block */}
                        <div className="space-y-2 max-w-lg w-full">
                          <div className="h-3.5 bg-slate-100/80 rounded-lg w-3/4 animate-pulse" />
                          <div className="h-3.5 bg-slate-100/60 rounded-lg w-1/2 animate-pulse" />
                        </div>
                      </div>
                    )}

                    {/* 2. Reasoning block (shown if there is reasoning text) */}
                    {message.reasoning && (
                      <div className="w-full">
                        <details className="group" open={true}>
                          <summary className="flex items-center gap-1.5 text-slate-500 font-semibold cursor-pointer select-none py-1 hover:text-slate-800 transition-colors">
                            <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                              Mostrar razonamiento
                            </span>
                            {/* Spinning loader next to the details title if this is the active stream */}
                            {isSending && message.id === activeAssistantMessageId && (
                              <Loader2 className="h-3 w-3 animate-spin text-slate-400 shrink-0" />
                            )}
                          </summary>
                          <div className="mt-1 pl-4 pr-3 py-3 text-[13px] text-slate-700 leading-relaxed border-l-2 border-slate-300 bg-slate-50/80 rounded-r-xl font-normal">
                            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(message.reasoning) }} />
                            
                            {/* Animated dots under the reasoning content if still thinking */}
                            {isSending && message.id === activeAssistantMessageId && (
                              <div className="flex items-center gap-1.5 mt-3 select-none">
                                <span className="flex items-center gap-1 shrink-0">
                                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]" />
                                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]" />
                                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" />
                                </span>
                                <span className="text-[11px] text-slate-400 italic font-medium">Analizando...</span>
                              </div>
                            )}
                          </div>
                        </details>
                      </div>
                    )}

                    {/* 3. Final Content (or Loading draft message if reasoning is active but content is empty) */}
                    {message.content ? (
                      <div className="relative">
                        <div
                          className="text-[15px] text-slate-900 leading-relaxed w-full"
                          dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
                        />
                        {/* Flashing cursor if actively streaming the final message content */}
                        {isSending && message.id === activeAssistantMessageId && (
                          <span className="inline-block w-1.5 h-4 bg-slate-900 ml-1 rounded-sm animate-pulse align-middle" />
                        )}
                      </div>
                    ) : (
                      /* If reasoning has started, but content is not ready yet, show a clean indicator */
                      isSending && message.id === activeAssistantMessageId && message.reasoning && (
                        <div className="flex items-center gap-2 text-[14px] text-slate-400 select-none mt-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-300" />
                          <span>Generando respuesta...</span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              ) : (
                <div className="w-full py-6 px-6 md:px-12 bg-slate-50/50 border-b border-slate-100 flex flex-col items-end">
                  <div className="flex flex-col items-end max-w-3xl gap-2 w-full">
                    {/* Attachments */}
                    {message.attachments && message.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 justify-end mb-1">
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
                              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-sm max-w-[180px]">
                                <FileText className="h-4.5 w-4.5 text-slate-400 shrink-0" />
                                <span className="text-xs font-medium text-slate-700 truncate">{att.name}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="rounded-2xl px-4 py-2.5 text-[15px] bg-slate-900 text-white shadow-xs max-w-full break-words">
                      {message.content}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          <div ref={bottomRef} className="h-8 shrink-0" />
        </div>
      </div>

      {/* ── Input Composer Area ── */}
      <div className="border-t border-slate-100 bg-white p-4 md:p-6 sticky bottom-0 z-10 shrink-0">
        <div className="max-w-3xl md:max-w-4xl mx-auto">
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
                  className={`relative flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs shadow-sm transition-colors ${
                    f.status === "error"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : f.status === "uploaded"
                      ? "border-green-200 bg-green-50 text-green-800"
                      : "border-slate-200 bg-slate-50 text-slate-700"
                  }`}
                >
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
                    className="shrink-0 rounded-full p-0.5 hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                    title="Quitar archivo"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Chat input box */}
          <div className="relative flex flex-col w-full rounded-2xl border border-slate-200 bg-slate-50 focus-within:bg-white focus-within:border-slate-350 focus-within:ring-2 focus-within:ring-slate-105 transition-all duration-200">
            <Textarea
              placeholder="Escribe el motivo de la inasistencia… (Enter para enviar)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[60px] w-full resize-none border-0 bg-transparent px-4 py-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none"
              disabled={isSending}
            />
            
            <div className="flex items-center justify-between px-3 pb-3">
              <div className="flex items-center gap-2">
                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf"
                  multiple
                  onChange={handleAttach}
                />
                
                {/* Paperclip Button */}
                <button
                  type="button"
                  disabled={isSending}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center h-8 w-8 rounded-full text-slate-500 hover:bg-slate-200/50 hover:text-slate-800 transition-colors cursor-pointer"
                  title="Adjuntar imagen o PDF"
                >
                  <Paperclip className="h-4.5 w-4.5" />
                </button>
              </div>

              {/* Send Button */}
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                className={`flex items-center justify-center h-8 w-8 rounded-full transition-all duration-200 ${
                  canSend 
                    ? "bg-slate-900 text-white hover:bg-slate-800 cursor-pointer" 
                    : "bg-slate-100 text-slate-300 cursor-not-allowed"
                }`}
              >
                {isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUp className="h-4.5 w-4.5" />
                )}
              </button>
            </div>
          </div>

          <p className="mt-2 text-center text-[10px] text-slate-400 select-none">
            Imágenes y PDF · máx. 6 MB · Enter para enviar · Shift+Enter para nueva línea
          </p>
        </div>
      </div>
    </div>
  );
}