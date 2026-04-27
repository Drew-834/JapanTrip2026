import { blockSegmentsForDay, DAY_END_HOUR, DAY_START_HOUR } from "@/lib/time";
import type { CityEntry, DaySegmentsMap, ItineraryBlock } from "@/types";
import { cityColorByName } from "@/lib/cityCatalog";
import type { CSSProperties } from "react";

const MIX = 0.22; // transparency over surface

function blend(hex: string): string {
  if (!hex.startsWith("#") || (hex.length !== 7 && hex.length !== 4)) {
    return `color-mix(in srgb, ${hex} ${Math.round(MIX * 100)}%, transparent)`;
  }
  const r = hex.length === 7 ? parseInt(hex.slice(1, 3), 16) : parseInt(hex[1]! + hex[1]!, 16);
  const g = hex.length === 7 ? parseInt(hex.slice(3, 5), 16) : parseInt(hex[2]! + hex[2]!, 16);
  const b = hex.length === 7 ? parseInt(hex.slice(5, 7), 16) : parseInt(hex[3]! + hex[3]!, 16);
  return `rgb(${r} ${g} ${b} / ${MIX})`;
}

const MORNING_END = 14 * 60;

function dominantCityInWindow(
  blocks: ItineraryBlock[],
  dayStr: string,
  fromMin: number,
  toMin: number,
  cities: CityEntry[],
): string | undefined {
  let best: { c: string; w: number } | undefined;
  for (const b of blocks) {
    const seg = blockSegmentsForDay(b.start.toDate(), b.end.toDate(), dayStr);
    if (!seg) continue;
    const a = Math.max(fromMin, seg.fromMin);
    const c = Math.min(toMin, seg.toMin);
    if (c <= a) continue;
    const w = c - a;
    const col = b.city
      ? cityColorByName(cities, b.city) ?? b.color
      : b.color;
    if (!col) continue;
    if (!best || w > best.w) best = { c: col, w };
  }
  return best?.c;
}

/**
 * Background for a day column: transparent tint/gradient from events + optional day splits.
 */
export function dayColumnBackground(
  dayStr: string,
  blocks: ItineraryBlock[],
  cities: CityEntry[],
  daySegments: DaySegmentsMap | undefined,
): CSSProperties {
  const split = daySegments?.[dayStr];
  if (split) {
    const mCol =
      split.morningCityId && cities.find((c) => c.id === split.morningCityId)
        ? blend(cities.find((c) => c.id === split.morningCityId)!.color)
        : null;
    const eCol =
      split.eveningCityId && cities.find((c) => c.id === split.eveningCityId)
        ? blend(cities.find((c) => c.id === split.eveningCityId)!.color)
        : null;
    if (mCol && eCol && mCol !== eCol) {
      return {
        background: `linear-gradient(180deg, ${mCol} 0%, ${mCol} 48%, ${eCol} 52%, ${eCol} 100%)`,
      };
    }
    if (mCol) return { background: mCol };
    if (eCol) return { background: eCol };
  }

  const dayBlocks = blocks.filter((b) => {
    return blockSegmentsForDay(b.start.toDate(), b.end.toDate(), dayStr) != null;
  });
  if (dayBlocks.length === 0) {
    return { background: "transparent" };
  }

  const morningC = dominantCityInWindow(
    dayBlocks,
    dayStr,
    0,
    MORNING_END,
    cities,
  );
  const dayTotalMin = (DAY_END_HOUR - DAY_START_HOUR) * 60;
  const eveningC = dominantCityInWindow(
    dayBlocks,
    dayStr,
    MORNING_END,
    dayTotalMin,
    cities,
  );
  if (morningC && eveningC && morningC !== eveningC) {
    const pct = (MORNING_END / dayTotalMin) * 100;
    return {
      background: `linear-gradient(180deg, ${blend(morningC)} 0%, ${blend(morningC)} ${pct - 1}%, ${blend(eveningC)} ${pct + 1}%, ${blend(eveningC)} 100%)`,
    };
  }

  let best: { c: string; t: number } | undefined;
  for (const b of dayBlocks) {
    const seg = blockSegmentsForDay(b.start.toDate(), b.end.toDate(), dayStr);
    if (!seg) continue;
    const dur = seg.toMin - seg.fromMin;
    const col = b.city
      ? cityColorByName(cities, b.city) ?? b.color
      : b.color;
    if (!best || dur > best.t) best = { c: col, t: dur };
  }
  if (best) return { background: blend(best.c) };

  return { background: "transparent" };
}
