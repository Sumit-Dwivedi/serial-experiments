import { Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Home from "@/pages/Home";
import ViewSecret from "@/pages/ViewSecret";
import AnonymousWall from "@/pages/AnonymousWall";
import HowItWorks from "@/pages/HowItWorks";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/v/:id" element={<ViewSecret />} />
        <Route path="/wall" element={<AnonymousWall />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="*" element={<Home />} />
      </Routes>
      <Toaster position="bottom-right" richColors />
    </>
  );
}
