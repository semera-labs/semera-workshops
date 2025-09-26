import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/index";
import Admin from "./pages/admin";

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/admin" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}
