import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

const App = lazy(() => import("./App"));
const OrderPage = lazy(() => import("./pages/OrderPage"));
const CustomerProfile = lazy(() => import("./pages/CustomerProfile"));

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
          <Route path="/perfil" element={<CustomerProfile />} />
          <Route path="/admin" element={<App />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
import React, { Component, Suspense, lazy } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";

const App = lazy(() => import("./App"));
const OrderPage = lazy(() => import("./pages/OrderPage"));
const CustomerProfile = lazy(() => import("./pages/CustomerProfile"));

class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error("No se pudo cargar esta vista de Sandwichies:", error);
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="route-error" role="alert">
          <div>
            <p className="route-error-eyebrow">Sandwichies</p>
            <h1>No pudimos cargar esta pantalla</h1>
            <p>Comprueba tu conexión e inténtalo de nuevo. Si el problema continúa, vuelve al inicio.</p>
            <div className="route-error-actions">
              <button type="button" onClick={() => window.location.reload()}>Reintentar</button>
              <Link to="/">Ir a la tienda</Link>
            </div>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}

function NotFound() {
  return (
    <main className="route-error" role="status">
      <div>
        <p className="route-error-eyebrow">Sandwichies</p>
        <h1>Esta dirección no existe</h1>
        <p>La página que buscas no está disponible.</p>
        <Link to="/">Volver a la tienda</Link>
      </div>
    </main>
  );
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <RouteErrorBoundary>
        <Suspense
          fallback={
            <main className="route-loading" role="status" aria-live="polite">
              <span className="route-loading-mark" aria-hidden="true">S</span>
              <p>Cargando Sandwichies…</p>
            </main>
          }
        >
          <Routes>
            <Route path="/" element={<OrderPage />} />
            <Route path="/perfil" element={<CustomerProfile />} />
            <Route path="/admin" element={<App />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </RouteErrorBoundary>
    </BrowserRouter>
  );
}
