import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { usePeriod, useMetric, useSearch } from '../hooks';
import { Period, Metric } from '../types';

interface DashboardFilters {
  period: Period;
  metric: Metric | null;
  searchQuery: string;
  isLoading: boolean;
}

interface DashboardProviderProps {
  children: ReactNode;
  initialPeriod?: Period;
  initialMetric?: Metric;
  initialSearch?: string;
}

const DashboardContext = createContext<DashboardFilters | undefined>(undefined);

export const DashboardProvider = ({
  children,
  initialPeriod = '7d',
  initialMetric = null,
  initialSearch = '',
}: DashboardProviderProps) => {
  const { period, setPeriod } = usePeriod(initialPeriod);
  const { metric, setMetric } = useMetric(initialMetric);
  const { searchQuery, setSearch } = useSearch(initialSearch);
  const [isLoading, setIsLoading] = React.useState(false);

  const value = useMemo(() => ({
    period,
    metric,
    searchQuery,
    isLoading,
    setPeriod,
    setMetric,
    setSearch,
    setIsLoading,
  }), [period, metric, searchQuery, isLoading]);

  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboardFilters = () => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboardFilters must be used within a DashboardProvider');
  }
  return context;
};
