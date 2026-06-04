"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Shield,
  GraduationCap,
  Users,
  School,
  BookOpen,
  User,
  CalendarCheck,
  ClipboardList,
  LogOut, 
  Menu, 
  X, 
  Bell, 
  Search, 
  Calendar,
  Sparkles,
  Bot
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface DashboardShellProps {
  user: {
    email?: string;
    given_name?: string;
    family_name?: string;
    name?: string;
    role?: string;
    "cognito:groups"?: string[];
  } | null;
}

export function DashboardShell({ user }: DashboardShellProps) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Group permission mappings for each module
  const moduleAccess: Record<string, string[]> = {
    administracion: ["admin", "teacher"],
    profesores: ["admin"],
    padres: ["admin", "teacher"],
    aulas: ["admin", "teacher"],
    cursos: ["admin", "teacher"],
    estudiantes: ["admin", "teacher", "parent"],
    asistencia: ["admin", "teacher"],
    justificaciones: ["admin", "teacher", "parent"],
    justificar: ["parent"]
  };

  const displayName = user?.name || user?.given_name ? `${user?.given_name || ""} ${user?.family_name || ""}`.trim() : (user?.email?.split("@")[0] || "Usuario");
  const userInitials = displayName.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2);

  const handleLogout = () => {
    // Delete cookie by setting expiration to past
    document.cookie = "id_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Strict; Secure";
    
    // Refresh page and redirect
    router.refresh();
    router.push("/auth/sign-in");
  };

  // Base list of all possible modules
  const menuItems = [
    { id: "administracion", label: "Administración", icon: Shield },
    { id: "profesores", label: "Profesores", icon: GraduationCap },
    { id: "padres", label: "Padres de Familia", icon: Users },
    { id: "aulas", label: "Aulas", icon: School },
    { id: "cursos", label: "Cursos", icon: BookOpen },
    { id: "estudiantes", label: "Estudiantes", icon: User },
    { id: "asistencia", label: "Asistencia", icon: CalendarCheck },
    { id: "justificaciones", label: "Justificaciones", icon: ClipboardList },
    { id: "justificar", label: "Justificar", icon: Bot },
  ];

  // Decode Cognito groups and filter visible items
  const userGroups = user?.["cognito:groups"] || [];
  
  const visibleMenuItems = menuItems.filter(item => {
    const allowedGroups = moduleAccess[item.id] || [];
    return allowedGroups.some(group => userGroups.includes(group));
  });

  // State handles active tab. Defaults to first accessible module, or "asistencia" if user is a teacher.
  const [activeTab, setActiveTab] = useState(() => {
    if (userGroups.includes("teacher") && !userGroups.includes("admin")) {
      const hasAsistencia = visibleMenuItems.some(m => m.id === "asistencia");
      if (hasAsistencia) return "asistencia";
    }
    return visibleMenuItems[0]?.id || "";
  });

  // If user does not belong to any valid groups
  if (visibleMenuItems.length === 0) {
    return (
      <div className="flex h-screen w-full bg-background items-center justify-center text-foreground flex-col gap-5 p-6 text-center font-sans">
        <div className="h-12 w-12 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive mb-2">
          <Shield className="h-6 w-6" />
        </div>
        <div className="space-y-1.5 max-w-sm">
          <h3 className="text-lg font-bold text-foreground">Sin acceso</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Tu cuenta no está asignada a ningún grupo de permisos válido (admin, teacher, parent) en AWS Cognito.
          </p>
        </div>
        <Button onClick={handleLogout} variant="destructive" className="h-9 px-4 rounded-xl cursor-pointer">
          Cerrar Sesión
        </Button>
      </div>
    );
  }

  const activeModule = visibleMenuItems.find(m => m.id === activeTab) || visibleMenuItems[0];

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden text-foreground font-sans">
      {/* SIDEBAR FOR DESKTOP / TABLET (Imposing Dark Navy Block) */}
      <aside 
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col justify-between transition-all duration-300 ease-in-out hidden md:flex`}
      >
        <div className="flex flex-col overflow-y-auto">
          {/* Logo / Header */}
          <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
            <div className="flex items-center gap-3 overflow-hidden">
              {sidebarOpen && (
                <span className="font-bold text-lg text-sidebar-primary whitespace-nowrap">
                  Colegio Narvez
                </span>
              )}
            </div>
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground hover:text-sidebar-primary transition-colors"
            >
              {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>

          {/* Navigation Links (Filtered by Cognito Role) */}
          <nav className="p-3 space-y-1.5 flex-1">
            {visibleMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl transition-all duration-200 text-left group ${
                    isActive 
                      ? "bg-sidebar-accent text-sidebar-primary font-semibold" 
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-primary"
                  }`}
                >
                  <Icon className={`h-5 w-5 shrink-0 ${isActive ? "text-sidebar-primary" : "text-sidebar-foreground/70 group-hover:text-sidebar-primary transition-colors"}`} />
                  {sidebarOpen && <span className="text-sm">{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User profile footer inside dark sidebar */}
        <div className="p-3 border-t border-sidebar-border bg-sidebar/80">
          <div className="flex items-center justify-between gap-3">
            {sidebarOpen ? (
              <div className="flex items-center gap-3 overflow-hidden">
                <Avatar className="h-9 w-9 bg-sidebar-accent text-sidebar-primary ring-1 ring-sidebar-border/20">
                  <AvatarFallback className="bg-transparent font-semibold text-xs">{userInitials}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col overflow-hidden text-left">
                  <span className="text-xs font-semibold text-sidebar-primary truncate">{displayName}</span>
                  <span className="text-[10px] text-sidebar-foreground/75 truncate">{user?.email || "docente@colegio.com"}</span>
                </div>
              </div>
            ) : (
              <div className="mx-auto">
                <Avatar className="h-9 w-9 bg-sidebar-accent text-sidebar-primary ring-1 ring-sidebar-border/20">
                  <AvatarFallback className="bg-transparent font-semibold text-xs">{userInitials}</AvatarFallback>
                </Avatar>
              </div>
            )}
            
            {sidebarOpen && (
              <button 
                onClick={handleLogout}
                title="Cerrar Sesión"
                className="p-2 rounded-xl hover:bg-red-500/10 text-sidebar-foreground hover:text-red-400 transition-colors"
              >
                <LogOut className="h-4.5 w-4.5" />
              </button>
            )}
          </div>
          {!sidebarOpen && (
            <button 
              onClick={handleLogout}
              title="Cerrar Sesión"
              className="mt-3 w-full flex items-center justify-center p-2 rounded-xl hover:bg-red-500/10 text-sidebar-foreground hover:text-red-400 transition-colors"
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          )}
        </div>
      </aside>

      {/* MAIN CONTAINER (Pure White Area) */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* TOP BAR (Muted secondary gray header with fine border) */}
        <header className="h-16 border-b border-border bg-muted/80 backdrop-blur-md flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold text-foreground md:hidden">
              Colegio Narvez
            </h1>
            <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground/80" />
              <span>{new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Search Input (White BG, fine border) */}
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/80" />
              <input 
                type="text" 
                placeholder="Buscar..." 
                className="bg-background border border-border rounded-xl pl-9 pr-4 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/30 transition-colors w-56"
              />
            </div>

            {/* Notification Bell */}
            <button className="relative p-2 rounded-xl hover:bg-muted-foreground/10 text-muted-foreground hover:text-foreground transition-colors">
              <Bell className="h-4.5 w-4.5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary ring-2 ring-muted" />
            </button>

            {/* Mobile Logout (direct access) */}
            <button 
              onClick={handleLogout}
              className="md:hidden p-2 rounded-xl hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
            >
              <LogOut className="h-4.5 w-4.5" />
            </button>
          </div>
        </header>

        {/* WORKSPACE CONTENT AREA (Light backgrounds) */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-background">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Header description */}
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-bold tracking-tight text-foreground capitalize">
                {activeModule.label}
              </h2>
              <p className="text-sm text-muted-foreground">
                Panel de control y visualización de {activeModule.label.toLowerCase()}
              </p>
            </div>

            {/* Content box (White Card with border-border) */}
            <div className="bg-card border border-border rounded-2xl p-8 min-h-[300px] flex items-center justify-center text-muted-foreground border-dashed">
              Módulo de {activeModule.label.toLowerCase()} en desarrollo
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
