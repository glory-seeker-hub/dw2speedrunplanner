import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { logGameDataValidation } from "@/utils/dataValidation";

if (import.meta.env.DEV) {
  logGameDataValidation();
}

createRoot(document.getElementById("root")!).render(<App />);

