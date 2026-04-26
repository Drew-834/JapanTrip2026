const COOKIE = "trip_unlock";
const LS_UNLOCK = "trip_unlock";
const MAX_AGE_SEC = 60 * 60 * 24 * 45;

export function setUnlockCookie(): void {
  try {
    document.cookie = `${COOKIE}=1; path=/; max-age=${MAX_AGE_SEC}; SameSite=Lax`;
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(LS_UNLOCK, "1");
  } catch {
    /* ignore */
  }
}

export function clearUnlock(): void {
  try {
    document.cookie = `${COOKIE}=; path=/; max-age=0`;
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(LS_UNLOCK);
  } catch {
    /* ignore */
  }
}

export function isUnlocked(): boolean {
  try {
    if (localStorage.getItem(LS_UNLOCK) === "1") return true;
  } catch {
    /* ignore */
  }
  try {
    return document.cookie.split(";").some((c) => c.trim().startsWith(`${COOKIE}=`));
  } catch {
    return false;
  }
}

const EDIT_SESSION = "trip_edit_mode";

export function setEditModeSession(on: boolean): void {
  try {
    if (on) sessionStorage.setItem(EDIT_SESSION, "1");
    else sessionStorage.removeItem(EDIT_SESSION);
  } catch {
    /* ignore */
  }
}

export function isEditModeSession(): boolean {
  try {
    return sessionStorage.getItem(EDIT_SESSION) === "1";
  } catch {
    return false;
  }
}
