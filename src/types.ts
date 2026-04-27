import type { Timestamp } from "firebase/firestore";

export type PostType = "photo" | "warning" | "update" | "food";

export interface TripUser {
  displayName: string;
  color: string;
  updatedAt?: Timestamp;
}

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  imageUrls: string[];
  createdAt: Timestamp;
  type: PostType;
}

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: Timestamp;
}

export interface Reaction {
  id: string;
  emoji: string;
  userId: string;
  userName: string;
}

export type ItineraryBlockKind =
  | "hotel"
  | "transit"
  | "shrine"
  | "wander"
  | "food"
  | "custom";

export interface ItineraryBlock {
  id: string;
  kind: ItineraryBlockKind;
  title: string;
  city: string;
  start: Timestamp;
  end: Timestamp;
  color: string;
  notes: string;
  stationFrom?: string;
  stationTo?: string;
}

/** Stable city entry for tints, presets, and optional day split UI. */
export interface CityEntry {
  id: string;
  name: string;
  color: string;
}

/** Per-day “where am I” for morning / evening; null = infer from events. */
export type DayCitySplit = {
  morningCityId: string | null;
  eveningCityId: string | null;
};

export type DaySegmentsMap = Record<string, DayCitySplit>;

export interface ItineraryDoc {
  ownerId: string;
  tripStartDate: string;
  numDays?: number;
  blocks: ItineraryBlock[];
  /** Optional catalog; if missing, client derives from legacy block.city strings. */
  cities?: CityEntry[];
  /** Optional manual AM/PM city for gradient backgrounds. */
  daySegments?: DaySegmentsMap;
}
