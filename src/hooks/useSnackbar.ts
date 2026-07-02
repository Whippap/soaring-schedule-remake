import { create } from 'zustand';

interface SnackbarState {
  message: string | null;
  show: (message: string) => void;
  dismiss: () => void;
}

export const useSnackbarStore = create<SnackbarState>((set) => ({
  message: null,
  show: (message) => set({ message }),
  dismiss: () => set({ message: null }),
}));

export function useSnackbar() {
  return useSnackbarStore((s) => s.show);
}
