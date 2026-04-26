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

export interface ItineraryDoc {
  ownerId: string;
  tripStartDate: string;
  numDays?: number;
  blocks: ItineraryBlock[];
}
