/* eslint-disable react-refresh/only-export-components -- context file exports hook + provider */
import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { District } from '../types';
import { districts as staticDistricts } from '../data/geography';
import { fetchStates, fetchDistrictsByState, fetchDistrictById, fetchSensors } from '../services/api';

interface LocationContextType {
    selectedDistrict: District;
    setDistrictById: (id: string) => void;
    selectedWard: number | null;
    setSelectedWard: (ward: number | null) => void;
    allDistricts: District[];
    allStates: string[];
    isLoadingGeography: boolean;
    /** Real-time average PM2.5 from active sensors for selected district/ward */
    livePm25: number | null;
    /** Number of sensors contributing to livePm25 */
    liveSensorCount: number;
    isLoadingPm25: boolean;
    /** Allow pages (e.g. MapView) to push authoritative sensor stats into the context */
    updateSensorStats: (pm25: number | null, count: number) => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

const DEFAULT_DISTRICT: District = staticDistricts.find((d) => d.id === 'uttar-pradesh-lucknow') ?? staticDistricts[0];

export function LocationProvider({ children }: { children: ReactNode }) {
    const queryClient = useQueryClient();
    const [allDistricts, setAllDistricts] = useState<District[]>(staticDistricts);
    const [selectedDistrict, setSelectedDistrict] = useState<District>(DEFAULT_DISTRICT);
    const [selectedWard, setSelectedWard] = useState<number | null>(null);
    const [livePm25Override, setLivePm25Override] = useState<{ pm25: number | null; count: number } | null>(null);

    const { data: allStates = [], isLoading: isLoadingStates } = useQuery({
        queryKey: ['states'],
        queryFn: async () => {
            try {
                return await fetchStates();
            } catch {
                return [...new Set(staticDistricts.map((d) => d.state))].sort();
            }
        },
    });

    const { data: initialDistricts, isLoading: isLoadingDistricts } = useQuery({
        queryKey: ['districts', ''],
        queryFn: () => fetchDistrictsByState(''),
        select: (districts) => (districts.length > 0 ? districts : undefined),
    });

    const { data: sensors = [], isLoading: isLoadingPm25 } = useQuery({
        queryKey: ['sensors', selectedDistrict.id, selectedWard],
        queryFn: () => fetchSensors(selectedDistrict.id, selectedWard),
        enabled: !!selectedDistrict.id,
    });

    const derivedPm25 = useMemo(() => {
        const allActive = sensors.filter((s) => s.isActive !== false);
        const withData = allActive.filter((s) => s.pm25 > 0);
        return {
            count: allActive.length,
            pm25: withData.length > 0 ? Math.round(withData.reduce((sum, s) => sum + s.pm25, 0) / withData.length) : null,
        };
    }, [sensors]);

    const livePm25 = livePm25Override?.pm25 ?? derivedPm25.pm25;
    const liveSensorCount = livePm25Override?.count ?? derivedPm25.count;
    const isLoadingGeography = isLoadingStates || isLoadingDistricts;

    const updateSensorStats = useCallback((pm25: number | null, count: number) => {
        setLivePm25Override({ pm25, count });
    }, []);

    useEffect(() => {
        if (initialDistricts && initialDistricts.length > 0) {
            // Sync TanStack Query district list into local state when API/static list arrives
            // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional sync from query
            setAllDistricts(initialDistricts);
        }
    }, [initialDistricts]);

    const loadDistrictsForState = useCallback(async (state: string) => {
        const districts = await queryClient.fetchQuery({
            queryKey: ['districts', state],
            queryFn: () => fetchDistrictsByState(state),
        });
        if (districts.length > 0) {
            setAllDistricts((prev) => {
                const others = prev.filter((d) => d.state !== state);
                return [...others, ...districts];
            });
        }
    }, [queryClient]);

    const setDistrictById = useCallback(async (id: string) => {
        const cached = allDistricts.find((d) => d.id === id);
        if (cached) {
            setSelectedDistrict(cached);
            setSelectedWard(null);
        }
        try {
            const district = await queryClient.fetchQuery({
                queryKey: ['district', id],
                queryFn: () => fetchDistrictById(id),
            });
            if (district) {
                setSelectedDistrict(district);
                const stateAlreadyLoaded = allDistricts.some((d) => d.state === district.state);
                if (!stateAlreadyLoaded) {
                    await loadDistrictsForState(district.state);
                }
            }
        } catch {
            /* keep optimistic value */
        }
        setSelectedWard(null);
    }, [allDistricts, loadDistrictsForState, queryClient]);

    return (
        <LocationContext.Provider value={{
            selectedDistrict,
            setDistrictById,
            selectedWard,
            setSelectedWard,
            allDistricts,
            allStates,
            isLoadingGeography,
            livePm25,
            liveSensorCount,
            isLoadingPm25,
            updateSensorStats,
        }}>
            {children}
        </LocationContext.Provider>
    );
}

export function useLocation() {
    const context = useContext(LocationContext);
    if (!context) throw new Error('useLocation must be used within LocationProvider');
    return context;
}
