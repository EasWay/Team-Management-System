import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

const THEME_KEY = '@app_theme';

interface ThemeState {
  isDark: boolean;
  toggle: () => Promise<void>;
  load: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  isDark: true,

  toggle: async () => {
    const newValue = !get().isDark;
    set({ isDark: newValue });
    Appearance.setColorScheme(newValue ? 'dark' : 'light');
    try {
      await AsyncStorage.setItem(THEME_KEY, newValue ? 'dark' : 'light');
    } catch {}
  },

  load: async () => {
    try {
      const saved = await AsyncStorage.getItem(THEME_KEY);
      // Default to dark if no preference saved
      const isDark = saved === null ? true : saved !== 'light';
      set({ isDark });
      Appearance.setColorScheme(isDark ? 'dark' : 'light');
    } catch {}
  },
}));
