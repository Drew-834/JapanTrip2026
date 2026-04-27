import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { Link } from "react-router-dom";
import { getDb } from "@/lib/firebase";
import { blockSegmentsForDay, tripDayStrings, tripStartDateFromDoc, safeNumTripDays } from "@/lib/time";
import type { ItineraryBlock, ItineraryDoc } from "@/types";

const PREVIEW_DAYS = 7;

type Chip = { id: string; displayName: string; color: string };

type Props = {
  profiles: Chip[];
  viewerId: string;
};

function useFriendWeekDensity(userId: string): { bars: number[]; loaded: boolean } {
  const [bars, setBars] = useState<number[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const r = doc(getDb(), "itineraries", userId);
    return onSnapshot(r, (snap) => {
      if (!snap.exists()) {
        setBars(Array(PREVIEW_DAYS).fill(0));
        setLoaded(true);
        return;
      }
      const d = snap.data() as ItineraryDoc;
      const tripStart = tripStartDateFromDoc(d.tripStartDate);
      const n = safeNumTripDays(d.numDays ?? 21);
      const days = tripDayStrings(tripStart, n);
      const startIdx = 0;
      const slice = days.slice(startIdx, startIdx + PREVIEW_DAYS);
      const blocks: ItineraryBlock[] = Array.isArray(d.blocks) ? d.blocks : [];
      const counts = slice.map((dayStr) => {
        let c = 0;
        for (const b of blocks) {
          if (blockSegmentsForDay(b.start.toDate(), b.end.toDate(), dayStr)) c += 1;
        }
        return c;
      });
      if (slice.length < PREVIEW_DAYS) {
        while (counts.length < PREVIEW_DAYS) counts.push(0);
      }
      setBars(counts.slice(0, PREVIEW_DAYS));
      setLoaded(true);
    });
  }, [userId]);

  return { bars, loaded };
}

function MiniWeekPreview({ userId, accentColor }: { userId: string; accentColor: string }) {
  const { bars, loaded } = useFriendWeekDensity(userId);
  if (!loaded) {
    return <span className="friend-preview__loading" />;
  }
  return (
    <div className="friend-preview" aria-hidden>
      {bars.map((n, i) => (
        <div
          key={i}
          className="friend-preview__bar"
          style={{
            height: Math.min(20, 4 + n * 5),
            background: n > 0 ? accentColor : "rgb(0 0 0 / 12%)",
            opacity: n > 0 ? 0.7 + Math.min(0.25, n * 0.05) : 0.5,
          }}
        />
      ))}
    </div>
  );
}

export function FriendsCalendarsStrip({ profiles, viewerId }: Props) {
  return (
    <div className="others-strip">
      <h3>Everyone’s calendars</h3>
      <p className="muted">
        First week preview (activity count per day, before trip start if trip is in the future). Open a
        plan — read-only for friends; only you can change your own after the password.
      </p>
      <div className="chip-row friend-chip-grid">
        {profiles.map((p) => (
          <Link
            key={p.id}
            to={`/calendar/${p.id}`}
            className="chip friend-chip"
            style={{ textDecoration: "none" }}
          >
            <span className="dot" style={{ background: p.color }} />
            <div className="friend-chip__label">
              <span>
                {p.displayName}
                {p.id === viewerId ? " (you)" : ""}
              </span>
              <MiniWeekPreview userId={p.id} accentColor={p.color} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
