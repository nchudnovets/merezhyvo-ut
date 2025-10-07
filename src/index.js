// src/index.js
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Apply UI mode (affects CSS via [data-mode] on <html>)
function applyMode(mode) {
  const m = mode === 'mobile' || mode === 'desktop' ? mode : 'desktop';
  document.documentElement.dataset.mode = m;
}

// initial mode from query (?mode=desktop|mobile)
const params = new URLSearchParams(location.search);
applyMode(params.get('mode') || 'desktop');

// mount React
const container = document.getElementById('root');
if (!container) {
  throw new Error('merezhyvo: missing root element');
}
const root = createRoot(container);
root.render(<App />);

// subscribe to mode changes from main via preload bridge
if (window.merezhyvo?.onMode) {
  window.merezhyvo.onMode((mode) => {
    try { applyMode(mode); } catch { /* no-op */ }
  });
}
