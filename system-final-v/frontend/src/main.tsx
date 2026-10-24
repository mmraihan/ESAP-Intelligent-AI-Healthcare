import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "./theme/ThemeProvider";
import { App } from "./App";
import { I18nProvider } from "./i18n";
import { boot } from "./api/bootstrap";
import { useSession } from "./lib/session";
import { installPointerGlow } from "./theme/interactions";
import "@fontsource-variable/dm-sans";
import "@fontsource-variable/jetbrains-mono";
import "./styles/app.css";
// Console component layer; must load after app.css so it wins at equal specificity.
import "./styles/console.css";
import "./styles/public.css";
// Product layer (assistant, glyphs, gauges, journey, phone tables); loads last.
import "./styles/premium.css";

installPointerGlow();

/**
 * Fill the data store before the first paint.
 *
 * `boot()` resolves either way — with live data from the API, or with the
 * bundled fixture when the backend is not reachable — so the render below is
 * never blocked by a server being down. A stored session is verified first, so
 * a revoked token never briefly paints a signed-in screen.
 */
boot()
  .then((result) => {
    if (result.session) useSession.getState().adoptSession(result.session);
    if (result.reason) console.info(`[esap] ${result.reason}`);
  })
  .finally(() => {
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <ThemeProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <I18nProvider>
              <App />
            </I18nProvider>
          </BrowserRouter>
        </ThemeProvider>
      </StrictMode>,
    );
  });
