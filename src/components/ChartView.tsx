import React from 'react';
import { useDashboardFilters } from '../hooks';
import { Chart } from './Chart';

export const ChartView = () => {
  const { metric, period, searchQuery, isLoading, setLoading } = useDashboardFilters();

  React.useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        await fetchChartData({ metric, period, searchQuery });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [metric, period, searchQuery]);

  return (
    <div className="chart-view">
      <Chart data={chartData} isLoading={isLoading} />
    </div>
  );
};
