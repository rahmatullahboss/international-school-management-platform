import React from 'react';
import { createRoot } from 'react-dom/client';

function BootstrapPlaceholder(): React.JSX.Element {
  return (
    <main>
      <h1>International School Platform</h1>
      <p>Foundation workspace initialized.</p>
    </main>
  );
}

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element not found');
}

createRoot(root).render(
  <React.StrictMode>
    <BootstrapPlaceholder />
  </React.StrictMode>,
);
