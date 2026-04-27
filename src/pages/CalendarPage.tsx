import {
  DndContext,
  DragOverlay,
  MouseSensor,
  PointerSensor,
  TouchSensor,
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { ActivityPalette } from "@/components/calendar/ActivityPalette";
import { BlockEditorModal } from "@/components/calendar/BlockEditorModal";
import { BlockSegment } from "@/components/calendar/BlockSegment";
import { DayDropZone } from "@/components/calendar/DayDropZone";
import { DaySplitDialog } from "@/components/calendar/DaySplitDialog";
import { FriendsCalendarsStrip } from "@/components/calendar/FriendsCalendarsStrip";
import { EditModeModal } from "@/components/EditModeModal";
import { useTrip } from "@/context/TripContext";
import {
  createBlockForKind,
  createCityExploreBlock,
  DAY_BODY_PX,
  KIND_LABELS,
  PX_PER_MIN,
} from "@/lib/calendarBlockFactory";
import { dayColumnBackground } from "@/lib/calendarDayStyle";
import {
  addCityNameToCatalog,
  buildCityCatalog,
  catalogFromDocOrLegacy,
} from "@/lib/cityCatalog";
import { getDb } from "@/lib/firebase";
import {
  blockSegmentsForDay,
  DAY_END_HOUR,
  DAY_START_HOUR,
  defaultTripStartDate,
  normalizeIsoDateString,
  safeNumTripDays,
  snapMinutes,
  tripStartDateFromDoc,
  tripDayStrings,
} from "@/lib/time";
import type {
  CityEntry,
  DayCitySplit,
  DaySegmentsMap,
  ItineraryBlock,
  ItineraryBlockKind,
  ItineraryDoc,
} from "@/types";

const CITY_LS = "japan-trip-city-presets";

type UserChip = { id: string; displayName: string; color: string };

type ModalState = { mode: "edit" | "view"; block: ItineraryBlock } | null;

type OverlayState =
  | { type: "palette"; kind: ItineraryBlockKind }
  | { type: "city"; city: string }
  | { type: "block"; title: string }
  | null;

function readCustomCityNamesFromLs(): string[] {
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

function saveCustomNamesToLs(names: string[]) {
  try {
    localStorage.setItem(CITY_LS, JSON.stringify(names));
  } catch {
    /* ignore */
  }
}

function gridMinutesForClientY(
  dayStr: string,
  clientY: number,
  dayBodyRefs: React.MutableRefObject<Map<string, HTMLDivElement>>,
): number {
  const el = dayBodyRefs.current.get(dayStr);
  if (!el) return 0;
  const r = el.getBoundingClientRect();
  const rel = Math.max(0, Math.min(r.height, clientY - r.top));
  let minutes = rel / PX_PER_MIN;
  minutes = snapMinutes(Math.round(minutes));
  const maxG = (DAY_END_HOUR - DAY_START_HOUR) * 60 - 15;
  return Math.max(0, Math.min(maxG, minutes));
}

export function CalendarPage() {
  const { userId: viewerId, accentColor, editMode, requestEditMode, exitEditMode } = useTrip();
  const { userId: paramId } = useParams();
  const ownerId = paramId ?? viewerId ?? "";

  const isOwn = Boolean(viewerId && ownerId === viewerId);
  const canEdit = isOwn && editMode;
  const canUsePalette = canEdit;

  const [tripStart, setTripStart] = useState(defaultTripStartDate());
  const [numDays, setNumDays] = useState(21);
  const [blocks, setBlocks] = useState<ItineraryBlock[]>([]);
  const [cities, setCities] = useState<CityEntry[]>(() =>
    buildCityCatalog(undefined, readCustomCityNamesFromLs()),
  );
  const [daySegments, setDaySegments] = useState<DaySegmentsMap>({});
  const [customNameInputs, setCustomNameInputs] = useState<string[]>(readCustomCityNamesFromLs());
  const [selectedActivityKind, setSelectedActivityKind] = useState<ItineraryBlockKind>("custom");
  const [selectedCity, setSelectedCity] = useState("Tokyo");
  const [addCityInput, setAddCityInput] = useState("");
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<UserChip[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [splitDay, setSplitDay] = useState<string | null>(null);
  const [splitDraft, setSplitDraft] = useState<DayCitySplit>({ morningCityId: null, eveningCityId: null });
  const [overlay, setOverlay] = useState<OverlayState>(null);
  const [placedAnimId, setPlacedAnimId] = useState<string | null>(null);
  const [postSaveHint, setPostSaveHint] = useState<string | null>(null);

  const allCityNames = useMemo(() => cities.map((c) => c.name), [cities]);

  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  const citiesRef = useRef(cities);
  citiesRef.current = cities;
  const daySegRef = useRef(daySegments);
  daySegRef.current = daySegments;
  const tripStartRef = useRef(tripStart);
  tripStartRef.current = tripStart;
  const numDaysRef = useRef(numDays);
  numDaysRef.current = numDays;
  const pendingDraftRef = useRef(new Set<string>());
  const lastPointer = useRef({ x: 0, y: 0 });
  const pointerCleanup = useRef<(() => void) | null>(null);
  const dayBodyRefs = useRef(new Map<string, HTMLDivElement>());

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const days = useMemo(() => tripDayStrings(tripStart, numDays), [tripStart, numDays]);

  const writeItinerary = useCallback(
    async (
      nextBlocks: ItineraryBlock[],
      ts: string,
      nd: number,
      nextCities: CityEntry[],
      nextSeg: DaySegmentsMap,
    ) => {
      if (!ownerId) return;
      if (!isOwn || !editMode) return;
      await setDoc(
        doc(getDb(), "itineraries", ownerId),
        {
          ownerId,
          tripStartDate: ts,
          numDays: nd,
          blocks: nextBlocks,
          cities: nextCities,
          daySegments: nextSeg,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    },
    [ownerId, isOwn, editMode],
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
        const next = catalogFromDocOrLegacy(
          { ownerId, tripStartDate: defaultTripStartDate(), blocks: [] },
          readCustomCityNamesFromLs(),
        );
        setCities(next);
        setDaySegments({});
        const pending = pendingDraftRef.current;
        const prev = blocksRef.current;
        setBlocks(prev.filter((b) => pending.has(b.id)));
        return;
      }
      const d = snap.data() as ItineraryDoc;
      setTripStart(tripStartDateFromDoc(d.tripStartDate));
      if (typeof d.numDays === "number" && Number.isFinite(d.numDays)) {
        setNumDays(safeNumTripDays(d.numDays));
      }
      const customFromLs = readCustomCityNamesFromLs();
      setCities(catalogFromDocOrLegacy(d, customFromLs));
      setCustomNameInputs(customFromLs);
      setDaySegments(
        d.daySegments && typeof d.daySegments === "object" ? (d.daySegments as DaySegmentsMap) : {},
      );
      const serverBlocks = Array.isArray(d.blocks) ? d.blocks : [];
      const pending = pendingDraftRef.current;
      const prev = blocksRef.current;
      const drafts = prev.filter((b) => pending.has(b.id));
      setBlocks([...serverBlocks.filter((b) => !pending.has(b.id)), ...drafts]);
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
        if (canEdit) {
          void writeItinerary(
            copy,
            tripStartRef.current,
            numDaysRef.current,
            citiesRef.current,
            daySegRef.current,
          );
        }
        return copy;
      });
    },
    [writeItinerary, canEdit],
  );

  const applyResize = useCallback(
    (blockId: string, deltaY: number) => {
      const deltaMin = snapMinutes(Math.round(deltaY / PX_PER_MIN));
      if (deltaMin === 0) return;
      setBlocks((prev) => {
        const idx = prev.findIndex((b) => b.id === blockId);
        if (idx === -1) return prev;
        const b = prev[idx]!;
        const s = b.start.toDate().getTime();
        const e = b.end.toDate().getTime() + deltaMin * 60_000;
        if (e <= s + 14 * 60_000) return prev;
        const copy = [...prev];
        copy[idx] = { ...b, end: Timestamp.fromDate(new Date(e)) };
        if (canEdit) {
          void writeItinerary(
            copy,
            tripStartRef.current,
            numDaysRef.current,
            citiesRef.current,
            daySegRef.current,
          );
        }
        return copy;
      });
    },
    [writeItinerary, canEdit],
  );

  function pointerToGridMinutes(dayStr: string): number {
    return gridMinutesForClientY(dayStr, lastPointer.current.y, dayBodyRefs);
  }

  function dayFromPointer(clientX: number, clientY: number): string | null {
    const el = document.elementFromPoint(clientX, clientY);
    const droppable = el?.closest<HTMLElement>("[data-day-dropzone]");
    if (droppable?.dataset.dayDropzone) return droppable.dataset.dayDropzone;

    for (const [dayStr, body] of dayBodyRefs.current.entries()) {
      const r = body.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
        return dayStr;
      }
    }
    return null;
  }

  function addBlockAt(dayStr: string, clientY: number, kind = selectedActivityKind) {
    if (!canUsePalette) return;
    const gridMin = gridMinutesForClientY(dayStr, clientY, dayBodyRefs);
    const col = cities.find((c) => c.name === selectedCity)?.color ?? accentColor;
    const nb = createBlockForKind(kind, dayStr, gridMin, selectedCity, col);
    setBlocks((prev) => [...prev, nb]);
    pendingDraftRef.current.add(nb.id);
    setPlacedAnimId(nb.id);
    window.setTimeout(() => setPlacedAnimId((id) => (id === nb.id ? null : id)), 450);
    setModal({ mode: "edit", block: nb });
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
    if (a instanceof PointerEvent || a instanceof MouseEvent) {
      lastPointer.current = { x: a.clientX, y: a.clientY };
    }
    attachPointerTracking();
    const id = String(e.active.id);
    if (id.startsWith("palette:")) {
      setOverlay({ type: "palette", kind: id.slice(8) as ItineraryBlockKind });
    } else if (id.startsWith("city:")) {
      setOverlay({ type: "city", city: decodeURIComponent(id.slice(5)) });
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
    let overId = e.over?.id != null ? String(e.over.id) : "";
    if (!overId) {
      const dayStr = dayFromPointer(lastPointer.current.x, lastPointer.current.y);
      if (dayStr) overId = `day:${dayStr}`;
    }

    if (activeId.startsWith("palette:") && overId.startsWith("day:")) {
      const kind = activeId.slice(8) as ItineraryBlockKind;
      const dayStr = overId.slice(4);
      const gridMin = pointerToGridMinutes(dayStr);
      const col = cities.find((c) => c.name === selectedCity)?.color ?? accentColor;
      const nb = createBlockForKind(kind, dayStr, gridMin, selectedCity, col);
      setBlocks((prev) => [...prev, nb]);
      pendingDraftRef.current.add(nb.id);
      setPlacedAnimId(nb.id);
      window.setTimeout(() => setPlacedAnimId((id) => (id === nb.id ? null : id)), 450);
      setModal({ mode: "edit", block: nb });
      return;
    }
    if (activeId.startsWith("city:") && overId.startsWith("day:")) {
      const city = decodeURIComponent(activeId.slice(5));
      const dayStr = overId.slice(4);
      const gridMin = pointerToGridMinutes(dayStr);
      const col = cities.find((c) => c.name === city)?.color ?? accentColor;
      const nb = createCityExploreBlock(dayStr, gridMin, city, col);
      setBlocks((prev) => [...prev, nb]);
      pendingDraftRef.current.add(nb.id);
      setPlacedAnimId(nb.id);
      window.setTimeout(() => setPlacedAnimId((id) => (id === nb.id ? null : id)), 450);
      setModal({ mode: "edit", block: nb });
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
    const next = addCityNameToCatalog(cities, t);
    setCities(next);
    const names = customNameInputs.includes(t) ? customNameInputs : [...customNameInputs, t];
    setCustomNameInputs(names);
    saveCustomNamesToLs(names);
    setSelectedCity(t);
    setAddCityInput("");
    if (canEdit) void writeItinerary(blocks, tripStart, numDays, next, daySegments);
  }

  function updateTripStart(next: string) {
    const ts = normalizeIsoDateString(next) ?? defaultTripStartDate();
    setTripStart(ts);
    if (canEdit) void writeItinerary(blocks, ts, numDays, cities, daySegments);
  }

  function updateNumDays(n: number) {
    const v = safeNumTripDays(n);
    setNumDays(v);
    if (canEdit) void writeItinerary(blocks, tripStart, v, cities, daySegments);
  }

  function discardModal() {
    if (modal?.mode === "view") {
      setModal(null);
      return;
    }
    if (modal?.mode === "edit" && pendingDraftRef.current.has(modal.block.id)) {
      pendingDraftRef.current.delete(modal.block.id);
      setBlocks((prev) => prev.filter((b) => b.id !== modal.block.id));
    }
    setModal(null);
  }

  function saveModal() {
    if (!modal || modal.mode !== "edit" || !canEdit) return;
    const mb = modal.block;
    pendingDraftRef.current.delete(mb.id);
    const next = blocks.map((b) => (b.id === mb.id ? mb : b));
    setBlocks(next);
    if (mb.kind === "hotel") {
      setPostSaveHint(
        `You’re staying in ${mb.city} overnight — the next morning is still in ${mb.city} until you travel. Add a transit (or shinkansen) block when you leave for the next city.`,
      );
    } else {
      setPostSaveHint(null);
    }
    void writeItinerary(next, tripStart, numDays, cities, daySegments);
    setModal(null);
  }

  function deleteModal() {
    if (!modal || modal.mode !== "edit" || !canEdit) return;
    const mb = modal.block;
    pendingDraftRef.current.delete(mb.id);
    const n = blocks.filter((b) => b.id !== mb.id);
    setBlocks(n);
    void writeItinerary(n, tripStart, numDays, cities, daySegments);
    setModal(null);
  }

  function openSplit(dayStr: string) {
    if (!canEdit) return;
    setSplitDay(dayStr);
    setSplitDraft(
      daySegments[dayStr] ?? { morningCityId: null, eveningCityId: null },
    );
  }

  function saveSplit() {
    if (!splitDay) return;
    const nextS = { ...daySegments, [splitDay]: splitDraft };
    setDaySegments(nextS);
    setSplitDay(null);
    if (canEdit) void writeItinerary(blocks, tripStart, numDays, cities, nextS);
  }

  if (!viewerId || !ownerId) {
    return <div className="card">Sign in and unlock the trip to view calendars.</div>;
  }

  return (
    <div>
      <h1 style={{ marginTop: 0 }}>Itinerary</h1>
      <p className="muted">
        Times in Japan (JST, UTC+9). Drag **activities** and **cities** onto days, or double-click empty
        time. Use **day tint** to set morning / evening cities.{" "}
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

      {postSaveHint && (
        <div className="calendar-hint card">
          {postSaveHint}
          <button type="button" className="btn ghost" onClick={() => setPostSaveHint(null)}>
            Dismiss
          </button>
        </div>
      )}

      {isOwn && !editMode && (
        <div className="calendar-edit-banner card">
          <strong>Editing is currently off.</strong>
          <span>Turn it on to click time slots, drag activities, resize blocks, or update day tints.</span>
          <button type="button" className="btn secondary" onClick={() => setEditOpen(true)}>
            Enable editing
          </button>
        </div>
      )}

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
        <ActivityPalette
          canUsePalette={canUsePalette}
          selectedActivityKind={selectedActivityKind}
          onSelectActivityKind={setSelectedActivityKind}
          allCityNames={allCityNames}
          selectedCity={selectedCity}
          onSelectCity={setSelectedCity}
          addCityInput={addCityInput}
          onAddCityInput={setAddCityInput}
          onAddCity={addCustomCity}
        />
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="calendar-grid">
          {days.map((dayStr) => {
            const dayBg = dayColumnBackground(dayStr, blocks, cities, daySegments);
            return (
              <div
                key={dayStr}
                className={`day-col${activeDay === dayStr ? " day-col--active" : ""}`}
              >
                <div className="day-col__head row">
                  <button
                    type="button"
                    className="day-col__header"
                    onClick={() => setActiveDay(dayStr)}
                  >
                    <h4>{dayStr}</h4>
                  </button>
                  {canEdit && (
                    <button
                      type="button"
                      className="day-col__tint"
                      title="Set morning / evening city tint for this day"
                      onClick={() => openSplit(dayStr)}
                    >
                        Tint
                    </button>
                  )}
                </div>
                <DayDropZone
                  dayStr={dayStr}
                  canEdit={canEdit}
                  heightPx={DAY_BODY_PX}
                  dayBodyStyle={dayBg}
                  dayBodyRefs={dayBodyRefs}
                  onBackgroundClick={(ds, y) => addBlockAt(ds, y)}
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
                      <BlockSegment
                        key={`${b.id}-${dayStr}`}
                        block={b}
                        dayStr={dayStr}
                        fromMin={seg.fromMin}
                        toMin={seg.toMin}
                        canEdit={canEdit}
                        placedAnim={placedAnimId === b.id}
                        onBodyClick={() => {
                          if (canEdit) setModal({ mode: "edit", block: b });
                          else setModal({ mode: "view", block: b });
                        }}
                        onResizeDelta={applyResize}
                      />
                    );
                  })}
                </DayDropZone>
              </div>
            );
          })}
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

      <FriendsCalendarsStrip profiles={profiles} viewerId={viewerId} />

      <EditModeModal
        open={editOpen}
        title="Enable calendar editing"
        onClose={() => setEditOpen(false)}
        onConfirm={(pw) => requestEditMode(pw)}
      />

      {splitDay && (
        <DaySplitDialog
          dayStr={splitDay}
          open
          cities={cities}
          value={splitDraft}
          onChange={setSplitDraft}
          onClose={() => setSplitDay(null)}
          onSave={saveSplit}
        />
      )}

      {modal && (
        <BlockEditorModal
          block={modal.block}
          readOnly={modal.mode === "view"}
          onChange={(b) => {
            if (modal.mode === "edit") setModal({ ...modal, block: b });
          }}
          onSave={saveModal}
          onDelete={deleteModal}
          onDiscard={discardModal}
        />
      )}

    </div>
  );
}
