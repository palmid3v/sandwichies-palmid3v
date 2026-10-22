import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

const App = lazy(() => import("./App"));
const OrderPage = lazy(() => import("./pages/OrderPage"));

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Suspense
        fallback={
          <main className="route-loading" role="status" aria-live="polite">
            Cargando Sandwichies…
          </main>
        }
      >
        <Routes>
          <Route path="/" element={<OrderPage />} />
          <Route path="/admin" element={<App />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
