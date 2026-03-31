import { Link, useLocation } from "wouter";
import { Dumbbell, BarChart3, NotebookPen, Calculator, Menu, Settings, LogOut, Users, Check, Shield, ChevronRight, Download, Palette, ClipboardList } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useSelectedClient, useSelectedMonth } from "@/lib/state";
import { useAuth } from "@/lib/auth";
import { useIsTrainer } from "@/hooks/use-is-trainer";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ThemePicker from "@/components/theme-picker";
import OverviewDialog from "@/components/overview-dialog";
import { useState } from "react";
import type { Client } from "@shared/schema";

const navItems = [
  { href: "/", icon: Dumbbell, label: "Training", match: (l: string) => l === "/" },
  { href: "/charts", icon: BarChart3, label: "Charts", match: (l: string) => l.startsWith("/charts") },
  { href: "/notes", icon: NotebookPen, label: "Notities", match: (l: string) => l === "/notes" },
  { href: "/abc", icon: Calculator, label: "Body", match: (l: string) => l === "/abc" },
];

export default function MobileNav() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const isTrainer = useIsTrainer();
  const { clientId, setClientId } = useSelectedClient();
  const { monthId } = useSelectedMonth();
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [clientDialogOpen, setClientDialogOpen] = useState(false);
  const [showOverview, setShowOverview] = useState(false);

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Don't show on train-now or login
  if (location.startsWith("/train/")) return null;

  const selectedClient = clients.find(c => c.id === clientId);

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border">
        <div className="flex items-center justify-around px-1 pb-[env(safe-area-inset-bottom,0px)]" style={{ height: "calc(2.75rem + env(safe-area-inset-bottom, 0px))" }}>
          {navItems.map(({ href, icon: Icon, label, match }) => {
            const isActive = match(location);
            return (
              <Link key={href} href={href}>
                <button
                  className={`flex flex-col items-center justify-center gap-0 min-w-[48px] py-1 rounded-lg transition-colors ${
                    isActive ? "text-primary" : "text-muted-foreground"
                  }`}
                  data-testid={`mobile-nav-${label.toLowerCase()}`}
                >
                  <Icon className="w-[18px] h-[18px]" />
                  <span className="text-[9px] font-medium leading-none">{label}</span>
                </button>
              </Link>
            );
          })}

          {/* More menu */}
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <button
                className={`flex flex-col items-center justify-center gap-0 min-w-[48px] py-1 rounded-lg transition-colors ${
                  menuOpen || ["/settings", "/admin", "/account"].includes(location) ? "text-primary" : "text-muted-foreground"
                }`}
                data-testid="mobile-nav-menu"
              >
                <Menu className="w-[18px] h-[18px]" />
                <span className="text-[9px] font-medium leading-none">Meer</span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" side="top" sideOffset={8} className="w-[240px] p-1.5">
              {/* Current client + change button */}
              {isTrainer && (
                <button
                  onClick={() => { setMenuOpen(false); setClientDialogOpen(true); }}
                  className="flex items-center gap-2 w-full rounded-md px-2.5 py-2 text-left hover:bg-accent transition-colors"
                  data-testid="mobile-menu-switch-client"
                >
                  <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground/60 leading-none">Klant</p>
                    <p className="text-sm font-medium truncate">{selectedClient?.name ?? "Geen klant"}</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                </button>
              )}

              {!isTrainer && selectedClient && (
                <div className="px-2.5 py-2">
                  <p className="text-[10px] text-muted-foreground/60 leading-none">Klant</p>
                  <p className="text-sm font-medium">{selectedClient.name}</p>
                </div>
              )}

              {/* Quick actions */}
              <div className="border-t border-border mt-1 pt-1 space-y-0.5">
                <button
                  onClick={() => { setMenuOpen(false); setShowOverview(true); }}
                  className="flex items-center gap-2.5 w-full rounded-md px-2.5 py-2 text-sm hover:bg-accent transition-colors"
                  data-testid="mobile-menu-overview"
                >
                  <ClipboardList className="w-4 h-4" />
                  Overzicht
                </button>
                <button
                  onClick={async () => {
                    setMenuOpen(false);
                    try {
                      const res = await apiRequest("GET", `/api/clients/${clientId}/export`);
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      const disposition = res.headers.get("content-disposition");
                      const match = disposition?.match(/filename="(.+)"/);
                      a.download = match?.[1] || "Training Export.xlsx";
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch { toast({ title: "Fout", description: "Export mislukt", variant: "destructive" }); }
                  }}
                  className="flex items-center gap-2.5 w-full rounded-md px-2.5 py-2 text-sm hover:bg-accent transition-colors"
                  data-testid="mobile-menu-export"
                >
                  <Download className="w-4 h-4" />
                  Exporteren
                </button>
                <div className="flex items-center gap-2.5 w-full rounded-md px-2.5 py-2">
                  <Palette className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm flex-1">Thema</span>
                  <ThemePicker />
                </div>
              </div>

              {/* Navigation */}
              <div className="border-t border-border mt-1 pt-1 space-y-0.5">
                {isTrainer && (
                  <Link href="/settings">
                    <button
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center gap-2.5 w-full rounded-md px-2.5 py-2 text-sm hover:bg-accent transition-colors ${location === "/settings" ? "text-primary font-medium" : ""}`}
                      data-testid="mobile-menu-settings"
                    >
                      <Settings className="w-4 h-4" />
                      Instellingen
                    </button>
                  </Link>
                )}
                {user?.email === "mariusjansen@gmail.com" && (
                  <Link href="/admin">
                    <button
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center gap-2.5 w-full rounded-md px-2.5 py-2 text-sm hover:bg-accent transition-colors ${location === "/admin" ? "text-primary font-medium" : ""}`}
                      data-testid="mobile-menu-admin"
                    >
                      <Shield className="w-4 h-4" />
                      Admin
                    </button>
                  </Link>
                )}
                <Link href="/account">
                  <button
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-2.5 w-full rounded-md px-2.5 py-2 text-sm hover:bg-accent transition-colors ${location === "/account" ? "text-primary font-medium" : ""}`}
                    data-testid="mobile-menu-account"
                  >
                    <Users className="w-4 h-4" />
                    Account
                  </button>
                </Link>
                <button
                  onClick={() => { setMenuOpen(false); logout(); }}
                  className="flex items-center gap-2.5 w-full rounded-md px-2.5 py-2 text-sm text-destructive hover:bg-accent transition-colors"
                  data-testid="mobile-menu-logout"
                >
                  <LogOut className="w-4 h-4" />
                  Uitloggen
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </nav>

      {/* Client picker dialog */}
      {isTrainer && (
        <Dialog open={clientDialogOpen} onOpenChange={setClientDialogOpen}>
          <DialogContent className="sm:max-w-[320px]">
            <DialogHeader>
              <DialogTitle className="text-sm">Kies klant</DialogTitle>
            </DialogHeader>
            <div className="space-y-1 max-h-[60vh] overflow-y-auto -mx-2 px-2">
              {clients.map(client => (
                <button
                  key={client.id}
                  onClick={() => { setClientId(client.id); setClientDialogOpen(false); }}
                  className="flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-left hover:bg-accent transition-colors"
                  data-testid={`mobile-client-dialog-${client.id}`}
                >
                  <Check className={`w-4 h-4 shrink-0 ${clientId === client.id ? "opacity-100 text-primary" : "opacity-0"}`} />
                  <span className="flex-1 text-sm font-medium">{client.name}</span>
                  <span className="text-[10px] text-muted-foreground/60">
                    {client.gender === "male" ? "M" : "V"}
                  </span>
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Overview dialog */}
      <OverviewDialog open={showOverview} onOpenChange={setShowOverview} monthId={monthId} />
    </>
  );
}
