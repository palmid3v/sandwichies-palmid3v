export const INGREDIENTS = {
  baseCost: 1000,
  mozzarella: 555,

  proteins: [
    { name: "Jamón serrano", price: 7990, units: 5, used: 1 },
    { name: "Jamón de pavo finas hierbas", price: 11950, units: 20, used: 2 },
    { name: "Jamón asado", price: 9900, units: 6, used: 1 },
    { name: "Jamón pechuga de pavo", price: 12300, units: 22, used: 2 },
    { name: "Pepperoni", price: 4990, units: 39, used: 3 },

    { name: "Chorizo", price: 8400, units: 18, used: 1 },
    { name: "Salami", price: 8400, units: 18, used: 1 },
  ],

  extras: [
  { 
    name: "Queso extra", 
    cost: 9990,   // 🔥 costo real paquete
    units: 18, 
    used: 1,
    price: 1000   // 💰 lo que cobra el cliente
  },
  { 
    name: "Doble proteína", 
    price: 2500   // 💰 solo venta
  }
],

  toppings: [
    { name: "Pimentón", price: 6490, grams: 150, usedGrams: 30 }
  ]
};