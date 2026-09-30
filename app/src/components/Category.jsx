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
    <div className="choice-group">
      <h3>{title}</h3>

      <div className="choice-grid">
        {items.map((item) => {
          const isSelected = isSize
            ? selected === item
            : selected.some((selectedItem) => selectedItem.id === item.id);
          const selectedItem = isSize ? null : selected.find((entry) => entry.id === item.id);

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
                className="choice-button"
                onClick={() => {
                  if (isSize) setSelected(item);
                  else toggle(item, selected, setSelected);
                }}
                style={{ background: isSelected ? color : undefined }}
              >
                {isSize ? `${item} cm` : item.name}
              </button>
              {isSelected && onQuantityChange && (
                <div className="quantity-control" aria-label={`Cantidad de ${item.name}`}>
                  <button type="button" onClick={() => onQuantityChange(item.id, -1)} aria-label={`Reducir ${item.name}`}>−</button>
                  <span>{selectedItem.quantity || 1}</span>
                  <button type="button" onClick={() => onQuantityChange(item.id, 1)} aria-label={`Aumentar ${item.name}`}>+</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
