import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./override-styles.css";
import { forceDarkInputs } from "./force-dark-inputs";

// Force dark input styling immediately
forceDarkInputs();

createRoot(document.getElementById("root")!).render(<App />);
