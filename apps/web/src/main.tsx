import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/rubik/index.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/cinzel/900.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/screens.css';
import './styles/games.css';
import { App } from './App';
import { applyDocumentSettings } from './i18n';
import { registerServiceWorker } from './pwa';

applyDocumentSettings();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
registerServiceWorker();
