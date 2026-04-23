import { create } from 'zustand';
import { UserAccount, WindowMessage } from '../shared/types';
import { onMessage } from '../background/messaging';

interface AuthState {
  user: UserAccount | null;
  isOriginLinked: boolean;
  isLoggedIn: boolean;
  init: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isOriginLinked: false,
  isLoggedIn: false,

  init: () => {
    onMessage('AUTH_STATE_CHANGE', (msg: WindowMessage) => {
      const account = msg.payload as UserAccount | null;
      set({
        user: account,
        isOriginLinked: Boolean(account?.originVerified),
        isLoggedIn: Boolean(account?.loginProvider),
      });
    });

    onMessage('ORIGIN_DETECTED', (msg: WindowMessage) => {
      const data = msg.payload as { name: string; uid: string };
      set(state => ({
        user: state.user ? { ...state.user, originName: data.name, originUid: data.uid, originVerified: true } : null,
        isOriginLinked: true,
      }));
    });
  },
}));
