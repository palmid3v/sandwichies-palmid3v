import { useMemo, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import Category from "../components/Category";
import { generateName } from "../utils/generateName";
import { INGREDIENTS } from "../data/ingredients";
import {
  calculateLineItem,
  calculateOrderTotals,
} from "../utils/pricing";
import DiscoverySection from "../components/DiscoverySection";
import {
  BUSINESS,
  PAYMENT_METHODS,
  formatMoney,
} from "../config/business";
import "../styles/storefront.css";
import heroImage from "../assets/hero.png";

const DEFAULT_BASE = [
  "Lechuga",
  "Cebolla",
];

const cleanPhone = (value) => value.replace(/\D/g, "");

export default function OrderPage() {
  const [size, setSize] = useState("15");
  const [proteins, setProteins] = useState([]);
  const [toppings, setToppings] = useState([]);
  const [extras, setExtras] = useState([]);
  const [baseIngredients, setBaseIngredients] = useState(DEFAULT_BASE);
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [favoriteId, setFavoriteId] = useState(null);
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
  const totals = useMemo(
    () => calculateOrderTotals(cart.map((item) => item.preview), fulfillmentType),
    [cart, fulfillmentType],
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
          (candidate) => candidate.id === protein.id,
        );
        return ingredient ? { ...ingredient, quantity: protein.quantity } : null;
      })
      .filter(Boolean);

    setProteins(selectedProteins);
    setToppings((item.toppings || []).map((id) => INGREDIENTS.toppings.find((topping) => topping.id === id)).filter(Boolean));
    setExtras([]);
    setBaseIngredients(DEFAULT_BASE);
    setFavoriteId(item.id);
    setSelectedSuggestion(item.name);
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
      let savedOrder;

      const createOrder = httpsCallable(getFunctions(), "createOrder");
      const result = await createOrder({
        customer: { name: clientName.trim(), phone: cleanPhone(phone) },
        items: cart.map((item) => item.configuration),
        fulfillment: { type: fulfillmentType, address: fulfillmentType === "domicilio" ? address.trim() : "" },
        paymentMethod,
        notes: notes.trim(),
      });
      savedOrder = result.data.order;

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
          <div className="confirmation-icon state-success">✓</div>
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
            type="button"
            className="primary-button motion-feedback"
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
          <a className="hero-cta" href="#personaliza">Arma el tuyo <span aria-hidden="true">→</span></a>
        </div>
        <img src={heroImage} alt="Sandwich artesanal listo para personalizar" />
        <div
          className={
            BUSINESS.acceptingOrders ? "open-badge" : "open-badge closed"
          }
        >
          <span />
          {BUSINESS.acceptingOrders ? "Recibiendo pedidos" : "Pedidos cerrados"}
        </div>
      </header>

      <DiscoverySection
        onSelect={applyMenuItem}
        selectedId={favoriteId}
      />

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

        <aside className="cart-card motion-enter" aria-label="Resumen del pedido">
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
                <article className="cart-item state-cart-item" key={item.lineId}>
                  <div>
                    <strong>{item.name}</strong>
                    <small>
                      {item.preview.size} cm ·{" "}
                      {item.configuration.proteins
                        .map((protein) => INGREDIENTS.proteins.find((candidate) => candidate.id === protein.id)?.name)
                        .join(", ")}
                    </small>
                  </div>
                  <div className="cart-item-price">
                    <strong>{formatMoney(item.preview.price)}</strong>
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.lineId)}
                      aria-label={`Quitar ${item.name} del pedido`}
                    >
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
            type="button"
            className="checkout-button motion-feedback"
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
