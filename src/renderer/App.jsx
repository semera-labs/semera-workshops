import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import IndexPage from "./pages/index.jsx";

/*
 * The admin page (data grid, Excel, report generators …) is several MB.
 * Phones only open "/", so it is loaded on demand and never sent to them.
 */
const AdminPage = lazy(() => import("./pages/admin.jsx"));

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<IndexPage />} />
        <Route
          path="/admin"
          element={
            <Suspense fallback={<div style={{ padding: 16 }}>Lade …</div>}>
              <AdminPage />
            </Suspense>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
