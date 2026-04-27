import { useDraggable } from "@dnd-kit/core";
import { KIND_LABELS, KIND_ORDER } from "@/lib/calendarBlockFactory";
import type { ItineraryBlockKind } from "@/types";

function PaletteChip({
  kind,
  disabled,
}: {
  kind: ItineraryBlockKind;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${kind}`,
    data: { kind },
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      className={`palette-chip${isDragging ? " palette-chip--ghost" : ""}`}
      title="Drag onto a day column below"
      {...listeners}
      {...attributes}
      style={{ opacity: isDragging ? 0.45 : 1 }}
    >
      {KIND_LABELS[kind]}
    </div>
  );
}

function CityChipDraggable({
  city,
  selected,
  disabled,
  onSelect,
}: {
  city: string;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `city:${encodeURIComponent(city)}`,
    data: { city },
    disabled,
  });

  return (
    <div className="row" style={{ gap: 0 }}>
      <button
        type="button"
        className={`city-chip${selected ? " city-chip--selected" : ""}${isDragging ? " city-chip--ghost" : ""}`}
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        disabled={disabled}
        title="Drag onto a day column, or click to select for new activities"
        style={{ opacity: isDragging ? 0.45 : 1 }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        {city}
      </button>
    </div>
  );
}

type Props = {
  canUsePalette: boolean;
  allCityNames: string[];
  selectedCity: string;
  onSelectCity: (name: string) => void;
  addCityInput: string;
  onAddCityInput: (s: string) => void;
  onAddCity: () => void;
};

export function ActivityPalette({
  canUsePalette,
  allCityNames,
  selectedCity,
  onSelectCity,
  addCityInput,
  onAddCityInput,
  onAddCity,
}: Props) {
  if (!canUsePalette) {
    return (
      <p className="calendar-toolbar__hint">
        <strong>View-only</strong> — you can’t drag activities here. Open your own calendar and use{" "}
        <em>Enable editing (password)</em> to add blocks.
      </p>
    );
  }

  return (
    <>
      <p className="calendar-toolbar__hint">
        <strong>Activities</strong> — drag onto a day, or <strong>double-click</strong> empty time to add.{" "}
        <strong>Cities</strong> — drag for a quick “Explore”, or set selection for new blocks.
      </p>
      <div className="palette-row">
        {KIND_ORDER.map((k) => (
          <PaletteChip key={k} kind={k} disabled={!canUsePalette} />
        ))}
      </div>
      <div className="city-row">
        {allCityNames.map((c) => (
          <CityChipDraggable
            key={c}
            city={c}
            selected={selectedCity === c}
            disabled={!canUsePalette}
            onSelect={() => onSelectCity(c)}
          />
        ))}
        <div className="city-row__add">
          <input
            type="text"
            placeholder="Add city"
            value={addCityInput}
            disabled={!canUsePalette}
            onChange={(e) => onAddCityInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAddCity()}
          />
          <button type="button" className="btn secondary" disabled={!canUsePalette} onClick={onAddCity}>
            Add
          </button>
        </div>
      </div>
    </>
  );
}
