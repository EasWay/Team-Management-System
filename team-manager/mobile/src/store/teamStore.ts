import { create } from 'zustand';

export interface Team {
  id: number;
  name: string;
  description?: string;
  role?: string;
}

interface TeamState {
  teams: Team[];
  activeTeam: Team | null;
  setTeams: (teams: Team[]) => void;
  setActiveTeam: (team: Team | null) => void;
}

export const useTeamStore = create<TeamState>((set) => ({
  teams: [],
  activeTeam: null,
  setTeams: (teams) => set({ teams, activeTeam: teams[0] ?? null }),
  setActiveTeam: (team) => set({ activeTeam: team }),
}));
