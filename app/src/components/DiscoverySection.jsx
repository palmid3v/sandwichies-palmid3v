import { useMemo, useState } from "react";
import { formatMoney } from "../config/business";
import { MENU, MENU_SEGMENTS } from "../data/menu";
import { INGREDIENTS } from "../data/ingredients";

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

export default function DiscoverySection({ onSelect, selectedId }) {
  const [segment, setSegment] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("featured");
  const [priceFilter, setPriceFilter] = useState("all");

  const visibleItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es-CO");
    const filtered = MENU.filter((item) => {
      const matchesSegment = segment === "all" || item[segment] === true;
      const matchesSearch = !query || `${item.name} ${item.description}`
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
          <h2 id="discovery-title">Encuentra tu próximo favorito</h2>
          <p>Explora las recetas existentes de Sandwichies, revisa sus ingredientes y elige cómo quieres disfrutarlas.</p>
        </div>
        <a className="discovery-builder-link" href="#personaliza">Armar mi sandwich →</a>
      </div>

      <div className="discovery-tabs" role="tablist" aria-label="Categorías del menú">
        {MENU_SEGMENTS.map((item) => {
          const isActive = segment === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={isActive ? "discovery-tab active motion-feedback" : "discovery-tab motion-feedback"}
              onClick={() => setSegment(item.id)}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="discovery-toolbar">
        <div className="discovery-search">
          <label htmlFor="menu-search">Buscar productos</label>
          <div className="discovery-search-control">
            <span aria-hidden="true">⌕</span>
            <input
              id="menu-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nombre o ingredientes…"
              autoComplete="off"
            />
            {search && <button type="button" onClick={() => setSearch("")} aria-label="Limpiar búsqueda">Limpiar</button>}
          </div>
        </div>
        <label className="discovery-select">
          Filtrar por precio
          <select value={priceFilter} onChange={(event) => setPriceFilter(event.target.value)}>
            <option value="all">Todos los precios</option>
            <option value="under20">Menos de $20.000</option>
            <option value="20to30">$20.000 – $30.000</option>
            <option value="over30">Más de $30.000</option>
          </select>
        </label>
        <label className="discovery-select">
          Ordenar por
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="featured">Destacados</option>
            <option value="price-asc">Precio: menor a mayor</option>
            <option value="price-desc">Precio: mayor a menor</option>
            <option value="name">Nombre: A–Z</option>
          </select>
        </label>
      </div>

      <p className="discovery-result-count" aria-live="polite">
        {visibleItems.length} {visibleItems.length === 1 ? "producto" : "productos"}
        {search.trim() ? ` para “${search.trim()}”` : " disponibles en el catálogo"}
      </p>

      {visibleItems.length ? (
        <div className="discovery-grid stagger-children">
          {visibleItems.map((item) => {
            const isSelected = selectedId === item.id;
            const badge = item.new ? "Nuevo" : item.seasonal ? "Temporada" : item.signature ? "Signature" : item.popular ? "Popular" : "Favorito";
            return (
              <article className={isSelected ? "discovery-card discovery-card--selected" : "discovery-card"} key={item.id}>
                <div className="discovery-card-art"><img src={MENU_ART[item.id] || "/assets/illustrations/sandwich-hero.jpg"} alt={item.name} loading="lazy" /></div>
                <div className="discovery-card-content">
                  <div className="discovery-card-top">
                    <span className="discovery-badge">{badge}</span>
                    {item.featured && <span className="discovery-featured">★ Destacado</span>}
                  </div>
                  <div className="discovery-card-body">
                    <h3>{item.name}</h3>
                    <p>{item.description}</p>
                    <p className="discovery-card-ingredients">
                      {item.proteins.map((protein) => {
                        const ingredient = INGREDIENTS.proteins.find((candidate) => candidate.id === protein.id);
                        const name = ingredient?.name || protein.id;
                        return protein.quantity > 1 ? `${protein.quantity} × ${name}` : name;
                      }).join(" · ")}
                    </p>
                  </div>
                  <div className="discovery-card-footer">
                    <strong>Desde {formatMoney(item.startingPrice)}</strong>
                    <button type="button" className="primary-button motion-feedback" onClick={() => onSelect(item)} aria-pressed={isSelected}>
                      {isSelected ? "Seleccionado" : "Personalizar"}
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
