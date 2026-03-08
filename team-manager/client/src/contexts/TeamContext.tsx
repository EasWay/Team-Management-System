import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { trpc } from "@/lib/trpc";
import type { Team } from "@shared/types";

interface TeamContextType {
    selectedTeamId: number | null;
    setSelectedTeamId: (id: number | null) => void;
    teams: Team[] | undefined;
    isLoading: boolean;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export function TeamProvider({ children }: { children: ReactNode }) {
    const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
    const { data: teams, isLoading } = trpc.teams.list.useQuery();

    // Auto-selection removed to support landing dashboard

    return (
        <TeamContext.Provider
            value={{
                selectedTeamId,
                setSelectedTeamId,
                teams,
                isLoading,
            }}
        >
            {children}
        </TeamContext.Provider>
    );
}

export function useTeamContext() {
    const context = useContext(TeamContext);
    if (context === undefined) {
        throw new Error("useTeamContext must be used within a TeamProvider");
    }
    return context;
}
