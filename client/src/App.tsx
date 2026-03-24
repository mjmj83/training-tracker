import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import TrainingPage from "@/pages/training";
import ChartsPage from "@/pages/charts";
import NotFound from "@/pages/not-found";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";
import { useState } from "react";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={TrainingPage} />
      <Route path="/charts" component={ChartsPage} />
      <Route path="/charts/:exerciseName" component={ChartsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  const [isDark, setIsDark] = useState(() => {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  const toggleTheme = () => {
    setIsDark((d) => {
      const next = !d;
      document.documentElement.classList.toggle("dark", next);
      return next;
    });
  };

  // Set initial dark class
  if (isDark && !document.documentElement.classList.contains("dark")) {
    document.documentElement.classList.add("dark");
  }

  const style = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router hook={useHashLocation}>
          <SidebarProvider style={style as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1 min-w-0">
                <header className="flex items-center justify-between gap-2 px-3 py-2 border-b">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                  <button
                    onClick={toggleTheme}
                    className="p-2 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
                    data-testid="button-theme-toggle"
                  >
                    {isDark ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
                    )}
                  </button>
                </header>
                <main className="flex-1 overflow-auto">
                  <AppRouter />
                </main>
                <PerplexityAttribution />
              </div>
            </div>
          </SidebarProvider>
        </Router>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
