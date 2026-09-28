import React from 'react';
import { useDashboardFilters } from '../hooks';
import { FlowChart } from './FlowChart';

export const FlowView = () => {
  const { period, searchQuery, isLoading, updatePeriod, setLoading } = useDashboardFilters();

  React.useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        await fetchFlowData({ period, searchQuery });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [period, searchQuery]);

  return (
    <div className="flow-view">
      <FlowChart data={flowData} isLoading={isLoading} />
    </div>
  );
};
