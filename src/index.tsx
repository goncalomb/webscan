import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { SANEContextProvider } from './SANEContext';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <SANEContextProvider>
    <React.StrictMode>
      <App />
    </React.StrictMode>
  </SANEContextProvider>
);
