import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "./ui/button";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { LogOut, BarChart, Sun, Moon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useTeamContext } from "@/contexts/TeamContext";

const menuItems = [
  { label: "Home", path: "/" },
  { label: "Tasks", path: "/tasks" },
  { label: "Team Members", path: "/team" },
  { label: "Teams", path: "/teams" },
  { label: "Projects", path: "/projects" },
  { label: "Repositories", path: "/repositories" }
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading, user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { selectedTeamId, teams } = useTeamContext();

  const currentTeamName = teams?.find(t => t.id === selectedTeamId)?.name || 'NO ACTIVE TEAM';

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full liquid-glass-card rounded-2xl">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-display font-semibold tracking-tight text-center text-foreground">
              Sign in to continue
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Access to this dashboard requires authentication.
            </p>
          </div>

          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full font-display"
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background font-display text-foreground antialiased overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-72 flex flex-col border-r border-border px-6 py-8 h-screen sticky top-0 shrink-0">
        <div className="flex items-center gap-4 mb-8">
          <div className="size-10 bg-foreground rounded-full flex items-center justify-center">
            <BarChart className="text-background size-5" />
          </div>
          <div className="overflow-hidden">
            <h1 className="text-lg font-bold tracking-tight text-foreground truncate">{currentTeamName}</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">Workspace</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1 flex-grow overflow-y-auto no-scrollbar -mx-2 px-2 pb-4">
          {menuItems.map((item) => {
            const isActive = location === item.path;
            return (
              <a
                key={item.path}
                onClick={(e) => {
                  e.preventDefault();
                  setLocation(item.path);
                }}
                href={item.path}
                className={`block px-4 py-3 rounded transition-colors cursor-pointer ${isActive
                  ? "bg-foreground/10 text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-foreground/5 font-medium"
                  }`}
              >
                <span className="text-sm">{item.label}</span>
              </a>
            );
          })}
        </nav>

        <div className="mt-auto pt-8 border-t border-border flex flex-col gap-4">
          {/* Theme Toggle */}
          {toggleTheme && (
            <button
              onClick={toggleTheme}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="flex items-center gap-4 px-4 py-3 text-muted-foreground hover:text-foreground hover:bg-foreground/5 rounded transition-colors"
            >
              {theme === "dark" ? (
                <Sun className="size-5" />
              ) : (
                <Moon className="size-5" />
              )}
              <span className="text-sm font-medium">
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </span>
            </button>
          )}

          <button
            onClick={() => logout()}
            className="flex items-center gap-4 px-4 py-3 text-muted-foreground hover:text-foreground hover:bg-foreground/5 rounded transition-colors"
          >
            <LogOut className="size-5" />
            <span className="text-sm font-medium">Sign Out</span>
          </button>

          <div className="flex items-center gap-3 px-4 pt-2">
            <div className="size-8 rounded-full bg-foreground/10 flex items-center justify-center font-bold text-xs uppercase overflow-hidden">
              {user.name?.charAt(0) || user.email?.charAt(0) || "U"}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-foreground">{user.name}</span>
              <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{user.email}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
