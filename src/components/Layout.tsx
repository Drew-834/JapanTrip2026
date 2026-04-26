import { NavLink, Outlet } from "react-router-dom";
import { useTrip } from "@/context/TripContext";

export function Layout() {
  const { displayName, lock } = useTrip();

  return (
    <div className="app-shell">
      <nav className="top-nav">
        <NavLink to="/feed" className={({ isActive }) => (isActive ? "active" : "")}>
          Moments
        </NavLink>
        <NavLink to="/calendar" className={({ isActive }) => (isActive ? "active" : "")}>
          Calendar
        </NavLink>
        <span className="spacer" />
        <span className="pill">{displayName}</span>
        <button type="button" className="btn secondary" onClick={() => lock()}>
          Lock trip
        </button>
      </nav>
      <Outlet />
    </div>
  );
}
