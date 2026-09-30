import { useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "./firebase";
import Dashboard from "./components/Dashboard";
import OrdersHistory from "./components/OrdersHistory";
import OrderModal from "./components/OrderModal";
import Login from "./pages/Login";
import { CATALOG } from "../shared/catalog.js";
import { calculateInventoryConsumption } from "./utils/pricing";
import { BUSINESS } from "./config/business";
import { getOrderDate, normalizeOrder } from "./utils/orders";
import "./styles/admin.css";

export default function App() {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [activeTab, setActiveTab] = useState("pedidos");
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");
  const knownOrderIds = useRef(new Set());
  const firstSnapshot = useRef(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      const token = currentUser ? await currentUser.getIdTokenResult() : null;
      setIsAdmin(token?.claims.admin === true);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user || !isAdmin) return undefined;

    const unsubscribe = onSnapshot(
      collection(db, "orders"),
      (snapshot) => {
        const nextOrders = snapshot.docs
          .map((snapshotDoc) =>
            normalizeOrder({ id: snapshotDoc.id, ...snapshotDoc.data() }),
          )
          .sort((a, b) => {
            const aDate = getOrderDate(a)?.getTime() || 0;
            const bDate = getOrderDate(b)?.getTime() || 0;
            return bDate - aDate;
          });

        if (!firstSnapshot.current) {
          const hasNewOrder = nextOrders.some(
            (order) => !knownOrderIds.current.has(order.id),
          );
          if (hasNewOrder) {
            new Audio("/bell.mp3").play().catch(() => undefined);
          }
        }

        knownOrderIds.current = new Set(nextOrders.map((order) => order.id));
        firstSnapshot.current = false;
        setOrders(nextOrders);
        setOrdersError("");
      },
      (error) => {
        console.error("No se pudieron cargar los pedidos:", error);
        setOrdersError(
          "No se pudieron sincronizar los pedidos. Revisa la conexión y los permisos.",
        );
      },
    );

    return unsubscribe;
  }, [user, isAdmin]);

  const inventory = useMemo(
    () => [
      ...CATALOG.ingredients.filter((item) => item.type === "protein").map((item) => ({
        ...item,
        type: "Proteína",
      })),
      ...CATALOG.toppings.map((item) => ({
        ...CATALOG.ingredients.find((ingredient) => ingredient.id === item.ingredientId),
        ...item,
        type: "Topping",
      })),
      ...CATALOG.ingredients.filter((item) => item.type === "extra").map((item) => ({ ...item, type: "Extra" })),
    ],
    [],
  );

  if (loading) {
    return <div className="admin-loading">Cargando {BUSINESS.name}…</div>;
  }

  if (!user) return <Login />;

  if (!isAdmin) {
    return (
      <main className="login-page">
        <section className="login-card">
          <p className="admin-eyebrow">Acceso restringido</p>
          <h1>{BUSINESS.name}</h1>
          <p>Esta cuenta no tiene el rol de administración requerido.</p>
          <button onClick={() => signOut(auth)}>Cerrar sesión</button>
        </section>
      </main>
    );
  }

  const recordedConsumption = calculateInventoryConsumption(
    orders.filter((order) => order.status !== "cancelado").flatMap((order) => order.items || []),
  );

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">Centro de operaciones</p>
          <h1>{BUSINESS.name}</h1>
        </div>
        <div className="admin-account">
          <span>{user.email}</span>
          <button onClick={() => signOut(auth)}>Cerrar sesión</button>
        </div>
      </header>

      <nav className="admin-tabs" aria-label="Secciones administrativas">
        {[
          ["pedidos", "Pedidos"],
          ["dashboard", "Resumen"],
          ["inventario", "Inventario"],
        ].map(([value, label]) => (
          <button
            className={activeTab === value ? "active" : ""}
            key={value}
            onClick={() => setActiveTab(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      {ordersError && <div className="admin-alert">{ordersError}</div>}

      {activeTab === "pedidos" && (
        <OrdersHistory
          orders={orders}
          setSelectedOrder={setSelectedOrder}
        />
      )}

      {activeTab === "dashboard" && <Dashboard orders={orders} />}

      {activeTab === "inventario" && (
        <section className="admin-section">
          <div className="admin-section-heading">
            <div>
              <p className="admin-eyebrow">Capacidad estimada</p>
              <h2>Inventario base</h2>
            </div>
            <p>
              Este cálculo usa las cantidades configuradas. El siguiente paso
              es registrar compras y consumos reales.
            </p>
          </div>
          <div className="inventory-grid">
            {inventory.map((item) => {
              const available = item.stockQuantity || item.packageQuantity || 0;
              const consumed = recordedConsumption[item.id] || 0;
              const portion = item.portionQuantity || 1;
              const maxServings = Math.max(0, Math.floor((available - consumed) / portion));
              return (
                <article className="inventory-card" key={item.name}>
                  <small>{item.type}</small>
                  <h3>{item.name}</h3>
                  <p>
                    Capacidad estimada: <strong>{maxServings}</strong>
                  </p>
                  <small>Consumo registrado: {consumed} {item.unit}</small>
                  <div className="inventory-meter">
                    <span style={{ width: `${Math.min(maxServings * 5, 100)}%` }} />
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <OrderModal
        selectedOrder={selectedOrder}
        setSelectedOrder={setSelectedOrder}
      />
    </main>
  );
}
