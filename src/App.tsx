import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { initializeNativeApp } from "@/lib/capacitor";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import Teacher from "./pages/Teacher";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import Support from "./pages/Support";
import Documents from "./pages/Documents";
import ProductPPT from "./pages/ProductPPT";
import Backpack from "./pages/Backpack";
import Lottery from "./pages/Lottery";
import LotteryHall from "./pages/LotteryHall";
import GloryCrownLottery from "./pages/GloryCrownLottery";
import OraxBeatsLottery from "./pages/OraxBeatsLottery";
import EventCenter from "./pages/EventCenter";
import HalloweenBattle from "./pages/HalloweenBattle";
import Entertainment from "./pages/Entertainment";
import Roguelike from "./pages/Roguelike";
import TeamBoss from "./pages/TeamBoss";
import Shop from "./pages/Shop";
import SeasonManual from "./pages/SeasonManual";
import SeasonPassManual from "./pages/SeasonPassManual";
import NotFound from "./pages/NotFound";
import { BanScreen } from "@/components/BanScreen";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    initializeNativeApp();
    document.documentElement.classList.add("dark");
    document.documentElement.style.colorScheme = "dark";
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BanScreen />
          <HashRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/callback" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/teacher" element={<Teacher />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/support" element={<Support />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/product-ppt" element={<ProductPPT />} />
              <Route path="/shop" element={<Shop />} />
              <Route path="/backpack" element={<Backpack />} />
              <Route path="/lottery" element={<LotteryHall />} />
              <Route path="/events" element={<EventCenter />} />
              <Route path="/halloween" element={<HalloweenBattle />} />
              <Route path="/entertainment" element={<Entertainment />} />
              <Route path="/roguelike" element={<Roguelike />} />
              <Route path="/team-boss" element={<TeamBoss />} />
              <Route path="/lottery/champions-2024" element={<Lottery />} />
              <Route path="/lottery/glory-crown" element={<GloryCrownLottery />} />
              <Route path="/lottery/orax-beats" element={<OraxBeatsLottery />} />
              <Route path="/season-manual" element={<SeasonManual />} />
              <Route path="/season-pass-manual" element={<SeasonPassManual />} />
              <Route path="*" element={<NotFound />} />

            </Routes>
          </HashRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
