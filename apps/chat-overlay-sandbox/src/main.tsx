import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import '@epam/ai-dial-ui-kit/styles.css';
import App from './app/app';
import './tailwind.css';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement,
);

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
