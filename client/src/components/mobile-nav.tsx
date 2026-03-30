import { Link, useLocation } from "wouter";
import { Dumbbell, BarChart3, NotebookPen, Calculator } from "lucide-react";

const navItems = [
  { href: "/", icon: Dumbbell, label: "Training", match: (l: string) => l === "/" },
  { href: "/charts", icon: BarChart3, label: "Charts", match: (l: string) => l.startsWith("/charts") },
  { href: "/notes", icon: NotebookPen, label: "Notities", match: (l: string) => l === "/notes" },
  { href: "/abc", icon: Calculator, label: "Body", match: (l: string) => l === "/abc" },
];

export default function MobileNav() {
  const [location] = useLocation();

  // Don't show on train-now or login
  if (location.startsWith("/train/")) return null;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border">
      <div className="flex items-center justify-around h-14 px-2" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        {navItems.map(({ href, icon: Icon, label, match }) => {
          const isActive = match(location);
          return (
            <Link key={href} href={href}>
              <button
                className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-1 rounded-lg transition-colors ${
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
      </div>
    </nav>
  );
}
