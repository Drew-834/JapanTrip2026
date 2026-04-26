import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { ensureAnonymousUser, getDb, getFirebaseAuth } from "@/lib/firebase";
import {
  isEditModeSession,
  isUnlocked,
  setEditModeSession,
  setUnlockCookie,
  clearUnlock,
} from "@/lib/unlock";
import type { TripUser } from "@/types";

export const TRIP_PASSWORD = "JP2026";

const LS_NAME = "trip_display_name";
const LS_COLOR = "trip_accent_color";

const ACCENT_PRESETS = [
  "#c45c48",
  "#2d7d46",
  "#2563eb",
  "#7c3aed",
  "#ca8a04",
  "#0d9488",
  "#db2777",
];

function pickAccent(uid: string): string {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) >>> 0;
  return ACCENT_PRESETS[h % ACCENT_PRESETS.length];
}

type TripContextValue = {
  ready: boolean;
  error: string | null;
  unlocked: boolean;
  unlock: (password: string) => Promise<boolean>;
  lock: () => void;
  userId: string | null;
  displayName: string;
  accentColor: string;
  needsProfile: boolean;
  setLocalProfile: (name: string, color: string) => void;
  saveProfileToFirestore: (name: string, color: string) => Promise<void>;
  editMode: boolean;
  requestEditMode: (password: string) => boolean;
  exitEditMode: () => void;
};

const TripContext = createContext<TripContextValue | null>(null);

export function TripProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(() => isUnlocked());
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [accentColor, setAccentColor] = useState("#2563eb");
  const [needsProfile, setNeedsProfile] = useState(false);
  const [editMode, setEditMode] = useState(() => isEditModeSession());

  const hydrateProfile = useCallback(async (uid: string) => {
    let name = "";
    let color = pickAccent(uid);
    try {
      const cached = localStorage.getItem(LS_NAME);
      if (cached) name = cached;
      const c = localStorage.getItem(LS_COLOR);
      if (c) color = c;
    } catch {
      /* ignore */
    }

    try {
      const snap = await getDoc(doc(getDb(), "users", uid));
      if (snap.exists()) {
        const u = snap.data() as TripUser;
        if (u.displayName) name = u.displayName;
        if (u.color) color = u.color;
      }
    } catch {
      /* use cache */
    }

    setDisplayName(name);
    setAccentColor(color);
    try {
      if (name) localStorage.setItem(LS_NAME, name);
      localStorage.setItem(LS_COLOR, color);
    } catch {
      /* ignore */
    }
    setNeedsProfile(!name.trim());
  }, []);

  useEffect(() => {
    if (!unlocked) {
      setReady(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setError(null);
        await ensureAnonymousUser();
        const uid = getFirebaseAuth().currentUser?.uid ?? null;
        if (cancelled || !uid) {
          if (!cancelled) setError("Could not sign in anonymously.");
          setReady(true);
          return;
        }
        setUserId(uid);
        await hydrateProfile(uid);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Firebase initialization failed.");
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [unlocked, hydrateProfile]);

  const unlock = useCallback(async (password: string) => {
    if (password !== TRIP_PASSWORD) return false;
    setUnlockCookie();
    setUnlocked(true);
    setReady(false);
    try {
      await ensureAnonymousUser();
      const uid = getFirebaseAuth().currentUser?.uid ?? null;
      if (uid) {
        setUserId(uid);
        await hydrateProfile(uid);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setReady(true);
    }
    return true;
  }, [hydrateProfile]);

  const lock = useCallback(() => {
    clearUnlock();
    setUnlocked(false);
    setUserId(null);
    setDisplayName("");
    setNeedsProfile(false);
    setEditMode(false);
    setEditModeSession(false);
  }, []);

  const setLocalProfile = useCallback((name: string, color: string) => {
    setDisplayName(name);
    setAccentColor(color);
    try {
      localStorage.setItem(LS_NAME, name);
      localStorage.setItem(LS_COLOR, color);
    } catch {
      /* ignore */
    }
    setNeedsProfile(!name.trim());
  }, []);

  const saveProfileToFirestore = useCallback(
    async (name: string, color: string) => {
      if (!userId) return;
      const ref = doc(getDb(), "users", userId);
      await setDoc(
        ref,
        {
          displayName: name.trim(),
          color,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setLocalProfile(name, color);
    },
    [userId, setLocalProfile],
  );

  const requestEditMode = useCallback((password: string) => {
    if (password !== TRIP_PASSWORD) return false;
    setEditMode(true);
    setEditModeSession(true);
    return true;
  }, []);

  const exitEditMode = useCallback(() => {
    setEditMode(false);
    setEditModeSession(false);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      error,
      unlocked,
      unlock,
      lock,
      userId,
      displayName,
      accentColor,
      needsProfile,
      setLocalProfile,
      saveProfileToFirestore,
      editMode,
      requestEditMode,
      exitEditMode,
    }),
    [
      ready,
      error,
      unlocked,
      unlock,
      lock,
      userId,
      displayName,
      accentColor,
      needsProfile,
      setLocalProfile,
      saveProfileToFirestore,
      editMode,
      requestEditMode,
      exitEditMode,
    ],
  );

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

export function useTrip(): TripContextValue {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error("useTrip must be used within TripProvider");
  return ctx;
}
