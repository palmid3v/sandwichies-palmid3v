import { useMemo, useState } from "react";
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import Category from "../components/Category";
import { generateName } from "../utils/generateName";
import { INGREDIENTS } from "../data/ingredients";
import {
  calculateOrderTotals,
  calculateSalePrice,
  calculateTotalCost,
} from "../utils/pricing";
import { MENU } from "../data/menu";
import {
  BUSINESS,
  PAYMENT_METHODS,
  formatMoney,
} from "../config/business";
import "../styles/storefront.css";

const DEFAULT_BASE = [
  "Lechuga",
  "Pimentón Asado",
  "Cebolla",
  "Salsa tomate",
  "Mayonesa",
  "Mostaza",
];

const cleanPhone = (value) => value.replace(/\D/g, "");

export default function OrderPage() {
  const [size, setSize] = useState("15");
  const [proteins, setProteins] = useState([]);
  const [toppings, setToppings] = useState([]);
  const [extras, setExtras] = useState([]);
  const [baseIngredients, setBaseIngredients] = useState(DEFAULT_BASE);
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [cart, setCart] = useState([]);

  const [clientName, setClientName] = useState("");
  const [phone, setPhone] = useState("");
  const [fulfillmentType, setFulfillmentType] = useState("recoger");
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("efectivo");
  const [notes, setNotes] = useState("");

  const [toast, setToast] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedOrder, setCompletedOrder] = useState(null);

  const totalCost = calculateTotalCost({
    size,
    proteins,
    toppings,
    extras,
    ingredients: INGREDIENTS,
  });

  const salePrice = calculateSalePrice({ totalCost, extras });
  const deliveryFee =
    fulfillmentType === "domicilio" ? BUSINESS.deliveryFee : 0;
  const totals = useMemo(
    () => calculateOrderTotals(cart, deliveryFee),
    [cart, deliveryFee],
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

  const applyMenuItem = (item) => {
    const selectedProteins = item.proteins
      .map((protein) => {
        const ingredient = INGREDIENTS.proteins.find(
          (candidate) => candidate.name === protein.name,
        );
        return ingredient ? { ...ingredient, used: protein.used } : null;
      })
      .filter(Boolean);

    setProteins(selectedProteins);
    setExtras([]);
    setSelectedSuggestion(item.name);
  };

  const toggleBase = (item) => {
    setBaseIngredients((current) =>
      current.includes(item)
        ? current.filter((base) => base !== item)
        : [...current, item],
    );
  };

  const resetBuilder = () => {
    setProteins([]);
    setToppings([]);
    setExtras([]);
    setBaseIngredients(DEFAULT_BASE);
    setSelectedSuggestion(null);
  };

  const addToCart = () => {
    if (!proteins.length) {
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
        base: baseIngredients,
        proteins,
        toppings,
        extras,
        cost: Math.round(totalCost),
        price: Math.round(salePrice),
      },
    ]);
    resetBuilder();
    showToast("Sandwich agregado al pedido.");
  };

  const removeFromCart = (lineId) => {
    setCart((current) => current.filter((item) => item.lineId !== lineId));
  };

  const validateCheckout = () => {
    if (clientName.trim().length < 2) return "Escribe tu nombre.";
    if (cleanPhone(phone).length < 10) return "Escribe un WhatsApp válido.";
    if (fulfillmentType === "domicilio" && address.trim().length < 8) {
      return "Escribe la dirección de entrega completa.";
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
      lines.push(
        `${index + 1}. ${item.name}`,
        `${item.size} cm`,
        `Proteínas: ${item.proteins.map((protein) => protein.name).join(", ")}`,
      );
      if (item.extras.length) {
        lines.push(
          `Extras: ${item.extras.map((extra) => extra.name).join(", ")}`,
        );
      }
      lines.push(formatMoney(item.price), "");
    });

    lines.push(
      order.fulfillment.type === "domicilio"
        ? `Domicilio: ${order.fulfillment.address}`
        : "Recoge en el local",
      `Pago: ${order.payment.method}`,
    );
    if (order.notes) lines.push(`Notas: ${order.notes}`);
    lines.push("", `*TOTAL: ${formatMoney(order.total)}*`);

    return lines.join("\n");
  };

  const confirmOrder = async () => {
    const validationError = validateCheckout();
    if (validationError) {
      showToast(validationError, "error");
      return;
    }

    setIsSubmitting(true);
    const whatsappWindow = window.open("", "_blank");

    try {
      const orderRef = doc(collection(db, "orders"));
      const counterRef = doc(db, "counters", "orders");
      let savedOrder;

      await runTransaction(db, async (transaction) => {
        const counterSnapshot = await transaction.get(counterRef);
        const orderNumber =
          (Number(counterSnapshot.data()?.value) || 0) + 1;

        savedOrder = {
          orderNumber,
          customer: {
            name: clientName.trim(),
            phone: cleanPhone(phone),
          },
          items: cart.map((item) => {
            const savedItem = { ...item };
            delete savedItem.lineId;
            return savedItem;
          }),
          fulfillment: {
            type: fulfillmentType,
            address:
              fulfillmentType === "domicilio" ? address.trim() : "",
          },
          payment: {
            method: paymentMethod,
            status: "pendiente",
          },
          notes: notes.trim(),
          ...totals,
          status: "pendiente",
          source: "web",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        transaction.set(counterRef, { value: orderNumber });
        transaction.set(orderRef, savedOrder);
      });

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
      showToast(
        "No pudimos enviar el pedido. Revisa tu conexión e intenta otra vez.",
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (completedOrder) {
    return (
      <main className="storefront storefront--confirmation">
        <section className="confirmation-card">
          <div className="confirmation-icon">✓</div>
          <p className="eyebrow">Pedido recibido</p>
          <h1>¡Gracias, {completedOrder.customer.name}!</h1>
          <p className="confirmation-number">
            Tu orden es la <strong>#{completedOrder.orderNumber}</strong>
          </p>
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
          <button
            className="primary-button"
            onClick={() => setCompletedOrder(null)}
          >
            Crear otro pedido
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="storefront">
      {toast && (
        <div className={`toast toast--${toast.type}`} role="status">
          {toast.message}
        </div>
      )}

      <header className="store-header">
        <div>
          <p className="eyebrow">Hecho fresco</p>
          <h1>{BUSINESS.name}</h1>
          <p>{BUSINESS.tagline}</p>
        </div>
        <div
          className={
            BUSINESS.acceptingOrders ? "open-badge" : "open-badge closed"
          }
        >
          <span />
          {BUSINESS.acceptingOrders ? "Recibiendo pedidos" : "Pedidos cerrados"}
        </div>
      </header>

      <div className="store-layout">
        <section className="builder">
          <div className="section-card">
            <div className="section-heading">
              <span>1</span>
              <div>
                <h2>Elige un favorito</h2>
                <p>Puedes personalizarlo después.</p>
              </div>
            </div>
            <div className="menu-grid">
              {MENU.map((item) => (
                <button
                  className={
                    selectedSuggestion === item.name
                      ? "menu-option menu-option--selected"
                      : "menu-option"
                  }
                  key={item.name}
                  onClick={() => applyMenuItem(item)}
                >
                  <span>{item.name}</span>
                  <small>Desde {formatMoney(item.startingPrice)}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="section-card">
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
                    className={
                      baseIngredients.includes(item)
                        ? "choice-button choice-button--selected"
                        : "choice-button"
                    }
                    key={item}
                    onClick={() => toggleBase(item)}
                  >
                    {item}
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
                <strong>{formatMoney(salePrice)}</strong>
              </div>
              <button className="primary-button" onClick={addToCart}>
                Agregar al pedido
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
                className={fulfillmentType === "recoger" ? "active" : ""}
                onClick={() => setFulfillmentType("recoger")}
              >
                Recoger
              </button>
              <button
                className={fulfillmentType === "domicilio" ? "active" : ""}
                onClick={() => setFulfillmentType("domicilio")}
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

        <aside className="cart-card">
          <div className="cart-header">
            <div>
              <p className="eyebrow">Tu pedido</p>
              <h2>{cart.length} producto{cart.length === 1 ? "" : "s"}</h2>
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
              {cart.map((item) => (
                <article className="cart-item" key={item.lineId}>
                  <div>
                    <strong>{item.name}</strong>
                    <small>
                      {item.size} cm ·{" "}
                      {item.proteins.map((protein) => protein.name).join(", ")}
                    </small>
                  </div>
                  <div className="cart-item-price">
                    <strong>{formatMoney(item.price)}</strong>
                    <button onClick={() => removeFromCart(item.lineId)}>
                      Quitar
                    </button>
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
              <span>Domicilio</span>
              <strong>
                {totals.deliveryFee
                  ? formatMoney(totals.deliveryFee)
                  : "Sin costo"}
              </strong>
            </p>
            <p className="grand-total">
              <span>Total</span>
              <strong>{formatMoney(totals.total)}</strong>
            </p>
          </div>

          <button
            className="checkout-button"
            disabled={
              isSubmitting || !cart.length || !BUSINESS.acceptingOrders
            }
            onClick={confirmOrder}
          >
            {!BUSINESS.acceptingOrders
              ? "Pedidos cerrados"
              : isSubmitting
                ? "Enviando pedido..."
                : "Confirmar pedido"}
          </button>
          <small className="checkout-help">
            Al confirmar, tu pedido se guardará y abriremos WhatsApp con el
            resumen.
          </small>
        </aside>
      </div>
    </main>
  );
}
