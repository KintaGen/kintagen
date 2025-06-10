// src/index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // This line is vital for Tailwind
import App from './App';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);