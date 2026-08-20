export default function Category({
  title,
  items,
  selected,
  setSelected,
  toggle,
  color,
  isSize,
}) {
  return (
    <div className="choice-group">
      <h3>{title}</h3>

      <div className="choice-grid">
        {items.map((item) => {
          const isSelected = isSize
            ? selected === item
            : selected.some((selectedItem) => selectedItem.name === item.name);

          return (
            <button
              key={isSize ? item : item.name}
              className={
                isSelected
                  ? "choice-button choice-button--selected"
                  : "choice-button"
              }
              onClick={() => {
                if (isSize) setSelected(item);
                else toggle(item, selected, setSelected);
              }}
              style={{
                background: isSelected ? color : undefined,
              }}
            >
              {isSize ? `${item} cm` : item.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
