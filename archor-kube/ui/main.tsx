import React from "react";
import ReactDOM from "react-dom/client";
import { AppRoot } from "@dynatrace/strato-components/core";
import { BrowserRouter } from "react-router-dom";
import { detectLookups } from "./app/templates/lookups";

const root = ReactDOM.createRoot(document.getElementById("root")!);

// Las consultas se arman al cargar sus módulos y dependen de qué tablas lookup
// existen (dueños, precios). Por eso la app se importa recién después de
// detectarlas: un par de consultas cortas antes del primer render.
void detectLookups().then(async () => {
  const { App } = await import("./app/App");
  root.render(
    <AppRoot>
      <BrowserRouter basename="ui">
        <App />
      </BrowserRouter>
    </AppRoot>,
  );
});
