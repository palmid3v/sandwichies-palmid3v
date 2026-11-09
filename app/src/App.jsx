import { useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "./firebase";
import { workerRequest } from "./api/worker";
import Dashboard from "./components/Dashboard";
import OrdersHistory from "./components/OrdersHistory";
import VirtualTables from "./components/VirtualTables";
import OrderModal from "./components/OrderModal";
import Login from "./pages/Login";
import { CATALOG } from "../shared/catalog.js";
import { INVENTORY_TRANSACTION_TYPES } from "../shared/inventory.js";
import { BUSINESS } from "./config/business";
import { getOrderDate, normalizeOrder } from "./utils/orders";
import "./styles/admin.css";

const createInventoryOperationId = () =>
  globalThis.crypto?.randomUUID?.() || `manual-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export default function App() {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [activeTab, setActiveTab] = useState("pedidos");
  const [ordersFocus, setOrdersFocus] = useState(null);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");
  const [inventoryBalances, setInventoryBalances] = useState([]);
  const [inventoryTransactions, setInventoryTransactions] = useState([]);
  const [inventoryError, setInventoryError] = useState("");
  const [inventorySubmitting, setInventorySubmitting] = useState(false);
  const [inventoryOperationId, setInventoryOperationId] = useState(createInventoryOperationId);
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
      try {
        const token = currentUser
          ? await currentUser.getIdTokenResult(true)
          : null;
        const verified = currentUser?.emailVerified === true
          && token?.claims.email_verified === true;
        setIsAdmin(verified && token?.claims.admin === true);
        if (currentUser && !verified) await signOut(auth);
      } catch (error) {
        console.error("No se pudo validar la sesión administrativa:", error);
        setIsAdmin(false);
        if (currentUser) await signOut(auth);
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user || !isAdmin) return undefined;
    setOrdersLoading(true);

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
        setOrdersLoading(false);
      },
      (error) => {
        console.error("No se pudieron cargar los pedidos:", error);
        setOrdersError(
          "No se pudieron sincronizar los pedidos. Revisa la conexión y los permisos.",
        );
        setOrdersLoading(false);
      },
    );

    return unsubscribe;
  }, [user, isAdmin]);

  useEffect(() => {
    if (!user || !isAdmin) return undefined;
    let active = true;
    let refreshing = false;
    let timer;

    const refreshCupboardData = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const [inventoryData, movementData] = await Promise.all([
          workerRequest("/v1/admin/cupboard/inventory", { auth }),
          workerRequest("/v1/admin/cupboard/movements?limit=100", { auth }),
        ]);
        if (!active) return;
        setInventoryBalances((inventoryData.items || []).map((item) => ({
          id: item.ingredientId,
          quantity: item.portions,
          unit: item.unit,
          status: item.status,
          productId: item.productId,
          revision: item.revision,
        })));
        setInventoryTransactions(movementData.movements || []);
        setInventoryError("");
      } catch (error) {
        console.error("No se pudo sincronizar el inventario de Cupboard:", error);
        if (active) setInventoryError(
          error?.message || "No se pudo sincronizar el inventario comercial de Cupboard.",
        );
      } finally {
        refreshing = false;
      }
    };

    refreshCupboardData();
    timer = window.setInterval(refreshCupboardData, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
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
      await workerRequest("/v1/admin/inventory/movements", {
        auth,
        method: "POST",
        body: {
          ingredientId: inventoryForm.ingredientId,
          type: inventoryForm.type,
          quantityDelta: Number(inventoryForm.quantityDelta),
          reason: inventoryForm.reason.trim(),
          operationId: inventoryOperationId,
        },
      });

      setInventoryForm((current) => ({
        ...current,
        quantityDelta: 1,
        reason: "",
      }));
      setInventoryOperationId(createInventoryOperationId());
      setInventoryFeedback("Movimiento registrado en Cupboard.");
      try {
        const [inventoryData, movementData] = await Promise.all([
          workerRequest("/v1/admin/cupboard/inventory", { auth }),
          workerRequest("/v1/admin/cupboard/movements?limit=100", { auth }),
        ]);
        setInventoryBalances((inventoryData.items || []).map((item) => ({
          id: item.ingredientId,
          quantity: item.portions,
          unit: item.unit,
          status: item.status,
          productId: item.productId,
          revision: item.revision,
        })));
        setInventoryTransactions(movementData.movements || []);
        setInventoryError("");
      } catch (refreshError) {
        console.error("El movimiento se guardó, pero no se pudo refrescar la vista:", refreshError);
        setInventoryError("El movimiento quedó registrado en Cupboard. La vista se actualizará al recuperar la conexión.");
      }
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

  const openOrders = (focus) => {
    setOrdersFocus({ ...focus, requestId: globalThis.crypto?.randomUUID?.() || String(Date.now()) });
    setActiveTab("pedidos");
  };

  if (loading) {
    return <div className="admin-loading">Cargando {BUSINESS.name}…</div>;
  }

  if (!user) return <Login />;

  if (!user.emailVerified || !isAdmin) {
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
          ["entregas", "Entregas"],
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

      {ordersError && <div className="admin-alert" role="alert">{ordersError}</div>}
      {inventoryError && <div className="admin-alert" role="alert">{inventoryError}</div>}

      {activeTab === "pedidos" && (
        <OrdersHistory
          key={ordersFocus?.requestId || "default"}
          orders={orders}
          setSelectedOrder={setSelectedOrder}
          initialFilters={ordersFocus}
          loading={ordersLoading}
        />
      )}

      {activeTab === "dashboard" && <Dashboard orders={orders} onOpenOrders={openOrders} />}

      {activeTab === "entregas" && <VirtualTables orders={orders} />}

      {activeTab === "inventario" && (
        <section className="admin-section">
          <div className="admin-section-heading">
            <div>
              <p className="admin-eyebrow">Transaccional</p>
              <h2>Inventario</h2>
            </div>
            <p>
              Cupboard es la fuente real de existencias. Las compras y ajustes
              se sincronizan allí; confirmar un pedido descuenta stock y cancelarlo
              lo repone una sola vez.
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
              const hasLiveBalance = balance?.status === "ok"
                && Number.isFinite(Number(balance.quantity));
              const available = hasLiveBalance ? Number(balance.quantity) : null;
              const unit = balance?.unit || item.unit;
              const portion = item.portionQuantity || 1;
              const maxServings = available === null ? null : Math.floor(available / portion);
              const initialStock = Number(item.stockQuantity ?? item.packageQuantity ?? 0);
              const stockPercent = available !== null && initialStock > 0
                ? (available / initialStock) * 100
                : null;
              const meterWidth = stockPercent === null
                ? 0
                : Math.min(Math.max(stockPercent, 0), 100);
              const lowStock = maxServings !== null && maxServings <= 3;
              const unavailableLabel = balance?.status === "missing"
                ? "Producto no encontrado en Cupboard"
                : balance?.status === "invalid-balance"
                  ? "Saldo inválido en Cupboard"
                  : "Consultando Cupboard";

              return (
                <article className={lowStock ? "inventory-card low-stock" : "inventory-card"} key={item.id}>
                  <div className="inventory-card-heading">
                    <small>{item.type}</small>
                    {lowStock && <span className="stock-alert">Stock bajo</span>}
                  </div>
                  <h3>{item.name}</h3>
                  <p>
                    Saldo actual: <strong>{available === null ? "—" : available}</strong>{" "}
                    {available === null ? "" : unit}
                  </p>
                  <p>
                    Capacidad aproximada: <strong>{maxServings === null ? "—" : Math.max(0, maxServings)}</strong>
                  </p>
                  <small className="inventory-stock-percentage">
                    {stockPercent === null
                      ? unavailableLabel
                      : `Stock actual: ${stockPercent.toFixed(0)}% de la base inicial (${initialStock} ${unit})`}
                  </small>
                  <div
                    className={stockPercent === null ? "inventory-meter is-unavailable" : "inventory-meter"}
                    role="progressbar"
                    aria-label={`Stock de ${item.name} respecto a la base inicial`}
                    aria-valuemin={0}
                    aria-valuemax={Math.max(100, Math.ceil(stockPercent || 0))}
                    aria-valuenow={stockPercent === null ? 0 : Math.round(stockPercent)}
                    aria-valuetext={stockPercent === null ? unavailableLabel : `${stockPercent.toFixed(0)}% de la base inicial`}
                  >
                    <span style={{ width: `${meterWidth}%` }} />
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
                            : movement.type === "reversal"
                              ? "Reversión"
                              : "Ajuste"}
                        {movement.orderId
                          ? ` · Pedido #${movement.orderId}`
                          : ""}
                        {movement.reason ? ` · ${movement.reason}` : ""}
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
