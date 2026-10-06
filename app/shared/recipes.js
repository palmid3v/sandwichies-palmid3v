// Authoritative customer product recipes and discovery metadata.
// Quantities are physical product units consumed by one 15 cm sandwich.
// The 30 cm size multiplies every recipe quantity by 2 in the pricing engine.

export const FAVORITES = [
  {
    id: "turkey-finas-hierbas",
    name: "🌿 Turkey Finas Hierbas",
    description: "Pavo de finas hierbas y pechuga de pavo para un perfil suave y fresco.",
    status: "production",
    category: "popular",
    featured: true,
    popular: true,
    new: false,
    seasonal: false,
    signature: false,
    proteins: [
      { id: "pavo-finas-hierbas", quantity: 4 },
      { id: "pechuga-pavo", quantity: 4 },
    ],
    includedIngredients: [{ id: "base", quantity: 1 }],
  },
  {
    id: "explosivo",
    name: "🔥 Explosivo",
    description: "Una combinación intensa de chorizo, salami y pepperoni.",
    status: "production",
    category: "signature",
    featured: true,
    popular: true,
    new: false,
    seasonal: false,
    signature: true,
    proteins: [
      { id: "chorizo", quantity: 2 },
      { id: "salami", quantity: 2 },
      { id: "pepperoni", quantity: 9 },
    ],
    includedIngredients: [
      { id: "queso-tajado", quantity: 2 },
      { id: "base", quantity: 1 },
    ],
  },
  {
    id: "doble-jamon",
    name: "🥓 Doble Jamón",
    description: "Pechuga de pavo y jamón serrano con queso para un clásico contundente.",
    status: "production",
    category: "popular",
    featured: false,
    popular: true,
    new: false,
    seasonal: false,
    signature: false,
    proteins: [
      { id: "pechuga-pavo", quantity: 4 },
      { id: "jamon-serrano", quantity: 2 },
    ],
    includedIngredients: [
      { id: "queso-tajado", quantity: 2 },
      { id: "base", quantity: 1 },
    ],
  },
  {
    id: "spicy-mix",
    name: "🌶️ Spicy Mix",
    description: "Chorizo y pepperoni para quienes buscan más carácter.",
    status: "production",
    category: "signature",
    featured: true,
    popular: true,
    new: false,
    seasonal: false,
    signature: true,
    proteins: [
      { id: "chorizo", quantity: 3 },
      { id: "pepperoni", quantity: 6 },
    ],
    includedIngredients: [
      { id: "queso-tajado", quantity: 2 },
      { id: "base", quantity: 1 },
    ],
  },
  {
    id: "triple-stack",
    name: "💪 Triple Stack",
    description: "Tres proteínas para una experiencia más abundante.",
    status: "production",
    category: "signature",
    featured: false,
    popular: false,
    new: false,
    seasonal: false,
    signature: true,
    proteins: [
      { id: "pechuga-pavo", quantity: 4 },
      { id: "jamon-serrano", quantity: 2 },
      { id: "pepperoni", quantity: 6 },
    ],
    includedIngredients: [
      { id: "queso-tajado", quantity: 2 },
      { id: "base", quantity: 1 },
    ],
  },
  {
    id: "full-house",
    name: "👑 Full House",
    description: "La combinación más completa del menú para ir con todo.",
    status: "production",
    category: "signature",
    featured: true,
    popular: false,
    new: false,
    seasonal: false,
    signature: true,
    proteins: [
      { id: "pavo-finas-hierbas", quantity: 4 },
      { id: "pechuga-pavo", quantity: 4 },
      { id: "jamon-serrano", quantity: 2 },
      { id: "chorizo", quantity: 2 },
      { id: "salami", quantity: 2 },
      { id: "pepperoni", quantity: 6 },
      { id: "prosciutto", quantity: 1 },
    ],
    includedIngredients: [
      { id: "queso-tajado", quantity: 2 },
      { id: "base", quantity: 1 },
    ],
  },
  {
    id: "serrano-verde",
    name: "🥬 Serrano Verde",
    description: "Jamón serrano y pavo de finas hierbas en una combinación fresca y equilibrada.",
    status: "production",
    category: "new",
    featured: true,
    popular: false,
    new: true,
    seasonal: false,
    signature: true,
    proteins: [
      { id: "jamon-serrano", quantity: 2 },
      { id: "pavo-finas-hierbas", quantity: 3 },
    ],
    includedIngredients: [
      { id: "queso-tajado", quantity: 2 },
      { id: "base", quantity: 1 },
    ],
  },
  {
    id: "fuego-tropical",
    name: "🔥 Fuego Tropical",
    description: "Chorizo, pepperoni y pimentón asado con un perfil más intenso.",
    status: "production",
    category: "seasonal",
    featured: true,
    popular: false,
    new: true,
    seasonal: true,
    signature: true,
    proteins: [
      { id: "chorizo", quantity: 2 },
      { id: "pepperoni", quantity: 5 },
    ],
    toppings: ["pimenton"],
    includedIngredients: [
      { id: "queso-tajado", quantity: 2 },
      { id: "base", quantity: 1 },
    ],
  },
];

export const DISCOVERY_SEGMENTS = [
  { id: "all", label: "Todos" },
  { id: "featured", label: "Destacados" },
  { id: "popular", label: "Populares" },
  { id: "new", label: "Nuevos" },
  { id: "signature", label: "Signature" },
  { id: "seasonal", label: "Temporada" },
];

export const getFavorite = (id) => FAVORITES.find((item) => item.id === id);

export const getFavoritesByDiscovery = (segment = "all") =>
  FAVORITES.filter((item) => {
    if (item.status !== "production") return false;
    if (segment === "all") return true;
    return item[segment] === true;
  });
