import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

import { ClerkProvider } from '@clerk/clerk-react';

// SeeWhy LIVE - Check for Clerk key, render without auth if not available
const PUBLISHABLE_KEY = process.env.REACT_APP_CLERK_PUBLISHABLE_KEY;

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

// Render with or without Clerk based on key availability
if (PUBLISHABLE_KEY && PUBLISHABLE_KEY.startsWith('pk_')) {
  root.render(
    <React.StrictMode>
      <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
        <App />
      </ClerkProvider>
    </React.StrictMode>
  );
} else {
  // Preview mode - render without Clerk auth
  console.log('[SeeWhy LIVE] Running in preview mode without authentication');
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

// Performance monitoring
reportWebVitals();
