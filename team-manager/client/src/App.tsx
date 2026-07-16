import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
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
import Messages from "./pages/Messages";
import Workspace from "./pages/Workspace";
import DecisionTable from "./pages/DecisionTable";
import Evaluation from "./pages/Evaluation";
import Analytics from "./pages/Analytics";
import FileManager from "./pages/FileManager";
import Calendar from "./pages/Calendar";
import VideoCalls from "./pages/VideoCalls";
import Notifications from "./pages/Notifications";
import { tokenStorage } from "./lib/tokenStorage";
import Landing from "./pages/Landing";
import Register from "./pages/Register";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import Admin from "./pages/Admin";
import AcceptInvite from "./pages/AcceptInvite";

// Routes that always show the public/marketing experience and should stay
// mobile-responsive, regardless of auth state.
const PUBLIC_ONLY_PATHS = ["/login", "/register", "/privacy", "/terms"];

function Router() {
  const [location] = useLocation();
  const isAppRoute = !!tokenStorage.getAccessToken() && !PUBLIC_ONLY_PATHS.includes(location);

  // Force desktop layout on phones while inside the authenticated app, and
  // only there — this only re-runs when crossing the public/app boundary,
  // not on every in-app navigation (DashboardLayout remounts per page, so
  // toggling this per-component there caused visible thrashing/lag).
  useEffect(() => {
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (isAppRoute) {
      viewportMeta?.setAttribute('content', 'width=1280');
      document.documentElement.classList.add('force-desktop');
    } else {
      viewportMeta?.setAttribute('content', 'width=device-width, initial-scale=1.0');
      document.documentElement.classList.remove('force-desktop');
    }
  }, [isAppRoute]);

  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"}>
        {() => (tokenStorage.getAccessToken() ? <Home /> : <Landing />)}
      </Route>
      <Route path={"/login"} component={Landing} />
      <Route path={"/register"} component={Register} />
      <Route path={"/privacy"} component={PrivacyPolicy} />
      <Route path={"/terms"} component={TermsOfService} />
      <Route path={"/team"} component={TeamMembers} />
      <Route path={"/teams"} component={Teams} />
      <Route path={"/tasks"} component={Tasks} />
      <Route path={"/repositories"} component={Repositories} />
      <Route path={"/projects"} component={Projects} />
      <Route path={"/messages"} component={Messages} />
      <Route path={"/workspace"} component={Workspace} />
      <Route path={"/office"} component={Workspace} />
      <Route path={"/conference-room"} component={DecisionTable} />
      <Route path={"/decision-table"} component={DecisionTable} />
      <Route path={"/evaluation"} component={Evaluation} />
      <Route path={"/qa-office"} component={Evaluation} />
      <Route path={"/analytics"} component={Analytics} />
      <Route path={"/files"} component={FileManager} />
      <Route path={"/calendar"} component={Calendar} />
      <Route path={"/video-calls"} component={VideoCalls} />
      <Route path={"/notifications"} component={Notifications} />
      <Route path={"/accept-invite"} component={AcceptInvite} />
      <Route path={"/admin"} component={Admin} />
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
