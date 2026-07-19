import { create } from 'zustand';

export interface User {
  id: number;
  username: string;
  role: 'presenter' | 'student';
}

interface AuthState {
  user: User | null;
  token: string | null;
  initialized: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  initialized: false,

  login: (user, token) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('token', token);
      sessionStorage.setItem('user', JSON.stringify(user));
    }
    set({ user, token, initialized: true });
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('user');
    }
    set({ user: null, token: null, initialized: true });
  },

  initialize: () => {
    if (typeof window !== 'undefined') {
      const token = sessionStorage.getItem('token');
      const userStr = sessionStorage.getItem('user');
      let user: User | null = null;
      
      if (userStr) {
        try {
          user = JSON.parse(userStr);
        } catch (e) {
          console.error('Failed to parse user from sessionStorage', e);
        }
      }

      set({ token, user, initialized: true });
    }
  }
}));
