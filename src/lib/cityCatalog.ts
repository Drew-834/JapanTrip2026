import type { CityEntry, ItineraryDoc } from "@/types";

const PALETTE = [
  "#2d5a4a",
  "#5b3a7d",
  "#b45309",
  "#0d9488",
  "#be185d",
  "#1d4ed8",
  "#64748b",
  "#4d7c0f",
];

function hash32(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

export const SEED_CITIES: CityEntry[] = [
  { id: "tokyo", name: "Tokyo", color: "#c45c48" },
  { id: "kyoto", name: "Kyoto", color: "#2d5a4a" },
  { id: "osaka", name: "Osaka", color: "#1d4ed8" },
  { id: "fukuoka", name: "Fukuoka", color: "#b45309" },
  { id: "hiroshima", name: "Hiroshima", color: "#5b3a7d" },
  { id: "nara", name: "Nara", color: "#0d9488" },
  { id: "kanazawa", name: "Kanazawa", color: "#be185d" },
];

export function idForNewCityName(name: string): string {
  return `c_${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "city"}_${hash32(name).toString(16).slice(0, 6)}`;
}

function colorForName(name: string): string {
  return PALETTE[hash32(name) % PALETTE.length]!;
}

/** Merge server catalog with seeds; add names from custom strings with stable ids. */
export function buildCityCatalog(
  server: CityEntry[] | undefined,
  extraNames: string[],
): CityEntry[] {
  const byId = new Map<string, CityEntry>();
  for (const c of SEED_CITIES) byId.set(c.id, c);
  for (const c of server ?? []) {
    if (c.id && c.name && c.color) byId.set(c.id, c);
  }
  for (const raw of extraNames) {
    const name = raw.trim();
    if (!name) continue;
    const has = [...byId.values()].some((c) => c.name.toLowerCase() === name.toLowerCase());
    if (has) continue;
    const id = idForNewCityName(name);
    byId.set(id, { id, name, color: colorForName(name) });
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function findCityIdByName(cities: CityEntry[], name: string): string | undefined {
  const t = name.trim().toLowerCase();
  return cities.find((c) => c.name.toLowerCase() === t)?.id;
}

export function cityColorByName(cities: CityEntry[], name: string): string | undefined {
  return cities.find((c) => c.name.toLowerCase() === name.trim().toLowerCase())?.color;
}

export function addCityNameToCatalog(cities: CityEntry[], name: string): CityEntry[] {
  const t = name.trim();
  if (!t) return cities;
  if (cities.some((c) => c.name.toLowerCase() === t.toLowerCase())) return cities;
  const id = idForNewCityName(t);
  return [...cities, { id, name: t, color: colorForName(t) }].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export function catalogFromDocOrLegacy(
  d: ItineraryDoc,
  customNamesFromLocal: string[],
): CityEntry[] {
  const fromBlocks = (Array.isArray(d.blocks) ? d.blocks : [])
    .map((b) => b.city)
    .filter((s): s is string => typeof s === "string" && s.trim().length > 0);
  const allNames = new Set([...fromBlocks, ...customNamesFromLocal]);
  return buildCityCatalog(d.cities, [...allNames]);
}
