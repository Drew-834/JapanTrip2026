import { Timestamp } from "firebase/firestore";
import { HOTEL_CHECK_OUT_MIN, utcFromDayAndMinutes } from "@/lib/time";
import type { ItineraryBlock, ItineraryBlockKind } from "@/types";

export const DAY_BODY_PX = 720;
export const DAY_START_HOUR = 6;
export const DAY_END_HOUR = 24;
export const PX_PER_MIN = DAY_BODY_PX / ((DAY_END_HOUR - DAY_START_HOUR) * 60);

export const KIND_ORDER: ItineraryBlockKind[] = [
  "wander",
  "shrine",
  "transit",
  "food",
  "hotel",
  "custom",
];

export const KIND_LABELS: Record<ItineraryBlockKind, string> = {
  wander: "Wander",
  shrine: "Shrine",
  transit: "Transit",
  food: "Food",
  hotel: "Hotel",
  custom: "Custom 1h",
};

function nextDayStr(dayStr: string): string {
  const [y, m, d] = dayStr.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

function gridMinutesForAbsoluteMinutes(absMin: number): number {
  return absMin - DAY_START_HOUR * 60;
}

export function newBlockId(): string {
  return crypto.randomUUID();
}

export function createBlockForKind(
  kind: ItineraryBlockKind,
  dayStr: string,
  gridMinutes: number,
  city: string,
  blockColor: string,
): ItineraryBlock {
  const maxG = (DAY_END_HOUR - DAY_START_HOUR) * 60 - 15;
  const safeMin = Math.max(0, Math.min(gridMinutes, maxG));
  let title = "Block";
  const start: Date = utcFromDayAndMinutes(dayStr, safeMin);
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
    color: blockColor,
    notes: "",
    stationFrom: kind === "transit" ? "" : undefined,
    stationTo: kind === "transit" ? "" : undefined,
  };
}

export function createCityExploreBlock(
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

export function createQuickBlock(
  dayStr: string,
  gridMinutes: number,
  kind: ItineraryBlockKind,
  city: string,
  color: string,
): ItineraryBlock {
  return createBlockForKind(kind, dayStr, gridMinutes, city, color);
}
