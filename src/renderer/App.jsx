import { BrowserRouter, Routes, Route } from "react-router-dom";
import IndexPage from "./pages/index.jsx";
import AdminPage from "./pages/admin.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<IndexPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  );
}
