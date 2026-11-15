import React from 'react';
import ReactDOM from 'react-dom/client';
import { Theme } from '@astryxdesign/core/theme';
import App from './App.jsx';
import { databridgeTheme } from './themes/databridge.js';

// layers.css declares the cascade-layer order and MUST come first: bundlers
// hoist CSS @import content above inline rules.
import './layers.css';
import './globals.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Theme theme={databridgeTheme} mode="dark">
      <App />
    </Theme>
  </React.StrictMode>,
);
