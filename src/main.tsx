import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { TripProvider } from "@/context/TripContext";
import { initFirebaseAnalytics } from "@/lib/firebase";
import App from "@/App";
import "./index.css";

const basename = import.meta.env.BASE_URL.replace(/\/$/, "");

void initFirebaseAnalytics();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <TripProvider>
        <App />
      </TripProvider>
    </BrowserRouter>
  </StrictMode>,
);
