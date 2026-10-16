import { useMemo, useState } from "react";
import { formatMoney } from "../config/business";
import { MENU, MENU_SEGMENTS } from "../data/menu";

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

  const visibleItems = useMemo(() => {
    const bySegment = segment === "all"
      ? MENU
      : MENU.filter((item) => item[segment] === true);
    const query = search.trim().toLocaleLowerCase("es-CO");
    if (!query) return bySegment;
    return bySegment.filter((item) =>
      `${item.name} ${item.description}`.toLocaleLowerCase("es-CO").includes(query),
    );
  }, [segment, search]);

  return (
    <section className="discovery-section" aria-labelledby="discovery-title">
      <div className="discovery-header">
        <div>
          <p className="eyebrow">Descubre el menú</p>
          <h2 id="discovery-title">Elige algo que se te antoje</h2>
          <p>
            Empieza con una combinación de la casa o encuentra una creación nueva.
            Después puedes personalizarla.
          </p>
        </div>
        <a className="discovery-builder-link" href="#personaliza">
          Quiero armar el mío →
        </a>
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

      <div className="discovery-search">
        <label htmlFor="menu-search">Buscar en el menú</label>
        <div className="discovery-search-control">
          <span aria-hidden="true">⌕</span>
          <input
            id="menu-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Ej. pavo, picante, jamón…"
            autoComplete="off"
          />
          {search && (
            <button type="button" onClick={() => setSearch("")} aria-label="Limpiar búsqueda">
              Limpiar
            </button>
          )}
        </div>
        <p className="discovery-result-count" aria-live="polite">
          {visibleItems.length} {visibleItems.length === 1 ? "opción" : "opciones"}
          {search.trim() ? ` para “${search.trim()}”` : " en esta selección"}
        </p>
      </div>

      {visibleItems.length ? (
        <div className="discovery-grid stagger-children">
          {visibleItems.map((item) => {
            const isSelected = selectedId === item.id;
            const badge = item.new
              ? "Nuevo"
              : item.seasonal
                ? "Temporada"
                : item.signature
                  ? "Signature"
                  : item.popular
                    ? "Popular"
                    : "Favorito";

            return (
              <article
                className={isSelected ? "discovery-card discovery-card--selected" : "discovery-card"}
                key={item.id}
              >
                <div className="discovery-card-art" aria-hidden="true"><img src={MENU_ART[item.id] || "/assets/illustrations/sandwich-hero.jpg"} alt="" loading="lazy" /></div>
                <div className="discovery-card-content">
                <div className="discovery-card-top">
                  <span className="discovery-badge">{badge}</span>
                  {item.featured && <span className="discovery-featured">★ Destacado</span>}
                </div>
                <div className="discovery-card-body">
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                </div>
                <div className="discovery-card-footer">
                  <strong>Desde {formatMoney(item.startingPrice)}</strong>
                  <button
                    type="button"
                    className="primary-button motion-feedback"
                    onClick={() => onSelect(item)}
                    aria-pressed={isSelected}
                  >
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
          <strong>{search.trim() ? "No encontramos coincidencias." : "Aún no hay creaciones en esta categoría."}</strong>
          <span>{search.trim() ? "Prueba con otro ingrediente o limpia la búsqueda." : "Prueba otra categoría o arma tu sandwich desde cero."}</span>
          {search.trim() && <button type="button" className="discovery-clear-search" onClick={() => setSearch("")}>Limpiar búsqueda</button>}
        </div>
      )}
    </section>
  );
}
