import "./index.css";
import "./styles/motion.css";
import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

const App = lazy(() => import("./App"));
const OrderPage = lazy(() => import("./pages/OrderPage"));

function RouteLoading() {
  return (
    <main className="route-loading" role="status" aria-live="polite">
      Cargando Sandwichies…
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Suspense fallback={<RouteLoading />}>
        <Routes>
          <Route path="/" element={<OrderPage />} />
          <Route path="/admin" element={<App />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </React.StrictMode>,
);
