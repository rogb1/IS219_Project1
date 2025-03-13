import React from 'react';
import { createRoot } from 'react-dom/client'; // Import createRoot from react-dom/client
import App from './App';
import './index.css'; // Import index.css

const root = createRoot(document.getElementById('root')); // Create a root

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);