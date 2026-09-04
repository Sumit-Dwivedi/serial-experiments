import { Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Home from "@/pages/Home";
import ViewSecret from "@/pages/ViewSecret";
import AnonymousWall from "@/pages/AnonymousWall";
import HowItWorks from "@/pages/HowItWorks";
import ReceiptStatus from "@/pages/ReceiptStatus";
import Threads from "@/pages/Threads";
import ThreadDetail from "@/pages/ThreadDetail";
import SharePreview from "@/pages/SharePreview";
import Terms from "@/pages/Terms";
import Report from "@/pages/Report";
import BootSequence from "@/components/BootSequence";

// One <Route> per page in src/pages; BrowserRouter already wraps this in main.tsx.
export default function App() {
  return (
    <>
      <BootSequence />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/v/:id" element={<ViewSecret />} />
        <Route path="/r/:token" element={<ReceiptStatus />} />
        <Route path="/threads" element={<Threads />} />
        <Route path="/threads/:id" element={<ThreadDetail />} />
        <Route path="/wall" element={<AnonymousWall />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/share-preview" element={<SharePreview />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/report" element={<Report />} />
        <Route path="*" element={<Home />} />
      </Routes>
      <Toaster position="bottom-right" richColors />
    </>
  );
}
