import { CSS } from "@dnd-kit/utilities";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import type { CSSProperties, MutableRefObject, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { EditModeModal } from "@/components/EditModeModal";
import { useTrip } from "@/context/TripContext";
import { getDb } from "@/lib/firebase";
import {
  blockSegmentsForDay,
  DAY_END_HOUR,
  DAY_START_HOUR,
  defaultTripStartDate,
  formatJstTime,
  HOTEL_CHECK_OUT_MIN,
  jstDateTimeToUtc,
  snapMinutes,
  toTokyoParts,
  tripDayStrings,
  utcFromDayAndMinutes,
} from "@/lib/time";
import type { ItineraryBlock, ItineraryBlockKind, ItineraryDoc } from "@/types";

const DAY_BODY_PX = 720;
const PX_PER_MIN = DAY_BODY_PX / ((DAY_END_HOUR - DAY_START_HOUR) * 60);
const CITY_LS = "japan-trip-city-presets";
const DEFAULT_CITIES = ["Tokyo", "Kyoto", "Osaka", "Fukuoka", "Hiroshima"];
const KIND_ORDER: ItineraryBlockKind[] = [
  "wander",
  "shrine",
  "transit",
  "food",
  "hotel",
  "custom",
];

const KIND_LABELS: Record<ItineraryBlockKind, string> = {
  wander: "Wander",
  shrine: "Shrine",
  transit: "Transit",
  food: "Food",
  hotel: "Hotel",
  custom: "Custom 1h",
};

type UserChip = { id: string; displayName: string; color: string };

function readCustomCities(): string[] {
  try {
    const j = localStorage.getItem(CITY_LS);
    if (!j) return [];
    const a = JSON.parse(j) as unknown;
    if (!Array.isArray(a)) return [];
    return a
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function nextDayStr(dayStr: string): string {
  const [y, m, d] = dayStr.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

function gridMinutesForAbsoluteMinutes(absMin: number): number {
  return absMin - DAY_START_HOUR * 60;
}

function newBlockId(): string {
  return crypto.randomUUID();
}

function createBlockForKind(
  kind: ItineraryBlockKind,
  dayStr: string,
  gridMinutes: number,
  city: string,
  accent: string,
): ItineraryBlock {
  const maxG = (DAY_END_HOUR - DAY_START_HOUR) * 60 - 15;
  const safeMin = Math.max(0, Math.min(gridMinutes, maxG));
  let title = "Block";
  let start: Date = utcFromDayAndMinutes(dayStr, safeMin);
  let end: Date;

  if (kind === "wander") {
    title = "Wandering";
    end = new Date(start.getTime() + 120 * 60_000);
  } else if (kind === "shrine") {
    title = `${city} Shrine`;
    end = new Date(start.getTime() + 60 * 60_000);
  } else if (kind === "transit") {
    title = "Transit";
    end = new Date(start.getTime() + 45 * 60_000);
  } else if (kind === "food") {
    title = "Meal";
    end = new Date(start.getTime() + 75 * 60_000);
  } else if (kind === "hotel") {
    title = `Hotel · ${city}`;
    const outDay = nextDayStr(dayStr);
    const outMin = gridMinutesForAbsoluteMinutes(HOTEL_CHECK_OUT_MIN);
    end = utcFromDayAndMinutes(outDay, outMin);
  } else {
    title = "Plan";
    end = new Date(start.getTime() + 60 * 60_000);
  }

  return {
    id: newBlockId(),
    kind,
    title,
    city,
    start: Timestamp.fromDate(start),
    end: Timestamp.fromDate(end),
    color: accent,
    notes: "",
    stationFrom: kind === "transit" ? "" : undefined,
    stationTo: kind === "transit" ? "" : undefined,
  };
}

function createCityExploreBlock(
  dayStr: string,
  gridMinutes: number,
  city: string,
  accent: string,
): ItineraryBlock {
  const maxG = (DAY_END_HOUR - DAY_START_HOUR) * 60 - 30;
  const safeMin = Math.max(0, Math.min(gridMinutes, maxG));
  const start = utcFromDayAndMinutes(dayStr, safeMin);
  const end = new Date(start.getTime() + 45 * 60_000);
  return {
    id: newBlockId(),
    kind: "custom",
    title: `Explore ${city}`,
    city,
    start: Timestamp.fromDate(start),
    end: Timestamp.fromDate(end),
    color: accent,
    notes: "",
  };
}

function DayDropZone({
  dayStr,
  canEdit,
  heightPx,
  dayBodyRefs,
  children,
}: {
  dayStr: string;
  canEdit: boolean;
  heightPx: number;
  dayBodyRefs: MutableRefObject<Map<string, HTMLDivElement>>;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day:${dayStr}`,
    data: { dayStr },
    disabled: !canEdit,
  });

  const setRefs = (el: HTMLDivElement | null) => {
    setNodeRef(el);
    if (el) dayBodyRefs.current.set(dayStr, el);
    else dayBodyRefs.current.delete(dayStr);
  };

  return (
    <div
      ref={setRefs}
      className={`day-body${isOver ? " day-body--over" : ""}`}
      style={{ height: heightPx }}
    >
      {children}
    </div>
  );
}

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

function BlockSegmentView({
  block,
  dayStr,
  fromMin,
  toMin,
  canEdit,
  placedAnim,
  onBodyClick,
}: {
  block: ItineraryBlock;
  dayStr: string;
  fromMin: number;
  toMin: number;
  canEdit: boolean;
  placedAnim: boolean;
  onBodyClick: () => void;
}) {
  const id = `${block.id}|${dayStr}`;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    disabled: !canEdit,
  });

  const top = fromMin * PX_PER_MIN;
  const h = Math.max(8, (toMin - fromMin) * PX_PER_MIN);
  const style: CSSProperties = {
    top,
    height: h,
    background: block.color,
    transform: CSS.Translate.toString(transform),
    zIndex: isDragging ? 8 : 1,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      className={`block-item${canEdit ? "" : " readonly"}${placedAnim ? " block-item--placed" : ""}`}
      style={style}
      {...attributes}
      title={`${block.title} · ${formatJstTime(block.start.toDate())}–${formatJstTime(block.end.toDate())}`}
    >
      {canEdit && (
        <button
          type="button"
          className="block-item__handle"
          aria-label="Drag to move"
          {...listeners}
        />
      )}
      <div
        className="block-item__body"
        role="button"
        tabIndex={0}
        onClick={onBodyClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onBodyClick();
          }
        }}
      >
        <strong>{block.title}</strong>
        {block.city && <div className="muted">{block.city}</div>}
      </div>
    </div>
  );
}

type OverlayState =
  | { type: "palette"; kind: ItineraryBlockKind }
  | { type: "city"; city: string }
  | { type: "block"; title: string }
  | null;

export function CalendarPage() {
  const { userId: viewerId, accentColor, editMode, requestEditMode, exitEditMode } = useTrip();
  const { userId: paramId } = useParams();
  const ownerId = paramId ?? viewerId ?? "";

  const isOwn = Boolean(viewerId && ownerId === viewerId);
  const canEdit = isOwn && editMode;

  const [tripStart, setTripStart] = useState(defaultTripStartDate());
  const [numDays, setNumDays] = useState(21);
  const [blocks, setBlocks] = useState<ItineraryBlock[]>([]);
  const [customCities, setCustomCities] = useState<string[]>(() => readCustomCities());
  const [selectedCity, setSelectedCity] = useState("Tokyo");
  const [addCityInput, setAddCityInput] = useState("");
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<UserChip[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [modalBlock, setModalBlock] = useState<ItineraryBlock | null>(null);
  const [overlay, setOverlay] = useState<OverlayState>(null);
  const [placedAnimId, setPlacedAnimId] = useState<string | null>(null);

  const allCities = useMemo(
    () => [...new Set([...DEFAULT_CITIES, ...customCities])],
    [customCities],
  );

  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  const pendingDraftRef = useRef(new Set<string>());
  const lastPointer = useRef({ x: 0, y: 0 });
  const pointerCleanup = useRef<(() => void) | null>(null);
  const dayBodyRefs = useRef(new Map<string, HTMLDivElement>());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const days = useMemo(() => tripDayStrings(tripStart, numDays), [tripStart, numDays]);

  const writeItinerary = useCallback(
    async (nextBlocks: ItineraryBlock[], ts: string, nd: number) => {
      if (!ownerId || !canEdit) return;
      await setDoc(
        doc(getDb(), "itineraries", ownerId),
        {
          ownerId,
          tripStartDate: ts,
          numDays: nd,
          blocks: nextBlocks,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    },
    [ownerId, canEdit],
  );

  useEffect(() => {
    if (days.length && !activeDay) setActiveDay(days[0]!);
  }, [days, activeDay]);

  useEffect(() => {
    if (!ownerId) return;
    const r = doc(getDb(), "itineraries", ownerId);
    return onSnapshot(r, (snap) => {
      if (!snap.exists()) {
        setTripStart(defaultTripStartDate());
        setNumDays(21);
        const pending = pendingDraftRef.current;
        const prev = blocksRef.current;
        const drafts = prev.filter((b) => pending.has(b.id));
        setBlocks(drafts);
        return;
      }
      const d = snap.data() as ItineraryDoc;
      setTripStart(d.tripStartDate || defaultTripStartDate());
      if (typeof d.numDays === "number") setNumDays(d.numDays);
      const serverBlocks = Array.isArray(d.blocks) ? d.blocks : [];
      const pending = pendingDraftRef.current;
      const prev = blocksRef.current;
      const drafts = prev.filter((b) => pending.has(b.id));
      const merged = [...serverBlocks.filter((b) => !pending.has(b.id)), ...drafts];
      setBlocks(merged);
    });
  }, [ownerId]);

  useEffect(() => {
    return onSnapshot(collection(getDb(), "users"), (snap) => {
      const rows: UserChip[] = [];
      snap.forEach((d) => {
        const x = d.data() as { displayName?: string; color?: string };
        rows.push({
          id: d.id,
          displayName: x.displayName || "Friend",
          color: x.color || "#64748b",
        });
      });
      rows.sort((a, b) => a.displayName.localeCompare(b.displayName));
      setProfiles(rows);
    });
  }, []);

  const applyDrag = useCallback(
    (blockId: string, deltaY: number) => {
      const deltaMin = snapMinutes(Math.round(deltaY / PX_PER_MIN));
      if (deltaMin === 0) return;
      setBlocks((prev) => {
        const idx = prev.findIndex((b) => b.id === blockId);
        if (idx === -1) return prev;
        const b = prev[idx]!;
        const s = b.start.toDate().getTime() + deltaMin * 60_000;
        const e = b.end.toDate().getTime() + deltaMin * 60_000;
        if (e <= s) return prev;
        const copy = [...prev];
        copy[idx] = {
          ...b,
          start: Timestamp.fromDate(new Date(s)),
          end: Timestamp.fromDate(new Date(e)),
        };
        void writeItinerary(copy, tripStart, numDays);
        return copy;
      });
    },
    [writeItinerary, tripStart, numDays],
  );

  function pointerToGridMinutes(dayStr: string): number {
    const el = dayBodyRefs.current.get(dayStr);
    if (!el) return gridMinutesForAbsoluteMinutes(10 * 60);
    const y = lastPointer.current.y;
    const r = el.getBoundingClientRect();
    const rel = Math.max(0, Math.min(r.height, y - r.top));
    let minutes = rel / PX_PER_MIN;
    minutes = snapMinutes(Math.round(minutes));
    const maxG = (DAY_END_HOUR - DAY_START_HOUR) * 60 - 15;
    return Math.max(0, Math.min(maxG, minutes));
  }

  function attachPointerTracking() {
    const move = (e: PointerEvent) => {
      lastPointer.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("pointermove", move, { passive: true });
    pointerCleanup.current = () => window.removeEventListener("pointermove", move);
  }

  function onDragStart(e: DragStartEvent) {
    const a = e.activatorEvent;
    if (a && "clientX" in a) {
      lastPointer.current = { x: a.clientX, y: a.clientY };
    }
    attachPointerTracking();
    const id = String(e.active.id);
    if (id.startsWith("palette:")) {
      const kind = id.slice(8) as ItineraryBlockKind;
      setOverlay({ type: "palette", kind });
    } else if (id.startsWith("city:")) {
      const city = decodeURIComponent(id.slice(5));
      setOverlay({ type: "city", city });
    } else if (id.includes("|")) {
      const bid = id.split("|")[0]!;
      const b = blocksRef.current.find((x) => x.id === bid);
      setOverlay({ type: "block", title: b?.title ?? "Event" });
    } else setOverlay(null);
  }

  function onDragEnd(e: DragEndEvent) {
    pointerCleanup.current?.();
    pointerCleanup.current = null;
    setOverlay(null);

    if (!canEdit) return;

    const activeId = String(e.active.id);
    const overId = e.over?.id != null ? String(e.over.id) : "";

    if (activeId.startsWith("palette:") && overId.startsWith("day:")) {
      const kind = activeId.slice(8) as ItineraryBlockKind;
      const dayStr = overId.slice(4);
      const gridMin = pointerToGridMinutes(dayStr);
      const nb = createBlockForKind(kind, dayStr, gridMin, selectedCity, accentColor);
      setBlocks((prev) => [...prev, nb]);
      pendingDraftRef.current.add(nb.id);
      setPlacedAnimId(nb.id);
      window.setTimeout(() => setPlacedAnimId((id) => (id === nb.id ? null : id)), 450);
      setModalBlock(nb);
      return;
    }

    if (activeId.startsWith("city:") && overId.startsWith("day:")) {
      const city = decodeURIComponent(activeId.slice(5));
      const dayStr = overId.slice(4);
      const gridMin = pointerToGridMinutes(dayStr);
      const nb = createCityExploreBlock(dayStr, gridMin, city, accentColor);
      setBlocks((prev) => [...prev, nb]);
      pendingDraftRef.current.add(nb.id);
      setPlacedAnimId(nb.id);
      window.setTimeout(() => setPlacedAnimId((id) => (id === nb.id ? null : id)), 450);
      setModalBlock(nb);
      return;
    }

    if (activeId.includes("|")) {
      const [blockId] = activeId.split("|");
      if (blockId) applyDrag(blockId, e.delta.y);
    }
  }

  function addCustomCity() {
    const t = addCityInput.trim();
    if (!t) return;
    const existing = allCities.find((c) => c.toLowerCase() === t.toLowerCase());
    if (existing) {
      setSelectedCity(existing);
      setAddCityInput("");
      return;
    }
    const nextCustom = [...customCities, t];
    setCustomCities(nextCustom);
    try {
      localStorage.setItem(CITY_LS, JSON.stringify(nextCustom));
    } catch {
      /* ignore */
    }
    setSelectedCity(t);
    setAddCityInput("");
  }

  function updateTripStart(next: string) {
    setTripStart(next);
    if (canEdit) void writeItinerary(blocks, next, numDays);
  }

  function updateNumDays(n: number) {
    const v = Math.max(3, Math.min(45, n));
    setNumDays(v);
    if (canEdit) void writeItinerary(blocks, tripStart, v);
  }

  function discardModal() {
    if (modalBlock && pendingDraftRef.current.has(modalBlock.id)) {
      pendingDraftRef.current.delete(modalBlock.id);
      setBlocks((prev) => prev.filter((b) => b.id !== modalBlock.id));
    }
    setModalBlock(null);
  }

  function saveModal() {
    if (!modalBlock || !canEdit) return;
    pendingDraftRef.current.delete(modalBlock.id);
    const next = blocks.map((b) => (b.id === modalBlock.id ? modalBlock : b));
    setBlocks(next);
    void writeItinerary(next, tripStart, numDays);
    setModalBlock(null);
  }

  function deleteModal() {
    if (!modalBlock || !canEdit) return;
    pendingDraftRef.current.delete(modalBlock.id);
    const next = blocks.filter((b) => b.id !== modalBlock.id);
    setBlocks(next);
    void writeItinerary(next, tripStart, numDays);
    setModalBlock(null);
  }

  function patchModalTime(which: "start" | "end", hh: number, mm: number) {
    if (!modalBlock) return;
    const src = which === "start" ? modalBlock.start.toDate() : modalBlock.end.toDate();
    const p = toTokyoParts(src);
    const nd = jstDateTimeToUtc(p.y, p.m, p.day, hh, mm);
    setModalBlock({
      ...modalBlock,
      [which]: Timestamp.fromDate(nd),
    });
  }

  if (!viewerId || !ownerId) {
    return <div className="card">Sign in and unlock the trip to view calendars.</div>;
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Itinerary</h1>
      <p className="muted">
        Times are shown in Japan (JST, UTC+9). Drag activity chips or city chips onto a day column; drop snaps to the grid and opens the editor.{" "}
        {isOwn ? (
          <>
            {editMode ? (
              <span>
                Editing enabled.{" "}
                <button type="button" className="btn ghost" onClick={() => exitEditMode()}>
                  Done editing
                </button>
              </span>
            ) : (
              <span>
                View-only for your plan.{" "}
                <button type="button" className="btn secondary" onClick={() => setEditOpen(true)}>
                  Enable editing (password)
                </button>
              </span>
            )}
          </>
        ) : (
          <span>
            Viewing <strong>{profiles.find((p) => p.id === ownerId)?.displayName ?? "friend"}</strong>
            ’s calendar (read-only).
          </span>
        )}
      </p>

      <div className="calendar-toolbar card">
        <label className="muted row">
          Trip start
          <input
            type="date"
            value={tripStart}
            disabled={!canEdit}
            onChange={(e) => updateTripStart(e.target.value)}
          />
        </label>
        <label className="muted row">
          Days
          <input
            type="number"
            min={3}
            max={45}
            value={numDays}
            disabled={!canEdit}
            onChange={(e) => updateNumDays(Number(e.target.value))}
          />
        </label>
        <p className="calendar-toolbar__hint">
          <strong>Activities</strong> — drag onto a day. Uses the selected city for shrine / hotel labels.{" "}
          <strong>Cities</strong> — drag onto a day for a quick “Explore …” block; click a city to select it for new activities.
        </p>
        <div className="palette-row">
          {KIND_ORDER.map((k) => (
            <PaletteChip key={k} kind={k} disabled={!canEdit} />
          ))}
        </div>
        <div className="city-row">
          {allCities.map((c) => (
            <CityChipDraggable
              key={c}
              city={c}
              selected={selectedCity === c}
              disabled={!canEdit}
              onSelect={() => setSelectedCity(c)}
            />
          ))}
          <div className="city-row__add">
            <input
              type="text"
              placeholder="Add city"
              value={addCityInput}
              disabled={!canEdit}
              onChange={(e) => setAddCityInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCustomCity()}
            />
            <button type="button" className="btn secondary" disabled={!canEdit} onClick={addCustomCity}>
              Add
            </button>
          </div>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="calendar-grid">
          {days.map((dayStr) => (
            <div
              key={dayStr}
              className={`day-col${activeDay === dayStr ? " day-col--active" : ""}`}
            >
              <button
                type="button"
                className="day-col__header"
                onClick={() => setActiveDay(dayStr)}
              >
                <h4>{dayStr}</h4>
              </button>
              <DayDropZone
                dayStr={dayStr}
                canEdit={canEdit}
                heightPx={DAY_BODY_PX}
                dayBodyRefs={dayBodyRefs}
              >
                {Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => {
                  const hour = DAY_START_HOUR + i;
                  const top = i * 60 * PX_PER_MIN;
                  return (
                    <div key={hour} className="hour-line" style={{ top }}>
                      {hour}:00
                    </div>
                  );
                })}
                {blocks.map((b) => {
                  const seg = blockSegmentsForDay(b.start.toDate(), b.end.toDate(), dayStr);
                  if (!seg) return null;
                  return (
                    <BlockSegmentView
                      key={`${b.id}-${dayStr}`}
                      block={b}
                      dayStr={dayStr}
                      fromMin={seg.fromMin}
                      toMin={seg.toMin}
                      canEdit={canEdit}
                      placedAnim={placedAnimId === b.id}
                      onBodyClick={() => canEdit && setModalBlock(b)}
                    />
                  );
                })}
              </DayDropZone>
            </div>
          ))}
        </div>

        <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.25,1,0.5,1)" }}>
          {overlay?.type === "palette" && (
            <div className="palette-chip palette-chip--ghost">{KIND_LABELS[overlay.kind]}</div>
          )}
          {overlay?.type === "city" && (
            <div className="city-chip palette-chip--ghost">{overlay.city}</div>
          )}
          {overlay?.type === "block" && (
            <div className="palette-chip palette-chip--ghost">{overlay.title}</div>
          )}
        </DragOverlay>
      </DndContext>

      <div className="others-strip">
        <h3>Everyone’s calendars</h3>
        <p className="muted">Open a friend’s plan (read-only). Edit your own after entering the password.</p>
        <div className="chip-row">
          {profiles.map((p) => (
            <Link key={p.id} to={`/calendar/${p.id}`} className="chip">
              <span className="dot" style={{ background: p.color }} />
              {p.displayName}
              {p.id === viewerId ? " (you)" : ""}
            </Link>
          ))}
        </div>
      </div>

      <EditModeModal
        open={editOpen}
        title="Enable calendar editing"
        onClose={() => setEditOpen(false)}
        onConfirm={(pw) => requestEditMode(pw)}
      />

      {modalBlock && canEdit && (
        <div className="modal-backdrop" role="presentation" onClick={() => discardModal()}>
          <div
            className="modal"
            role="dialog"
            aria-modal
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Edit block</h3>
            <div className="stack">
              <label className="muted">Title</label>
              <input
                type="text"
                value={modalBlock.title}
                onChange={(e) => setModalBlock({ ...modalBlock, title: e.target.value })}
              />
              <label className="muted">City</label>
              <input
                type="text"
                value={modalBlock.city}
                onChange={(e) => setModalBlock({ ...modalBlock, city: e.target.value })}
              />
              <label className="muted">Notes</label>
              <textarea
                value={modalBlock.notes}
                onChange={(e) => setModalBlock({ ...modalBlock, notes: e.target.value })}
              />
              {modalBlock.kind === "transit" && (
                <>
                  <label className="muted">From station</label>
                  <input
                    type="text"
                    value={modalBlock.stationFrom ?? ""}
                    onChange={(e) =>
                      setModalBlock({ ...modalBlock, stationFrom: e.target.value })
                    }
                  />
                  <label className="muted">To station</label>
                  <input
                    type="text"
                    value={modalBlock.stationTo ?? ""}
                    onChange={(e) =>
                      setModalBlock({ ...modalBlock, stationTo: e.target.value })
                    }
                  />
                </>
              )}
              <label className="muted">Start (JST)</label>
              <input
                type="time"
                value={formatJstTime(modalBlock.start.toDate())}
                onChange={(e) => {
                  const [hh, mm] = e.target.value.split(":").map(Number);
                  patchModalTime("start", hh, mm);
                }}
              />
              <label className="muted">End (JST)</label>
              <input
                type="time"
                value={formatJstTime(modalBlock.end.toDate())}
                onChange={(e) => {
                  const [hh, mm] = e.target.value.split(":").map(Number);
                  patchModalTime("end", hh, mm);
                }}
              />
              <label className="muted">Color</label>
              <input
                type="color"
                value={modalBlock.color}
                onChange={(e) => setModalBlock({ ...modalBlock, color: e.target.value })}
              />
              <div className="row">
                <button type="button" className="btn danger" onClick={() => void deleteModal()}>
                  Delete
                </button>
                <button type="button" className="btn secondary" onClick={() => discardModal()}>
                  Cancel
                </button>
                <button type="button" className="btn" onClick={() => saveModal()}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
