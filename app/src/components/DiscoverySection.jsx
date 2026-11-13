import { useMemo, useState } from "react";
import { formatMoney } from "../config/business";
import { MENU, MENU_SEGMENTS } from "../data/menu";
import { getIngredient, getTopping } from "../../shared/catalog.js";

const getComposition = (item) => [
  ...(item.proteins || []),
  ...(item.includedIngredients || []),
  ...(item.toppings || []).map((id) => ({ id, quantity: 1 })),
].map((ingredient) => ({
  ...ingredient,
  label: getIngredient(ingredient.id)?.name || getTopping(ingredient.id)?.name || ingredient.id,
}));

const formatIngredient = ({ quantity, label }) => quantity > 1 ? `${quantity} × ${label}` : label;

const MENU_ART = {
  "turkey-finas-hierbas": "/assets/illustrations/sandwich-pavo-hierbas.jpg",
  explosivo: "/assets/illustrations/sandwich-explosivo.jpg",
  "doble-jamon": "/assets/illustrations/sandwich-italiano.jpg",
  "spicy-mix": "/assets/illustrations/sandwich-explosivo.jpg",
  "triple-stack": "/assets/illustrations/sandwich-roast-beef.jpg",
  "full-house": "/assets/illustrations/sandwich-hero.jpg",
  "serrano-verde": "/assets/illustrations/sandwich-mediterraneo.jpg",
  "fuego-tropical": "/assets/illustrations/sandwich-mediterraneo.jpg",
};

export default function DiscoverySection({ onSelect, cart = [] }) {
  const [segment, setSegment] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("featured");
  const [priceFilter, setPriceFilter] = useState("all");

  const visibleItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es-CO");
    const filtered = MENU.filter((item) => {
      const matchesSegment = segment === "all" || item[segment] === true;
      const searchText = `${item.name} ${item.description} ${getComposition(item).map(({ label }) => label).join(" ")}`;
      const matchesSearch = !query || searchText
        .toLocaleLowerCase("es-CO").includes(query);
      const matchesPrice = priceFilter === "all"
        || (priceFilter === "under20" && item.startingPrice < 20000)
        || (priceFilter === "20to30" && item.startingPrice >= 20000 && item.startingPrice <= 30000)
        || (priceFilter === "over30" && item.startingPrice > 30000);
      return matchesSegment && matchesSearch && matchesPrice;
    });

    return filtered.sort((a, b) => {
      if (sort === "price-asc") return a.startingPrice - b.startingPrice;
      if (sort === "price-desc") return b.startingPrice - a.startingPrice;
      if (sort === "name") return a.name.localeCompare(b.name, "es");
      return Number(b.featured) - Number(a.featured);
    });
  }, [segment, search, sort, priceFilter]);

  return (
    <section className="discovery-section" aria-labelledby="discovery-title">
      <div className="discovery-header">
        <div>
          <p className="eyebrow">Nuestro menú</p>
          <h2 id="discovery-title">El menú, a tu manera</h2>
          <p>Tus favoritos de siempre, preparados con ingredientes frescos. Elige, agrega al carrito y listo.</p>
        </div>
        <a className="discovery-builder-link" href="#personaliza">Personaliza desde cero <span aria-hidden="true">↗</span></a>
        </div>

      <div className="discovery-tabs" aria-label="Filtrar por categoría">
        {MENU_SEGMENTS.map((item) => {
          const isActive = segment === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={isActive}
              className={isActive ? "discovery-tab active motion-feedback" : "discovery-tab motion-feedback"}
              onClick={() => setSegment(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <label className="discovery-search">
        <span>Buscar en el menú</span>
        <div className="discovery-search-control">
          <span aria-hidden="true">⌕</span>
          <input
            id="menu-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Sabor o ingrediente…"
            autoComplete="off"
          />
          {search && <button type="button" onClick={() => setSearch("")} aria-label="Limpiar búsqueda">Limpiar</button>}
        </div>
      </label>

      <details className="discovery-filter-details">
        <summary>Precio y orden <span aria-hidden="true">＋</span></summary>
        <div className="discovery-toolbar">
        <label className="discovery-select">
          Filtrar por precio
          <select id="menu-price-filter" name="priceFilter" value={priceFilter} onChange={(event) => setPriceFilter(event.target.value)}>
            <option value="all">Todos los precios</option>
            <option value="under20">Menos de $20.000</option>
            <option value="20to30">$20.000 – $30.000</option>
            <option value="over30">Más de $30.000</option>
          </select>
        </label>
        <label className="discovery-select">
          Ordenar por
          <select id="menu-sort" name="sort" value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="featured">Destacados</option>
            <option value="price-asc">Precio: menor a mayor</option>
            <option value="price-desc">Precio: mayor a menor</option>
            <option value="name">Nombre: A–Z</option>
          </select>
        </label>
        </div>
      </details>

      <p className="discovery-result-count" aria-live="polite">
        {visibleItems.length} {visibleItems.length === 1 ? "producto" : "productos"}
        {search.trim() ? ` para “${search.trim()}”` : " disponibles en el catálogo"}
      </p>

      {visibleItems.length ? (
        <div className="discovery-grid stagger-children">
          {visibleItems.map((item) => {
            const composition = getComposition(item);
            const addedQuantity = cart.reduce((total, line) => (
              line.configuration?.favoriteId === item.id ? total + (line.quantity || 1) : total
            ), 0);
            const badge = item.new ? "Nuevo" : item.seasonal ? "Temporada" : item.signature ? "Signature" : item.popular ? "Popular" : "Favorito";
            return (
              <article className="discovery-card" key={item.id}>
                <div className="discovery-card-art"><img src={MENU_ART[item.id] || "/assets/illustrations/sandwich-hero.jpg"} alt="" aria-hidden="true" loading="lazy" /></div>
                <div className="discovery-card-content">
                  <div className="discovery-card-top">
                    <span className="discovery-badge">{badge}</span>
                    {item.featured && <span className="discovery-featured">★ Destacado</span>}
                  </div>
                  <div className="discovery-card-body">
                    <h3>{item.name}</h3>
                    <p>{item.description}</p>
                    <p className="discovery-card-ingredients">
                      {composition.slice(0, 2).map(formatIngredient).join(" · ")}
                      {composition.length > 2 ? ` · +${composition.length - 2} componentes` : ""}
                    </p>
                    <details className="discovery-ingredients-details">
                      <summary>Ver ingredientes</summary>
                      <ul>{composition.map((ingredient) => <li key={ingredient.id}>{formatIngredient(ingredient)}</li>)}</ul>
                    </details>
                  </div>
                  <div className="discovery-card-footer">
                    <strong>Desde {formatMoney(item.startingPrice)}</strong>
                    <button type="button" className="primary-button motion-feedback" onClick={() => onSelect(item)} aria-label={`Agregar ${item.name} al pedido`}>
                      {addedQuantity ? `Agregar otro · ${addedQuantity}` : "Agregar"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="discovery-empty" role="status">
          <strong>No encontramos productos con esos criterios.</strong>
          <span>Prueba otra categoría, cambia el precio o limpia la búsqueda.</span>
          <button type="button" className="discovery-clear-search" onClick={() => { setSearch(""); setPriceFilter("all"); setSegment("all"); }}>Limpiar filtros</button>
        </div>
      )}
    </section>
  );
}
