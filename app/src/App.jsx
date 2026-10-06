import { useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "./firebase";
import Dashboard from "./components/Dashboard";
import OrdersHistory from "./components/OrdersHistory";
import OrderModal from "./components/OrderModal";
import Login from "./pages/Login";
import { CATALOG } from "../shared/catalog.js";
import { INVENTORY_TRANSACTION_TYPES } from "../shared/inventory.js";
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
  const [inventoryBalances, setInventoryBalances] = useState([]);
  const [inventoryTransactions, setInventoryTransactions] = useState([]);
  const [inventoryError, setInventoryError] = useState("");
  const [inventorySubmitting, setInventorySubmitting] = useState(false);
  const [inventoryFeedback, setInventoryFeedback] = useState("");
  const [inventoryForm, setInventoryForm] = useState({
    ingredientId:
      CATALOG.ingredients.find((item) => item.active !== false)?.id || "",
    type: "purchase",
    quantityDelta: 1,
    reason: "",
  });
  const knownOrderIds = useRef(new Set());
  const firstSnapshot = useRef(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      const token = currentUser
        ? await currentUser.getIdTokenResult()
        : null;
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

  useEffect(() => {
    if (!user || !isAdmin) return undefined;

    const balancesUnsubscribe = onSnapshot(
      collection(db, "inventoryBalances"),
      (snapshot) => {
        setInventoryBalances(
          snapshot.docs.map((snapshotDoc) => ({
            id: snapshotDoc.id,
            ...snapshotDoc.data(),
          })),
        );
        setInventoryError("");
      },
      (error) => {
        console.error("No se pudo cargar el inventario:", error);
        setInventoryError(
          "No se pudo sincronizar el inventario. Revisa la conexión y los permisos.",
        );
      },
    );

    const transactionsUnsubscribe = onSnapshot(
      collection(db, "inventoryTransactions"),
      (snapshot) => {
        const nextTransactions = snapshot.docs
          .map((snapshotDoc) => ({
            id: snapshotDoc.id,
            ...snapshotDoc.data(),
          }))
          .sort((a, b) => {
            const aDate = a.createdAt?.toDate?.()?.getTime?.() || 0;
            const bDate = b.createdAt?.toDate?.()?.getTime?.() || 0;
            return bDate - aDate;
          });

        setInventoryTransactions(nextTransactions);
      },
      (error) => {
        console.error("No se pudo cargar el historial de inventario:", error);
        setInventoryError(
          "No se pudo cargar el historial de inventario.",
        );
      },
    );

    return () => {
      balancesUnsubscribe();
      transactionsUnsubscribe();
    };
  }, [user, isAdmin]);

  const inventory = useMemo(
    () =>
      CATALOG.ingredients
        .filter((item) => item.active !== false)
        .map((item) => ({
          ...item,
          type: item.type === "protein" ? "Proteína" : "Ingrediente",
        })),
    [],
  );

  const balanceById = useMemo(
    () => new Map(inventoryBalances.map((item) => [item.id, item])),
    [inventoryBalances],
  );

  const saveInventoryMovement = async (event) => {
    event.preventDefault();
    setInventorySubmitting(true);
    setInventoryError("");
    setInventoryFeedback("");

    try {
      const createMovement = httpsCallable(
        getFunctions(),
        "recordInventoryTransaction",
      );
      await createMovement({
        ingredientId: inventoryForm.ingredientId,
        type: inventoryForm.type,
        quantityDelta: Number(inventoryForm.quantityDelta),
        reason: inventoryForm.reason.trim(),
      });

      setInventoryForm((current) => ({
        ...current,
        quantityDelta: 1,
        reason: "",
      }));
      setInventoryFeedback("Movimiento registrado correctamente.");
    } catch (error) {
      console.error("No se pudo registrar el movimiento:", error);
      setInventoryError(
        error?.message ||
          "No se pudo registrar el movimiento de inventario.",
      );
      setInventoryFeedback("");
    } finally {
      setInventorySubmitting(false);
    }
  };

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

      <nav className="admin-tabs" aria-label="Secciones administrativas" role="tablist">
        {[
          ["pedidos", "Pedidos"],
          ["dashboard", "Resumen"],
          ["inventario", "Inventario"],
        ].map(([value, label]) => (
          <button
            role="tab"
            aria-selected={activeTab === value}
            className={activeTab === value ? "active motion-feedback" : "motion-feedback"}
            key={value}
            onClick={() => setActiveTab(value)}
          >
            {label}
          </button>
        ))}
      </nav>

      {ordersError && <div className="admin-alert">{ordersError}</div>}
      {inventoryError && <div className="admin-alert">{inventoryError}</div>}

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
              <p className="admin-eyebrow">Transaccional</p>
              <h2>Inventario</h2>
            </div>
            <p>
              El saldo inicial viene del catálogo. Compras y ajustes generan
              movimientos; los consumos de ventas completadas son automáticos.
            </p>
          </div>

          <form className="inventory-form" onSubmit={saveInventoryMovement}>
            <label>
              Ingrediente
              <select
                value={inventoryForm.ingredientId}
                onChange={(event) =>
                  setInventoryForm((current) => ({
                    ...current,
                    ingredientId: event.target.value,
                  }))
                }
              >
                {inventory.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Movimiento
              <select
                value={inventoryForm.type}
                onChange={(event) =>
                  setInventoryForm((current) => ({
                    ...current,
                    type: event.target.value,
                    quantityDelta:
                      event.target.value === "purchase" ? 1 : current.quantityDelta,
                  }))
                }
              >
                {INVENTORY_TRANSACTION_TYPES.filter(
                  (item) => item.value !== "consumption",
                ).map((item) => (
                  <option value={item.value} key={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Cantidad
              <input
                type="number"
                step="1"
                value={inventoryForm.quantityDelta}
                onChange={(event) =>
                  setInventoryForm((current) => ({
                    ...current,
                    quantityDelta: event.target.value,
                  }))
                }
                required
              />
            </label>
            <label>
              Razón
              <input
                value={inventoryForm.reason}
                onChange={(event) =>
                  setInventoryForm((current) => ({
                    ...current,
                    reason: event.target.value,
                  }))
                }
                placeholder={
                  inventoryForm.type === "purchase"
                    ? "Compra semanal"
                    : "Corrección de conteo"
                }
                required
              />
            </label>
            <button type="submit" className="motion-feedback" disabled={inventorySubmitting}>
              {inventorySubmitting ? "Guardando..." : "Registrar movimiento"}
            </button>
          </form>
          {inventoryFeedback && (
            <div className="admin-feedback success" role="status">
              {inventoryFeedback}
            </div>
          )}

          <div className="inventory-grid">
            {inventory.map((item) => {
              const balance = balanceById.get(item.id);
              const available =
                balance?.quantity ??
                item.stockQuantity ??
                item.packageQuantity ??
                0;
              const portion = item.portionQuantity || 1;
              const maxServings = Math.floor(available / portion);

              const lowStock = maxServings <= 3;

              return (
                <article className={lowStock ? "inventory-card low-stock" : "inventory-card"} key={item.id}>
                  <div className="inventory-card-heading">
                    <small>{item.type}</small>
                    {lowStock && <span className="stock-alert">Stock bajo</span>}
                  </div>
                  <h3>{item.name}</h3>
                  <p>
                    Saldo actual: <strong>{available}</strong> {item.unit}
                  </p>
                  <p>
                    Capacidad aproximada: <strong>{Math.max(0, maxServings)}</strong>
                  </p>
                  <small>
                    Base inicial: {item.stockQuantity ?? item.packageQuantity ?? 0}{" "}
                    {item.unit}
                  </small>
                  <div className="inventory-meter">
                    <span
                      style={{
                        width: `${Math.min(Math.max(maxServings, 0) * 5, 100)}%`,
                      }}
                    />
                  </div>
                </article>
              );
            })}
          </div>

          <article className="inventory-history">
            <div className="admin-section-heading">
              <div>
                <p className="admin-eyebrow">Trazabilidad</p>
                <h3>Últimos movimientos</h3>
              </div>
            </div>
            {!inventoryTransactions.length ? (
              <p className="empty-state">
                Aún no hay movimientos registrados.
              </p>
            ) : (
              <div className="inventory-history-list">
                {inventoryTransactions.slice(0, 20).map((movement) => (
                  <div className="inventory-history-row" key={movement.id}>
                    <div>
                      <strong>{movement.ingredientName}</strong>
                      <small>
                        {movement.type === "purchase"
                          ? "Compra"
                          : movement.type === "consumption"
                            ? "Consumo"
                            : "Ajuste"}
                        {movement.orderId
                          ? ` · Pedido #${movement.orderId}`
                          : ""}
                      </small>
                    </div>
                    <div className="inventory-history-amount">
                      <strong>
                        {movement.quantityDelta > 0 ? "+" : ""}
                        {movement.quantityDelta}
                      </strong>
                      <small>{movement.unit}</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>
      )}

      <OrderModal
        selectedOrder={selectedOrder}
        setSelectedOrder={setSelectedOrder}
      />
    </main>
  );
}
