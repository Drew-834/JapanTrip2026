import { Navigate, Route, Routes } from "react-router-dom";
import { useTrip } from "@/context/TripContext";
import { Gate } from "@/components/Gate";
import { ProfileSetup } from "@/components/ProfileSetup";
import { Layout } from "@/components/Layout";
import { FeedPage } from "@/pages/FeedPage";
import { CalendarPage } from "@/pages/CalendarPage";

export default function App() {
  const { unlocked, ready, error, needsProfile } = useTrip();

  if (!unlocked) return <Gate />;

  if (!ready) return <div className="loading">Loading…</div>;

  if (error)
    return (
      <div className="app-shell">
        <div className="card err" style={{ color: "var(--danger)" }}>
          <strong>Setup needed:</strong> {error}
        </div>
      </div>
    );

  if (needsProfile) return <ProfileSetup />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/feed" replace />} />
        <Route path="/feed" element={<FeedPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/calendar/:userId" element={<CalendarPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/feed" replace />} />
    </Routes>
  );
}
