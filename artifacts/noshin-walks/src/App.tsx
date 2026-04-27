import { useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Home } from "@/pages/Home";
import { WalkingGame } from "@/components/WalkingGame";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function NoshinHome() {
  return <Home mode="noshin" />;
}

function NabilHome() {
  return <Home mode="nabil" />;
}

function NoshinWalk() {
  const [, setLocation] = useLocation();
  return <WalkingGame mode="noshin" onExit={() => setLocation("/")} />;
}

function NabilWalk() {
  const [, setLocation] = useLocation();
  return <WalkingGame mode="nabil" onExit={() => setLocation("/nabil")} />;
}

function TogetherWalk() {
  // determine which side launched the together walk by referrer-like state
  const [side, setSide] = useState<"noshin" | "nabil">("noshin");
  const [, setLocation] = useLocation();
  useEffect(() => {
    const last = sessionStorage.getItem("noshin.lastHome");
    if (last === "nabil") setSide("nabil");
  }, []);
  return (
    <WalkingGame
      mode={side}
      onExit={() => setLocation(side === "noshin" ? "/" : "/nabil")}
    />
  );
}

function RememberSide() {
  const [location] = useLocation();
  useEffect(() => {
    if (location === "/" ) sessionStorage.setItem("noshin.lastHome", "noshin");
    if (location === "/nabil") sessionStorage.setItem("noshin.lastHome", "nabil");
  }, [location]);
  return null;
}

function Router() {
  return (
    <>
      <RememberSide />
      <Switch>
        <Route path="/" component={NoshinHome} />
        <Route path="/walk" component={NoshinWalk} />
        <Route path="/nabil" component={NabilHome} />
        <Route path="/nabil/walk" component={NabilWalk} />
        <Route path="/together" component={TogetherWalk} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        <Router />
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
