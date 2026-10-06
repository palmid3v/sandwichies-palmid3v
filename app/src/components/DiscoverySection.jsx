import { useMemo, useState } from "react";
import { formatMoney } from "../config/business";
import { MENU, MENU_SEGMENTS } from "../data/menu";

export default function DiscoverySection({ onSelect, selectedId }) {
  const [segment, setSegment] = useState("all");

  const visibleItems = useMemo(() => {
    if (segment === "all") return MENU;
    return MENU.filter((item) => item[segment] === true);
  }, [segment]);

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
              </article>
            );
          })}
        </div>
      ) : (
        <div className="discovery-empty" role="status">
          <strong>Aún no hay creaciones en esta categoría.</strong>
          <span>Prueba otra categoría o arma tu sandwich desde cero.</span>
        </div>
      )}
    </section>
  );
}
