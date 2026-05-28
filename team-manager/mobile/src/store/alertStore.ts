import { create } from 'zustand';

export interface AlertButton {
  text?: string;
  onPress?: (value?: string) => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export type ToastVariant = 'card' | 'minimal';
export type ToastStatus = 'success' | 'error' | 'info';

export interface ToastConfig {
  id: string;
  title: string;
  message?: string;
  variant: ToastVariant;
  status: ToastStatus;
  duration?: number;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export interface DialogConfig {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  isPrompt?: boolean;
  promptPlaceholder?: string;
  promptCallback?: (value: string) => void;
}

interface AlertState {
  toasts: ToastConfig[];
  activeDialog: DialogConfig | null;
  addToast: (toast: Omit<ToastConfig, 'id'>) => void;
  removeToast: (id: string) => void;
  showDialog: (dialog: DialogConfig) => void;
  hideDialog: () => void;
}

export const useAlertStore = create<AlertState>((set) => ({
  toasts: [],
  activeDialog: null,
  addToast: (toast) => {
    const id = Math.random().toString(36).substring(7);
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
  showDialog: (dialog) => set({ activeDialog: dialog }),
  hideDialog: () => set({ activeDialog: null }),
}));
