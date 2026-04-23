import { create } from 'zustand';
import { UserAccount, WindowMessage } from '../shared/types';
import { onMessage } from '../background/messaging';

interface AuthState {
  user: UserAccount | null;
  isOriginLinked: boolean;
  isLoggedIn: boolean;
  setupComplete: boolean;
  init: () => void;
  completeSetup: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isOriginLinked: false,
  isLoggedIn: false,
  setupComplete: localStorage.getItem('apexpulse_setup_complete') === 'true',

  init: () => {
    onMessage('AUTH_STATE_CHANGE', (msg: WindowMessage) => {
      const account = msg.payload as UserAccount | null;
      const originLinked = Boolean(account?.originVerified);
      if (originLinked) {
        localStorage.setItem('apexpulse_setup_complete', 'true');
      }
      set({
        user: account,
        isOriginLinked: originLinked,
        isLoggedIn: Boolean(account?.loginProvider),
        ...(originLinked ? { setupComplete: true } : {}),
      });
    });

    onMessage('ORIGIN_DETECTED', (msg: WindowMessage) => {
      const data = msg.payload as { name: string; uid: string };
      localStorage.setItem('apexpulse_setup_complete', 'true');
      set(state => ({
        user: state.user ? { ...state.user, originName: data.name, originUid: data.uid, originVerified: true } : null,
        isOriginLinked: true,
        setupComplete: true,
      }));
    });
  },

  completeSetup: () => {
    localStorage.setItem('apexpulse_setup_complete', 'true');
    set({ setupComplete: true });
  },
}));
