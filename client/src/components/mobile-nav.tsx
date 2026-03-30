import { Link, useLocation } from "wouter";
import { Dumbbell, BarChart3, NotebookPen, Calculator, Menu, Settings, LogOut, Users, Check, Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useSelectedClient } from "@/lib/state";
import { useAuth } from "@/lib/auth";
import { useIsTrainer } from "@/hooks/use-is-trainer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  // Don't show on train-now or login
  if (location.startsWith("/train/")) return null;

  const selectedClient = clients.find(c => c.id === clientId);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border">
      <div className="flex items-center justify-around h-14 px-1" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        {navItems.map(({ href, icon: Icon, label, match }) => {
          const isActive = match(location);
          return (
            <Link key={href} href={href}>
              <button
                className={`flex flex-col items-center justify-center gap-0.5 min-w-[48px] py-1 rounded-lg transition-colors ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
                data-testid={`mobile-nav-${label.toLowerCase()}`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium leading-none">{label}</span>
              </button>
            </Link>
          );
        })}

        {/* More menu */}
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <button
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[48px] py-1 rounded-lg transition-colors ${
                menuOpen || ["/settings", "/admin", "/account"].includes(location) ? "text-primary" : "text-muted-foreground"
              }`}
              data-testid="mobile-nav-menu"
            >
              <Menu className="w-5 h-5" />
              <span className="text-[10px] font-medium leading-none">Meer</span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" side="top" className="w-[220px] p-2 mb-1">
            {/* Client switcher — trainers only */}
            {isTrainer && clients.length > 0 && (
              <div className="mb-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium px-2 mb-1">Klant</p>
                <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
                  {clients.map(client => (
                    <button
                      key={client.id}
                      onClick={() => { setClientId(client.id); setMenuOpen(false); }}
                      className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-sm hover:bg-accent transition-colors text-left"
                      data-testid={`mobile-client-${client.id}`}
                    >
                      <Check className={`w-3.5 h-3.5 shrink-0 ${clientId === client.id ? "opacity-100 text-primary" : "opacity-0"}`} />
                      <span className="flex-1 truncate">{client.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Not a trainer: show current client */}
            {!isTrainer && selectedClient && (
              <div className="px-2 py-1.5 mb-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium mb-0.5">Klant</p>
                <p className="text-sm font-medium">{selectedClient.name}</p>
              </div>
            )}

            <div className="border-t border-border pt-1 space-y-0.5">
              {isTrainer && (
                <Link href="/settings">
                  <button
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-2 w-full rounded px-2 py-1.5 text-sm hover:bg-accent transition-colors ${location === "/settings" ? "text-primary font-medium" : ""}`}
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
                    className={`flex items-center gap-2 w-full rounded px-2 py-1.5 text-sm hover:bg-accent transition-colors ${location === "/admin" ? "text-primary font-medium" : ""}`}
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
                  className={`flex items-center gap-2 w-full rounded px-2 py-1.5 text-sm hover:bg-accent transition-colors ${location === "/account" ? "text-primary font-medium" : ""}`}
                  data-testid="mobile-menu-account"
                >
                  <Users className="w-4 h-4" />
                  Account
                </button>
              </Link>
              <button
                onClick={() => { setMenuOpen(false); logout(); }}
                className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-sm text-destructive hover:bg-accent transition-colors"
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
  );
}
