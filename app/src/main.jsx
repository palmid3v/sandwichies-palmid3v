import "./index.css";
import "./styles/motion.css";
import React from "react";
import ReactDOM from "react-dom/client";
import AppRoutes from "./AppRoutes";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppRoutes />
  </React.StrictMode>,
);
