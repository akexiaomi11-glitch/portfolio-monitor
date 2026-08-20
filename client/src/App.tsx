import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import Attention from "@/pages/Attention";
import ProvidentFund from "@/pages/ProvidentFund";
import PriceHistory from "@/pages/PriceHistory";
import FundCompare from "@/pages/FundCompare";
import SiamchartLaunchpad from "@/pages/SiamchartLaunchpad";
import Bonds from "@/pages/Bonds";
import Overview from "@/pages/Overview";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import PasswordGate from "./components/PasswordGate";
import { ThemeProvider } from "./contexts/ThemeContext";
import Stocks from "./pages/Stocks";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Overview} />
      <Route path={"/stocks"} component={Stocks} />
      <Route path={"/attention"} component={Attention} />
      <Route path={"/provident-fund"} component={ProvidentFund} />
      <Route path={"/bonds"} component={Bonds} />
      <Route path={"/price-history"} component={PriceHistory} />
      <Route path={"/compare"} component={FundCompare} />
      <Route path={"/siamchart"} component={SiamchartLaunchpad} />
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
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <PasswordGate>
            <Router />
          </PasswordGate>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
