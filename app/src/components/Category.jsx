export default function Category({
  title,
  items,
  selected,
  setSelected,
  toggle,
  color,
  isSize,
  onQuantityChange,
}) {
  return (
    <section className="choice-group" aria-labelledby={`choice-${title.toLowerCase()}`}>
      <div className="choice-group-heading">
        <h3 id={`choice-${title.toLowerCase()}`}>{title}</h3>
        {!isSize && (
          <span className="choice-group-hint">
            Toca para seleccionar
          </span>
        )}
      </div>

      <div className="choice-grid">
        {items.map((item) => {
          const isSelected = isSize
            ? selected === item
            : selected.some((selectedItem) => selectedItem.id === item.id);
          const selectedItem = isSize
            ? null
            : selected.find((entry) => entry.id === item.id);

          return (
            <div
              key={isSize ? item : item.id}
              className={
                isSelected
                  ? "choice-option choice-option--selected"
                  : "choice-option"
              }
            >
              <button
                type="button"
                className="choice-button motion-feedback"
                onClick={() => {
                  if (isSize) setSelected(item);
                  else toggle(item, selected, setSelected);
                }}
                aria-pressed={isSelected}
                data-selected={isSelected ? "true" : "false"}
                style={{ background: isSelected ? color : undefined }}
              >
                <span>{isSize ? `${item} cm` : item.name}</span>
                {isSelected && (
                  <span className="selection-mark" aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>

              {isSelected && onQuantityChange && (
                <div
                  className="quantity-control motion-pop"
                  aria-label={`Cantidad de ${item.name}`}
                >
                  <button
                    type="button"
                    onClick={() => onQuantityChange(item.id, -1)}
                    aria-label={`Reducir ${item.name}`}
                  >
                    −
                  </button>
                  <span aria-live="polite">{selectedItem.quantity || 1}</span>
                  <button
                    type="button"
                    onClick={() => onQuantityChange(item.id, 1)}
                    aria-label={`Aumentar ${item.name}`}
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
