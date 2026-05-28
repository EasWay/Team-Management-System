import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Team {
  id: number;
  name: string;
  description?: string;
  role?: string;
  memberRole?: string;
}

const ACTIVE_TEAM_KEY = '@active_team_id';

interface TeamState {
  teams: Team[];
  activeTeam: Team | null;
  setTeams: (teams: Team[]) => void;
  setActiveTeam: (team: Team | null) => void;
  restoreActiveTeam: () => Promise<void>;
}

export const useTeamStore = create<TeamState>((set, get) => ({
  teams: [],
  activeTeam: null,

  setTeams: (teams) =>
    set((state) => {
      // Keep existing activeTeam if it's still in the new list
      const existing = state.activeTeam
        ? teams.find((t) => t.id === state.activeTeam!.id) ?? null
        : null;
      const activeTeam = existing ?? teams[0] ?? null;
      // Persist the selection
      if (activeTeam) {
        AsyncStorage.setItem(ACTIVE_TEAM_KEY, String(activeTeam.id)).catch(() => {});
      }
      return { teams, activeTeam };
    }),

  setActiveTeam: (team) => {
    if (team) {
      AsyncStorage.setItem(ACTIVE_TEAM_KEY, String(team.id)).catch(() => {});
    } else {
      AsyncStorage.removeItem(ACTIVE_TEAM_KEY).catch(() => {});
    }
    set({ activeTeam: team });
  },

  // Called on app boot — restores the previously selected team from the
  // already-loaded teams list using the persisted team ID.
  restoreActiveTeam: async () => {
    try {
      const saved = await AsyncStorage.getItem(ACTIVE_TEAM_KEY);
      if (!saved) return;
      const savedId = Number(saved);
      const { teams, activeTeam } = get();
      if (activeTeam?.id === savedId) return; // already correct
      const match = teams.find((t) => t.id === savedId);
      if (match) set({ activeTeam: match });
    } catch {
      // ignore storage errors
    }
  },
}));
