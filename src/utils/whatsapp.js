export const sendWhatsApp = (order) => {
  if (!order?.phone) {
    alert("Falta número de WhatsApp");
    return;
  }

  const message = `
Hola ${order.clientName || ""} 👋

🧾 *Tu pedido en Sandwichies*

📦 Orden #${order.orderNumber}
🥪 ${order.name}

📏 Tamaño: ${order.size} cm

${order.proteins?.length ? `🥩 Proteínas:\n${order.proteins.map(p => `• ${p.name}`).join("\n")}\n` : ""}
${order.toppings?.length ? `\n🥬 Toppings:\n${order.toppings.map(t => `• ${t.name}`).join("\n")}\n` : ""}
${order.extras?.length ? `\n🧀 Extras:\n${order.extras.map(e => `• ${e.name === "Doble proteína" ? "🔥 Doble proteína" : e.name}`).join("\n")}\n` : ""}
${order.base?.length ? `🥖 Base:\n${order.base.map(b => `• ${b}`).join("\n")}\n` : ""}

💰 *Total a pagar:* $${order.price.toFixed(0)}

🙌 Gracias por tu compra
`;

  const url = `https://wa.me/${order.phone}?text=${encodeURIComponent(message)}`;

  window.open(url, "_blank");
};