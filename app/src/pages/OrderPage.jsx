import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, signOut, updateProfile } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase";
import CustomerAuth from "./CustomerAuth";
import CustomerOrders from "../components/CustomerOrders";
import { workerRequest } from "../api/worker";
import { getCustomerCart, saveCustomerCart } from "../api/customer-cart";
import Category from "../components/Category";
import { generateName } from "../utils/generateName";
import { INGREDIENTS } from "../data/ingredients";
import {
  calculateLineItem,
  calculateOrderTotals,
} from "../utils/pricing";
import DiscoverySection from "../components/DiscoverySection";
import { normalizeColombianPhone } from "../../shared/phone.js";
import { DELIVERY_COVERAGE } from "../../shared/delivery-coverage.js";
import {
  BUSINESS,
  PAYMENT_METHODS,
  formatMoney,
} from "../config/business";
import "../styles/storefront.css";
import "../styles/creative-refresh.css";
import "../styles/menu-world.css";
import "../styles/charcuteria-club.css";

const DEFAULT_BASE = [
  "Lechuga",
  "Cebolla",
];

const MeetingPointPicker = lazy(() => import("../components/MeetingPointPicker"));
const newRequestId = () => globalThis.crypto.randomUUID();
const DELIVERY_STATUS_LABELS = {
  waiting_customer: "Esperando al cliente",
  customer_ready: "Ya llegaste al punto",
  en_route: "En camino",
  arrived: "En el punto de encuentro",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

export default function OrderPage() {
  const [size, setSize] = useState("15");
  const [proteins, setProteins] = useState([]);
  const [toppings, setToppings] = useState([]);
  const [extras, setExtras] = useState([]);
  const [baseIngredients, setBaseIngredients] = useState(DEFAULT_BASE);
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [favoriteId, setFavoriteId] = useState(null);
  const [cart, setCart] = useState([]);
  const [cartReady, setCartReady] = useState(false);
  const [cartSyncState, setCartSyncState] = useState("loading");
  const [cartConflict, setCartConflict] = useState(false);
  const cartSyncTimer = useRef(null);
  const cartRevisionRef = useRef(0);
  const skipInitialCartSync = useRef(true);

  const [clientName, setClientName] = useState("");
  const [phone, setPhone] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState("");
  const [fulfillmentType, setFulfillmentType] = useState("recoger");
  const [meetingPoint, setMeetingPoint] = useState({ latitude: "", longitude: "", label: "", accuracy: null, capturedAt: null });
  const [coverage, setCoverage] = useState(null);
  const [coverageBusy, setCoverageBusy] = useState(false);
  const [address, setAddress] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [addressReference, setAddressReference] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("efectivo");
  const [notes, setNotes] = useState("");

  const [toast, setToast] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedOrder, setCompletedOrder] = useState(null);
  const [showCustomerOrders, setShowCustomerOrders] = useState(false);
  const [readyBusy, setReadyBusy] = useState(false);
  const requestIdRef = useRef(newRequestId());

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!completedOrder?.id || !uid) return undefined;
    return onSnapshot(doc(db, "customerOrderTracking", uid, "orders", completedOrder.id), (snapshot) => {
      if (!snapshot.exists()) return;
      const tracking = snapshot.data();
      setCompletedOrder((current) => current ? {
        ...current, status: tracking.orderStatus || current.status,
        payment: { ...current.payment, status: tracking.paymentStatus || current.payment?.status },
        delivery: current.delivery || tracking.deliveryStatus ? { ...(current.delivery || {}), status: tracking.deliveryStatus || current.delivery?.status, tableStatus: tracking.tableStatus || current.delivery?.tableStatus } : null,
      } : current);
    });
  }, [completedOrder?.id, completedOrder?.fulfillment?.type]);

  useEffect(() => {
    let mounted = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!mounted) return;
      if (!user) {
        setAuthReady(false);
        setCartReady(false);
        setCart([]);
        cartRevisionRef.current = 0;
        setCartSyncState("idle");
        return;
      }
      if (user.isAnonymous) {
        setCartReady(false);
        setCart([]);
        cartRevisionRef.current = 0;
        setCartSyncState("idle");
        setAuthReady(false);
        setAuthError("Tienes una sesión temporal. Registra una cuenta para vincularla y conservar su identificador.");
        return;
      }
      try {
        const token = await user.getIdTokenResult(true);
        if (user.emailVerified !== true || token.claims.email_verified !== true) {
          setCartReady(false);
          setCart([]);
          cartRevisionRef.current = 0;
          setCartSyncState("idle");
          setAuthReady(false);
          setAuthError("Verifica tu correo para continuar. Revisa tu bandeja de entrada.");
          return;
        }
        const savedCart = await getCustomerCart();
        const restoredItems = (savedCart.cart?.items || []).flatMap((item) => {
          try {
            const preview = calculateLineItem(item.configuration);
            return [{
              lineId: item.lineId,
              name: item.name,
              size: preview.size,
              configuration: {
                size: preview.size,
                favoriteId: preview.favoriteId,
                proteins: preview.proteins,
                toppings: preview.toppings,
                extras: preview.extras,
                base: preview.base,
              },
              preview,
              quantity: item.quantity,
            }];
          } catch (error) {
            console.warn("Se omitió una línea de carrito incompatible:", error);
            return [];
          }
        });
        setCart(restoredItems);
        cartRevisionRef.current = savedCart.cart?.revision || 0;
        skipInitialCartSync.current = true;
        setCartReady(true);
        setCartSyncState("synced");
        setCartConflict(false);
        setClientName(user.displayName || "");
        setAuthError("");
        setAuthReady(true);
      } catch (error) {
        console.error("No se pudo preparar la sesión o sincronizar el carrito:", error);
        setCartReady(false);
        setCartSyncState("error");
        setAuthReady(false);
        setAuthError(error?.message || "No pudimos sincronizar tu carrito. Comprueba la conexión e inténtalo de nuevo.");
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!cartReady || !authReady || !auth.currentUser || cartConflict) return undefined;
    if (skipInitialCartSync.current) {
      skipInitialCartSync.current = false;
      return undefined;
    }
    if (cartSyncTimer.current) window.clearTimeout(cartSyncTimer.current);
    cartSyncTimer.current = window.setTimeout(async () => {
      setCartSyncState("syncing");
      const payload = {
        expectedRevision: cartRevisionRef.current,
        mutationId: globalThis.crypto.randomUUID(),
        items: cart.map(({ lineId, name, configuration, quantity }) => ({
          lineId, name, configuration, quantity: quantity || 1,
        })),
      };
      try {
        let result;
        try {
          result = await saveCustomerCart(payload);
        } catch (error) {
          if (error.code === "CART_CONFLICT") throw error;

          // A timeout or server-side failure can leave the commit outcome unknown.
          // Reconcile with the same mutation ID before attempting any retry.
          if (error.code !== "worker-request-timeout" && error.code !== "internal") throw error;

          const remote = await getCustomerCart(payload.mutationId);
          if (remote.mutationApplied) {
            result = { cart: remote.cart, replayed: true };
          } else if (remote.cart.revision === payload.expectedRevision) {
            // Retry the exact same payload and mutation ID: the Worker treats it idempotently.
            result = await saveCustomerCart(payload);
          } else {
            setCartConflict(true);
            setCartSyncState("conflict");
            return;
          }
        }
        cartRevisionRef.current = result.cart.revision;
        setCartSyncState("synced");
      } catch (error) {
        if (error.code === "CART_CONFLICT") {
          setCartConflict(true);
          setCartSyncState("conflict");
          return;
        }
        console.error("No se pudo sincronizar el carrito:", error);
        setCartSyncState("error");
      }
    }, 700);
    return () => {
      if (cartSyncTimer.current) window.clearTimeout(cartSyncTimer.current);
    };
  }, [cart, cartReady, authReady, cartConflict]);

  const reloadCustomerCart = async () => {
    try {
      setCartSyncState("loading");
      const savedCart = await getCustomerCart();
      const restoredItems = (savedCart.cart?.items || []).flatMap((item) => {
        try {
          const preview = calculateLineItem(item.configuration);
          return [{
            lineId: item.lineId, name: item.name, size: preview.size,
            configuration: {
              size: preview.size, favoriteId: preview.favoriteId,
              proteins: preview.proteins, toppings: preview.toppings,
              extras: preview.extras, base: preview.base,
            },
            preview, quantity: item.quantity,
          }];
        } catch { return []; }
      });
      setCart(restoredItems);
      cartRevisionRef.current = savedCart.cart?.revision || 0;
      skipInitialCartSync.current = true;
      setCartConflict(false);
      setCartSyncState("synced");
    } catch (error) {
      setCartSyncState("error");
      showToast(error.message || "No pudimos cargar el carrito remoto.", "error");
    }
  };

  const handleCustomerSignOut = async () => {
    try {
      await signOut(auth);
      setCart([]);
      setCartReady(false);
      cartRevisionRef.current = 0;
      setCartConflict(false);
      setCartSyncState("idle");
      setCompletedOrder(null);
      setClientName("");
      setPhone("");
      setAddress("");
      setNeighborhood("");
      setAddressReference("");
      setNotes("");
    } catch (error) {
      console.error("No se pudo cerrar la sesión del cliente:", error);
      showToast("No pudimos cerrar la sesión. Inténtalo de nuevo.", "error");
    }
  };

  const persistCustomerName = async () => {
    const name = clientName.trim();
    const user = auth.currentUser;
    if (name.length < 2 || !user) return false;

    try {
      if (user.displayName !== name) await updateProfile(user, { displayName: name });
      setClientName(name);
      setAuthError("");
      return true;
    } catch (error) {
      console.error("No se pudo guardar el nombre del cliente:", error);
      setAuthError("No pudimos guardar tu nombre. Comprueba la conexión e inténtalo de nuevo.");
      return false;
    }
  };

  const currentLine = useMemo(() => {
    try {
      return calculateLineItem({
        size,
        favoriteId,
        proteins: proteins.map((protein) => ({ id: protein.id, quantity: protein.quantity || 1 })),
        toppings: toppings.map((topping) => topping.id),
        extras: extras.map((extra) => extra.id),
        base: baseIngredients,
      });
    } catch {
      return null;
    }
  }, [size, favoriteId, proteins, toppings, extras, baseIngredients]);
  const currentConfiguration = currentLine && {
    size: currentLine.size,
    favoriteId: currentLine.favoriteId,
    proteins: currentLine.proteins,
    toppings: currentLine.toppings,
    extras: currentLine.extras,
    base: currentLine.base,
  };
  const cartUnits = cart.reduce((total, item) => total + (item.quantity || 1), 0);
  const expandedCart = useMemo(
    () => cart.flatMap((item) => Array.from({ length: item.quantity || 1 }, () => item.preview)),
    [cart],
  );
  const totals = useMemo(
    () => calculateOrderTotals(expandedCart, fulfillmentType === "domicilio" ? "domicilio" : "recoger"),
    [expandedCart, fulfillmentType],
  );

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  };

  const toggleItem = (item, list, setList) => {
    const exists = list.some((current) => current.name === item.name);
    setList(
      exists
        ? list.filter((current) => current.name !== item.name)
        : [...list, item],
    );
    setSelectedSuggestion(null);
  };

  const addMenuItemToCart = (item) => {
    try {
      const preview = calculateLineItem({
        size: "15",
        favoriteId: item.id,
        proteins: item.proteins,
        toppings: item.toppings || [],
        extras: [],
        base: DEFAULT_BASE,
      });
      const configuration = {
        size: preview.size,
        favoriteId: preview.favoriteId,
        proteins: preview.proteins,
        toppings: preview.toppings,
        extras: preview.extras,
        base: preview.base,
      };
      const signature = JSON.stringify(configuration);
      setCart((current) => {
        const existing = current.find((line) => JSON.stringify(line.configuration) === signature);
        if (existing) {
          return current.map((line) => line.lineId === existing.lineId
            ? { ...line, quantity: (line.quantity || 1) + 1 }
            : line);
        }
        return [...current, {
          lineId: crypto.randomUUID(),
          name: item.name,
          size: "15",
          configuration,
          preview,
          quantity: 1,
        }];
      });
      showToast(`${item.name} agregado al carrito.`);
    } catch (error) {
      console.error("No se pudo agregar el producto:", error);
      showToast("No pudimos agregar este producto. Inténtalo de nuevo.", "error");
    }
  };

  const toggleBase = (item) => {
    setBaseIngredients((current) =>
      current.includes(item)
        ? current.filter((base) => base !== item)
        : [...current, item],
    );
  };

  const changeProteinQuantity = (id, amount) => {
    setProteins((current) => current.map((protein) => (
      protein.id === id
        ? {
            ...protein,
            quantity: Math.min(
              favoriteId ? 20 : 3,
              Math.max(1, (protein.quantity || 1) + amount),
            ),
          }
        : protein
    )));
    setSelectedSuggestion(null);
  };

  const resetBuilder = () => {
    setProteins([]);
    setToppings([]);
    setExtras([]);
    setBaseIngredients(DEFAULT_BASE);
    setFavoriteId(null);
    setSelectedSuggestion(null);
  };

  const addToCart = () => {
    if (!currentLine) {
      showToast("Selecciona al menos una proteína.", "error");
      return;
    }

    const name = selectedSuggestion
      ? `${selectedSuggestion} ${size === "30" ? "Grande" : "Pequeño"}`
      : generateName(proteins, size);

    setCart((current) => [
      ...current,
      {
        lineId: crypto.randomUUID(),
        name,
        size,
        configuration: currentConfiguration,
        preview: currentLine,
      },
    ]);
    resetBuilder();
    showToast("Sandwich agregado al pedido.");
  };

  const changeCartQuantity = (lineId, amount) => {
    setCart((current) => current
      .map((item) => item.lineId === lineId
        ? { ...item, quantity: (item.quantity || 1) + amount }
        : item)
      .filter((item) => (item.quantity || 1) > 0));
  };

  const removeFromCart = (lineId) => {
    setCart((current) => current.filter((item) => item.lineId !== lineId));
  };

  const clearCart = () => {
    setCart([]);
    showToast("Carrito vaciado.");
  };

  const buildDeliveryAddress = () => [
    address.trim(),
    neighborhood.trim() ? `Barrio: ${neighborhood.trim()}` : "",
    addressReference.trim() ? `Referencia: ${addressReference.trim()}` : "",
  ].filter(Boolean).join(" · ");

  const validateCheckout = () => {
    if (clientName.trim().length < 2) return "Escribe tu nombre.";
    const normalizedPhone = normalizeColombianPhone(phone);
    if (!normalizedPhone) return "Escribe un celular colombiano válido de 10 dígitos que empiece por 3.";
    if (fulfillmentType === "domicilio") {
      if (address.trim().length < 5) return "Escribe la dirección (calle y número).";
      if (neighborhood.trim().length < 2) return "Escribe el barrio de entrega.";
      if (buildDeliveryAddress().length > 180) return "La dirección es demasiado larga; resume las referencias.";
    }
    if (fulfillmentType === "punto_encuentro"
      && (!Number.isFinite(Number(meetingPoint.latitude)) || !Number.isFinite(Number(meetingPoint.longitude)) || coverage?.covered !== true)) {
      return "Selecciona el punto en el mapa y valida que esté dentro de la zona operativa.";
    }
    if (!cart.length) return "Agrega al menos un sandwich.";
    return null;
  };

  const buildWhatsAppMessage = (order) => {
    const lines = [
      `*Pedido #${order.orderNumber} - ${BUSINESS.name}*`,
      order.customer.name,
      `Tel: ${order.customer.phone}`,
      "",
    ];

    order.items.forEach((item, index) => {
      const proteinNames = item.proteins
        .map((protein) => INGREDIENTS.proteins.find((candidate) => candidate.id === protein.id)?.name || protein.id)
        .join(", ");
      const extraNames = item.extras
        .map((extraId) => INGREDIENTS.extras.find((candidate) => candidate.id === extraId)?.name || extraId)
        .join(", ");
      lines.push(
        `${index + 1}. Sandwich personalizado`,
        `${item.size} cm`,
        `Proteínas: ${proteinNames}`,
      );
      if (item.extras.length) {
        lines.push(
          `Extras: ${extraNames}`,
        );
      }
      lines.push(formatMoney(item.price), "");
    });

    if (order.fulfillment.type === "domicilio") lines.push(`Domicilio: ${order.fulfillment.address}`);
    else if (order.fulfillment.type === "punto_encuentro") {
      lines.push(`Punto de encuentro: mesa ${order.delivery?.tableReference || "asignada automáticamente"}`);
      lines.push(`Ubicación: https://maps.google.com/?q=${order.fulfillment.meetingPoint.latitude},${order.fulfillment.meetingPoint.longitude}`);
    } else lines.push("Recoge en el local");
    lines.push(`Pago: ${order.payment.method}`);
    if (order.notes) lines.push(`Notas: ${order.notes}`);
    lines.push("", `*TOTAL: ${formatMoney(order.total)}*`);

    return lines.join("\n");
  };

  const validateMeetingPoint = async () => {
    if (!authReady || !auth.currentUser) {
      showToast("Estamos preparando tu sesión de cliente.", "error");
      return;
    }
    const point = { latitude: Number(meetingPoint.latitude), longitude: Number(meetingPoint.longitude) };
    if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) {
      showToast("Selecciona una ubicación válida en el mapa.", "error");
      return;
    }
    setCoverageBusy(true);
    setCoverage(null);
    try {
      const response = await workerRequest("/v1/delivery/coverage", {
        auth: auth,
        method: "POST",
        body: { meetingPoint: point },
      });
      setCoverage(response);
      showToast(response.covered ? `Punto dentro de la zona ${response.zoneName}.` : "Este punto está fuera de la zona operativa.", response.covered ? "success" : "error");
    } catch (error) {
      setCoverage({ covered: false });
      showToast(error.message || "No pudimos validar la cobertura.", "error");
    } finally {
      setCoverageBusy(false);
    }
  };

  const markArrival = async () => {
    if (!completedOrder?.id || readyBusy) return;
    setReadyBusy(true);
    try {
      await workerRequest(
        `/v1/customer/orders/${encodeURIComponent(completedOrder.id)}/ready`,
        { auth: auth, method: "POST", body: {} },
      );
    } catch (error) {
      showToast(error.message || "No pudimos registrar tu llegada.", "error");
    } finally {
      setReadyBusy(false);
    }
  };

  const confirmOrder = async () => {
    if (!BUSINESS.acceptingOrders) {
      showToast("Los pedidos están temporalmente cerrados. Tu carrito sigue guardado.", "error");
      return;
    }

    const validationError = validateCheckout();
    if (validationError) {
      showToast(validationError, "error");
      return;
    }

    if (!authReady || !auth.currentUser) {
      showToast("Estamos preparando tu sesión. Espera un momento e inténtalo de nuevo.", "error");
      return;
    }

    setIsSubmitting(true);
    const whatsappWindow = window.open("", "_blank");

    try {
      let savedOrder;
      const nameSaved = await persistCustomerName();
      if (!nameSaved) throw new Error("No se pudo guardar el nombre del cliente.");

      const result = await workerRequest("/v1/orders", {
        auth: auth,
        method: "POST",
        body: {
        requestId: requestIdRef.current,
        customer: { name: clientName.trim(), phone: normalizeColombianPhone(phone) },
        items: cart.flatMap((item) => Array.from(
          { length: item.quantity || 1 },
          () => item.configuration,
        )),
        fulfillment: {
          type: fulfillmentType,
          address: fulfillmentType === "domicilio" ? buildDeliveryAddress() : "",
          ...(fulfillmentType === "punto_encuentro" ? { meetingPoint: {
            latitude: Number(meetingPoint.latitude),
            longitude: Number(meetingPoint.longitude),
            label: meetingPoint.label.trim(),
            ...(meetingPoint.accuracy !== null ? { accuracy: meetingPoint.accuracy } : {}),
            ...(meetingPoint.capturedAt !== null ? { capturedAt: meetingPoint.capturedAt } : {}),
          } } : {}),
        },
        paymentMethod,
        notes: notes.trim(),
        },
      });
      savedOrder = result.order;
      requestIdRef.current = newRequestId();

      setCompletedOrder(savedOrder);
      setCart([]);
      setNotes("");
      showToast(`Pedido #${savedOrder.orderNumber} enviado.`);

      const whatsappUrl = `https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent(
        buildWhatsAppMessage(savedOrder),
      )}`;
      if (whatsappWindow) {
        whatsappWindow.location.href = whatsappUrl;
      } else {
        window.location.href = whatsappUrl;
      }
    } catch (error) {
      whatsappWindow?.close();
      console.error("No se pudo enviar el pedido:", error);
      showToast(error?.message || "No pudimos enviar el pedido. Revisa tu conexión e intenta otra vez.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!authReady) {
    return (
      <CustomerAuth pendingMessage={authError} />
    );
  }

  if (completedOrder) {
    return (
      <main className="storefront storefront--confirmation">
        <section className="confirmation-card">
          <div className="confirmation-icon state-success">✓</div>
          <p className="eyebrow">Pedido recibido</p>
          <h1>¡Gracias, {completedOrder.customer.name}!</h1>
          <p className="confirmation-number">
            Tu orden es la <strong>#{completedOrder.orderNumber}</strong>
          </p>
          {completedOrder.delivery?.tableReference && <section className="customer-delivery-tracking" aria-live="polite">
            <p className="eyebrow">Tu mesa virtual</p>
            <h2>{completedOrder.delivery.tableReference}</h2>
            <p>Tu entrega: <strong>{DELIVERY_STATUS_LABELS[completedOrder.delivery.status] || "Esperando al cliente"}</strong></p>
            {completedOrder.delivery.status === "waiting_customer" && <button type="button" className="primary-button motion-feedback" disabled={readyBusy} onClick={markArrival}>{readyBusy ? "Registrando…" : "Ya estoy aquí"}</button>}
            <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${completedOrder.fulfillment.meetingPoint.latitude},${completedOrder.fulfillment.meetingPoint.longitude}`}>Abrir punto en Maps ↗</a>
          </section>}
          <p>
            Tiempo estimado:{" "}
            {completedOrder.fulfillment.type === "domicilio"
              ? BUSINESS.estimatedDeliveryMinutes
              : BUSINESS.estimatedPickupMinutes}{" "}
            minutos.
          </p>
          <p className="confirmation-total">
            Total: {formatMoney(completedOrder.total)}
          </p>
          <div className="confirmation-actions">
            <button type="button" className="secondary-button motion-feedback" onClick={() => setShowCustomerOrders((current) => !current)}>
              {showCustomerOrders ? "Ocultar mis pedidos" : "Ver mis pedidos"}
            </button>
            <button type="button" className="primary-button motion-feedback" onClick={() => setCompletedOrder(null)}>
              Volver al menú
            </button>
          </div>
          {showCustomerOrders && (
            <CustomerOrders onClose={() => setShowCustomerOrders(false)} onRecover={setCompletedOrder} />
          )}
        </section>
      </main>
    );
  }

  return (
    <main className={cartUnits ? "storefront storefront--has-cart" : "storefront"}>
      {toast && (
        <div
          className={`toast toast--${toast.type} state-toast`}
          role="status"
          aria-live="polite"
        >
          <span className="toast-mark" aria-hidden="true">
            {toast.type === "error" ? "!" : "✓"}
          </span>
          {toast.message}
        </div>
      )}

      <header className="store-header hero-banner motion-enter">
        <div className="hero-copy">
          <p className="eyebrow">Hecho fresco</p>
          <h1>{BUSINESS.name}</h1>
          <p>{BUSINESS.tagline}. Tú eliges el sabor y nosotros hacemos el resto.</p>
          <a className="hero-cta" href="#nuestro-menu">Explorar menú <span aria-hidden="true">→</span></a>
        </div>
        <div
          className={
            BUSINESS.acceptingOrders ? "open-badge" : "open-badge closed"
          }
        >
          <span />
          {BUSINESS.acceptingOrders ? "Recibiendo pedidos" : "Pedidos cerrados"}
        </div>
        <a className="customer-profile-link" href="/perfil">Mi perfil</a>
        <button type="button" className="customer-profile-link" onClick={() => setShowCustomerOrders((current) => !current)}>Mis pedidos</button>
        <button
          type="button"
          className="customer-signout-button"
          onClick={handleCustomerSignOut}
        >
          Cerrar sesión
        </button>
      </header>

      {showCustomerOrders && (
        <CustomerOrders onClose={() => setShowCustomerOrders(false)} onRecover={setCompletedOrder} />
      )}

      <div id="nuestro-menu" className="catalog-anchor">
      <DiscoverySection
        onSelect={addMenuItemToCart}
        cart={cart}
      />
      </div>

      <div className="store-layout">
        <section className="builder">
          <div className="section-card" id="personaliza">
            <div className="section-heading">
              <span>2</span>
              <div>
                <h2>Personaliza tu sandwich</h2>
                <p>Selecciona tamaño, base, proteína y extras.</p>
              </div>
            </div>

            <Category
              title="Tamaño"
              items={["15", "30"]}
              selected={size}
              setSelected={setSize}
              isSize
            />

            <div className="choice-group">
              <h3>Base incluida</h3>
              <div className="choice-grid">
                {DEFAULT_BASE.map((item) => (
                  <button
                    type="button"
                    className={
                      baseIngredients.includes(item)
                        ? "choice-button choice-button--selected motion-feedback"
                        : "choice-button motion-feedback"
                    }
                    key={item}
                    onClick={() => toggleBase(item)}
                    aria-pressed={baseIngredients.includes(item)}
                  >
                    <span>{item}</span>
                    {baseIngredients.includes(item) && (
                      <span className="selection-mark" aria-hidden="true">
                        ✓
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <Category
              title="Proteínas"
              items={INGREDIENTS.proteins}
              selected={proteins}
              setSelected={setProteins}
              toggle={toggleItem}
              onQuantityChange={changeProteinQuantity}
            />
            <Category
              title="Toppings"
              items={INGREDIENTS.toppings}
              selected={toppings}
              setSelected={setToppings}
              toggle={toggleItem}
            />
            <Category
              title="Extras"
              items={INGREDIENTS.extras}
              selected={extras}
              setSelected={setExtras}
              toggle={toggleItem}
            />

            <div className="builder-total">
              <div>
                <small>Sandwich actual</small>
                <strong>{formatMoney(currentLine?.price || 0)}</strong>
              </div>
              <button
                type="button"
                className="primary-button motion-feedback"
                onClick={addToCart}
                disabled={!currentLine}
              >
                <span>Agregar al pedido</span>
                <span aria-hidden="true">+</span>
              </button>
            </div>
          </div>

          <div className="section-card">
            <div className="section-heading">
              <span>3</span>
              <div>
                <h2>Datos y entrega</h2>
                <p>Los usaremos únicamente para gestionar tu pedido.</p>
              </div>
            </div>

            <div className="form-grid">
              <label>
                Nombre
                <input
                  autoComplete="name"
                  value={clientName}
                  onChange={(event) => setClientName(event.target.value)}
                  placeholder="Tu nombre"
                />
              </label>
              <label>
                WhatsApp
                <input
                  autoComplete="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="312 345 6789"
                />
              </label>
            </div>

            <div className="segmented-control">
              <button
                type="button"
                className={
                  fulfillmentType === "recoger" ? "active motion-feedback" : "motion-feedback"
                }
                onClick={() => setFulfillmentType("recoger")}
                aria-pressed={fulfillmentType === "recoger"}
              >
                Recoger
              </button>
              <button
                type="button"
                className={
                  fulfillmentType === "domicilio" ? "active motion-feedback" : "motion-feedback"
                }
                onClick={() => setFulfillmentType("domicilio")}
                aria-pressed={fulfillmentType === "domicilio"}
              >
                Domicilio +{formatMoney(BUSINESS.deliveryFee)}
              </button>
            </div>

            {fulfillmentType === "domicilio" && (
              <label className="full-field">
                Dirección
                <input
                  autoComplete="street-address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="Calle, número, barrio y referencia"
                />
              </label>
            )}

            <div className="payment-options">
              {PAYMENT_METHODS.map((method) => (
                <label key={method.value}>
                  <input
                    type="radio"
                    name="payment"
                    value={method.value}
                    checked={paymentMethod === method.value}
                    onChange={() => setPaymentMethod(method.value)}
                  />
                  {method.label}
                </label>
              ))}
            </div>

            <label className="full-field">
              Notas del pedido
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Ej: sin cebolla, llamar al llegar..."
                maxLength={250}
              />
            </label>
            <p className="allergy-note">
              Si tienes una alergia alimentaria, indícala en las notas antes de
              enviar el pedido.
            </p>
          </div>
        </section>

        <aside className="cart-card motion-enter" id="cart-summary" aria-label="Resumen del pedido">
          <div className="cart-header">
            <div>
              <p className="eyebrow">Tu pedido</p>
              <h2>{cartUnits} producto{cartUnits === 1 ? "" : "s"}</h2>
              <small className="checkout-help" role="status">
                {cartSyncState === "syncing" ? "Sincronizando carrito…" :
                  cartSyncState === "synced" ? "Carrito guardado en tu cuenta" :
                    cartSyncState === "conflict" ? "Conflicto entre sesiones" :
                      cartSyncState === "error" ? "No se pudo sincronizar" : "Cargando carrito…"}
              </small>
              {cartConflict && <button type="button" className="cart-clear-button" onClick={reloadCustomerCart}>Recargar carrito sincronizado</button>}
            </div>
          </div>

          {!cart.length ? (
            <div className="empty-cart">
              <span>🥪</span>
              <p>Tu pedido está vacío.</p>
              <small>Agrega un sandwich para comenzar.</small>
            </div>
          ) : (
            <div className="cart-items">
              <div className="cart-actions">
                <span>{cart.length} referencia{cart.length === 1 ? "" : "s"} de producto</span>
                <button type="button" onClick={clearCart} className="cart-clear-button">Vaciar carrito</button>
              </div>
              {cart.map((item) => (
                <article className="cart-item state-cart-item" key={item.lineId}>
                  <div className="cart-item-description">
                    <strong>{item.name}</strong>
                    <small>
                      {item.preview.size} cm ·{" "}
                      {item.configuration.proteins
                        .map((protein) => INGREDIENTS.proteins.find((candidate) => candidate.id === protein.id)?.name || protein.id)
                        .join(", ")}
                    </small>
                    <small className="cart-unit-price">{formatMoney(item.preview.price)} por unidad</small>
                  </div>
                  <div className="cart-item-controls">
                    <strong className="cart-line-total">{formatMoney(item.preview.price * (item.quantity || 1))}</strong>
                    <div className="cart-quantity" aria-label={`Cantidad de ${item.name}`}>
                      <button type="button" onClick={() => changeCartQuantity(item.lineId, -1)} aria-label={`Reducir cantidad de ${item.name}`}>−</button>
                      <output aria-live="polite">{item.quantity || 1}</output>
                      <button type="button" onClick={() => changeCartQuantity(item.lineId, 1)} aria-label={`Aumentar cantidad de ${item.name}`}>+</button>
                    </div>
                    <button type="button" onClick={() => removeFromCart(item.lineId)} className="cart-remove-button" aria-label={`Eliminar ${item.name} del pedido`}>Eliminar</button>
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="totals">
            <p>
              <span>Subtotal</span>
              <strong>{formatMoney(totals.subtotal)}</strong>
            </p>
            <p>
              <span>{fulfillmentType === "domicilio" ? "Domicilio" : fulfillmentType === "punto_encuentro" ? "Punto de encuentro" : "Recoger"}</span>
              <strong>
                {totals.deliveryFee
                  ? formatMoney(totals.deliveryFee)
                  : fulfillmentType === "punto_encuentro" ? "Sin tarifa adicional" : "Sin costo"}
              </strong>
            </p>
            <p className="grand-total">
              <span>Total</span>
              <strong>{formatMoney(totals.total)}</strong>
            </p>
          </div>

          <button
            type="button"
            className="checkout-button motion-feedback"
            disabled={
              isSubmitting || !cart.length || !BUSINESS.acceptingOrders || !authReady
            }
            onClick={confirmOrder}
          >
            {!BUSINESS.acceptingOrders
              ? "Pedidos cerrados"
              : !authReady
                ? "Preparando sesión..."
                : isSubmitting
                ? "Enviando pedido..."
                : "Confirmar pedido"}
          </button>
          {authError && <p className="checkout-help" role="alert">{authError}</p>}
          <small className="checkout-help">
            Al confirmar, tu pedido se guardará y abriremos WhatsApp con el
            resumen.
          </small>
        </aside>
      </div>

      <section className="checkout-details section-card" aria-labelledby="delivery-details-title">
        <div className="section-heading">
          <span>3</span>
          <div>
            <h2 id="delivery-details-title">Datos y entrega</h2>
            <p>Tu nombre se guardará para que no tengas que escribirlo en tu próximo pedido.</p>
          </div>
        </div>
        <div className="form-grid">
          <label>
            Nombre
            <input autoComplete="name" value={clientName} onChange={(event) => setClientName(event.target.value)} onBlur={() => { void persistCustomerName(); }} placeholder="Tu nombre" minLength={2} maxLength={80} required />
          </label>
          <label>
            WhatsApp
            <input autoComplete="tel" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Ej. 300 123 4567" required />
          </label>
        </div>
        <div className="segmented-control">
          <button type="button" className={fulfillmentType === "recoger" ? "active motion-feedback" : "motion-feedback"} onClick={() => { setFulfillmentType("recoger"); setCoverage(null); }} aria-pressed={fulfillmentType === "recoger"}>Recoger</button>
          <button type="button" className={fulfillmentType === "punto_encuentro" ? "active motion-feedback" : "motion-feedback"} onClick={() => { setFulfillmentType("punto_encuentro"); setCoverage(null); }} aria-pressed={fulfillmentType === "punto_encuentro"}>Punto de encuentro</button>
          <button type="button" className={fulfillmentType === "domicilio" ? "active motion-feedback" : "motion-feedback"} onClick={() => { setFulfillmentType("domicilio"); setCoverage(null); }} aria-pressed={fulfillmentType === "domicilio"}>Domicilio +{formatMoney(BUSINESS.deliveryFee)}</button>
        </div>
        {fulfillmentType === "punto_encuentro" && <div className="meeting-point-fields">
          <div className="meeting-point-heading"><div><strong>Elige dónde nos encontraremos</strong><small>No compartimos tu ubicación con otros clientes ni hacemos seguimiento continuo.</small></div><button type="button" className="motion-feedback" onClick={() => {
            if (!navigator.geolocation) { showToast("GPS no disponible. Coloca el pin manualmente.", "error"); return; }
            navigator.geolocation.getCurrentPosition(({ coords }) => {
              setMeetingPoint((current) => ({ ...current, latitude: String(coords.latitude), longitude: String(coords.longitude), accuracy: Math.round(coords.accuracy), capturedAt: Date.now() }));
              setCoverage(null);
            }, () => showToast("No pudimos obtener permiso o señal GPS. Coloca el pin manualmente.", "error"), { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
          }}>Usar mi ubicación</button></div>
          <Suspense fallback={<div className="meeting-point-map-loading" role="status">Cargando mapa…</div>}>
            <MeetingPointPicker point={Number.isFinite(Number(meetingPoint.latitude)) && meetingPoint.latitude !== "" ? { latitude: Number(meetingPoint.latitude), longitude: Number(meetingPoint.longitude) } : null} onSelect={(point) => { setMeetingPoint((current) => ({ ...current, latitude: String(point.latitude), longitude: String(point.longitude), accuracy: null, capturedAt: null })); setCoverage(null); }} />
          </Suspense>
          <div className="form-grid">
            <label>Latitud<input inputMode="decimal" value={meetingPoint.latitude} onChange={(event) => { setMeetingPoint((current) => ({ ...current, latitude: event.target.value, accuracy: null, capturedAt: null })); setCoverage(null); }} placeholder="4.65" /></label>
            <label>Longitud<input inputMode="decimal" value={meetingPoint.longitude} onChange={(event) => { setMeetingPoint((current) => ({ ...current, longitude: event.target.value, accuracy: null, capturedAt: null })); setCoverage(null); }} placeholder="-74.08" /></label>
          </div>
          <label>Referencia opcional<input maxLength={100} value={meetingPoint.label} onChange={(event) => setMeetingPoint((current) => ({ ...current, label: event.target.value }))} placeholder="Parque, esquina o lugar público" /></label>
          <button type="button" className="meeting-point-validate" disabled={coverageBusy || !authReady} onClick={validateMeetingPoint}>{coverageBusy ? "Validando punto…" : "Validar punto de encuentro"}</button>
          {coverage && <p className={coverage.covered ? "meeting-point-status covered" : "meeting-point-status uncovered"} role="status">{coverage.covered ? `Punto dentro de ${coverage.zoneName}.` : "Fuera de la zona habilitada. Mueve el pin y vuelve a validar."}</p>}
          {meetingPoint.accuracy !== null && <small>Precisión GPS aproximada: {meetingPoint.accuracy} m.</small>}
        </div>}
        {fulfillmentType === "domicilio" && (
          <div className="delivery-address-fields">
            <label>
              Dirección (calle y número)
              <input autoComplete="address-line1" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Ej. Calle 10 # 20-30" maxLength={80} />
            </label>
            <label>
              Barrio
              <input autoComplete="address-level3" value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)} placeholder="Nombre del barrio" maxLength={50} />
            </label>
            <label className="full-field">
              Punto de referencia (opcional)
              <input value={addressReference} onChange={(event) => setAddressReference(event.target.value)} placeholder="Edificio, local, portería, indicaciones…" maxLength={45} />
            </label>
            <div className="delivery-address-actions">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([address, neighborhood, addressReference, "Colombia"].filter(Boolean).join(", "))}`}
                target="_blank"
                rel="noreferrer"
                aria-disabled={!address.trim() || !neighborhood.trim()}
                onClick={(event) => {
                  if (!address.trim() || !neighborhood.trim()) event.preventDefault();
                }}
              >Ver dirección en el mapa ↗</a>
            </div>
            <div className="delivery-coverage-note" role="status" aria-live="polite">
              <strong>Verificación manual de cobertura</strong>
              <span>Radio de referencia: hasta {DELIVERY_COVERAGE.radiusKm} km desde {DELIVERY_COVERAGE.originAddress}.</span>
              <span>Esta dirección aún no está aprobada automáticamente. El equipo confirmará la distancia y la disponibilidad del domicilio antes de aceptar el pedido.</span>
            </div>
          </div>
        )}
      </section>
      {cartUnits > 0 && <a className="mobile-cart-dock" href="#cart-summary" aria-label={`Ver carrito con ${cartUnits} productos, total ${formatMoney(totals.total)}`}>
        <span><strong>{cartUnits} {cartUnits === 1 ? "producto" : "productos"}</strong><small>Ver pedido</small></span>
        <strong>{formatMoney(totals.total)} <span aria-hidden="true">→</span></strong>
      </a>}
    </main>
  );
}
