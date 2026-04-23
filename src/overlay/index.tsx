import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '../index.css';
import { useLiveStore } from '../stores/liveStore';

useLiveStore.getState().init();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
