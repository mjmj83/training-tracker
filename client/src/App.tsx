import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import TrainingPage from "@/pages/training";
import ChartsPage from "@/pages/charts";
import NotesPage from "@/pages/notes";
import SettingsPage from "@/pages/settings";
import AbcPage from "@/pages/abc";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import AdminPage from "@/pages/admin";
import AccountPage from "@/pages/account";
import TrainNowPage from "@/pages/train-now";
import MobileNav from "@/components/mobile-nav";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useIsTrainer } from "@/hooks/use-is-trainer";
import { Redirect, useLocation } from "wouter";

/** Renders Train Now fullscreen (no sidebar) or the normal app shell */
function TrainNowRouter({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  if (location.startsWith("/train/")) {
    return <TrainNowPage />;
  }
  return <>{children}</>;
}

function ProtectedSettingsPage() {
  const isTrainer = useIsTrainer();
  if (!isTrainer) return <Redirect to="/" />;
  return <SettingsPage />;
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={TrainingPage} />
      <Route path="/notes" component={NotesPage} />
      <Route path="/settings" component={ProtectedSettingsPage} />
      <Route path="/abc" component={AbcPage} />
      <Route path="/charts" component={ChartsPage} />
      <Route path="/charts/:exerciseName" component={ChartsPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/account" component={AccountPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedApp() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground text-sm">Laden...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const style = {
    "--sidebar-width": "15rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <Router hook={useHashLocation}>
      <TrainNowRouter>
        <SidebarProvider style={style as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <div className="flex flex-col flex-1 min-w-0">
              <main className="flex-1 overflow-auto pb-[4.5rem] md:pb-0">
                <AppRouter />
              </main>
              <div className="hidden md:block">
                <PerplexityAttribution />
              </div>
            </div>
          </div>
          <MobileNav />
        </SidebarProvider>
      </TrainNowRouter>
    </Router>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AuthenticatedApp />
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
