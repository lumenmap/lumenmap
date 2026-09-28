import { useDashboardFilters as useContextFilters } from '../context/DashboardProvider';

export const useDashboardFilters = () => {
  const {
    period,
    metric,
    searchQuery,
    isLoading,
    setPeriod,
    setMetric,
    setSearch,
    setIsLoading,
  } = useContextFilters();

  return {
    period,
    metric,
    searchQuery,
    isLoading,
    updatePeriod: (newPeriod: string) => setPeriod(newPeriod),
    updateMetric: (newMetric: string | null) => setMetric(newMetric),
    updateSearch: (query: string) => setSearch(query),
    setLoading: (loading: boolean) => setIsLoading(loading),
  };
};
