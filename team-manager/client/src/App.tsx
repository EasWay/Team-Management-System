import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SocketProvider, ConnectionStatus } from "./contexts/SocketContext";
import { TeamProvider } from "./contexts/TeamContext";
import Home from "./pages/Home";
import TeamMembers from "./pages/TeamMembers";
import Teams from "./pages/Teams";
import Tasks from "./pages/Tasks";
import Repositories from "./pages/Repositories";
import Projects from "./pages/Projects";
import Login from "./pages/Login";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/login"} component={Login} />
      <Route path={"/"} component={Home} />
      <Route path={"/team"} component={TeamMembers} />
      <Route path={"/teams"} component={Teams} />
      <Route path={"/tasks"} component={Tasks} />
      <Route path={"/repositories"} component={Repositories} />
      <Route path={"/projects"} component={Projects} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable>
        <SocketProvider>
          <TeamProvider>
            <TooltipProvider>
              <Toaster />
              <ConnectionStatus />
              <Router />
            </TooltipProvider>
          </TeamProvider>
        </SocketProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
