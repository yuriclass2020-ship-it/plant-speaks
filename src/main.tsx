import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

function clearServiceWorkersAndCaches() {
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister();
      });
    })
    .catch(() => {
      // Cleanup is best-effort.
    });

  if ('caches' in window) {
    caches
      .keys()
      .then((keys) => {
        keys.forEach((key) => {
          caches.delete(key);
        });
      })
      .catch(() => {
        // Cache cleanup is best-effort.
      });
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    clearServiceWorkersAndCaches();
  });
}
