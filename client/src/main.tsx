import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
// Fonts are bundled (not loaded from a CDN) so the display looks right offline at a venue.
import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/bricolage-grotesque/opsz.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import '@fontsource/instrument-serif/latin-400.css';
import '@fontsource/instrument-serif/latin-400-italic.css';
import './index.css';
import './styles/motion.css';
import './styles/console.css';
import { applyTheme, storedTheme } from './lib/theme';
import { applyStoredUiPrefs } from './lib/uiPrefs';

// Before the first paint, so the console never flashes the wrong colours.
applyTheme(storedTheme(), false);
applyStoredUiPrefs();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
