/**
 * When true, the app skips the DSS backend and Supabase auth dependency and uses
 * bundled mock data (see dummyBackend.ts + configurator dummy handlers).
 * Set in `.env.local`: VITE_DUMMY_DATA=true
 */
export function isDummyDataMode(): boolean {
    return import.meta.env.VITE_DUMMY_DATA === 'true';
}
