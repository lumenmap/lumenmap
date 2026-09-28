import React from 'react';
import { renderHook, act } from '@testing-library/react-hooks';
import { DashboardProvider, useDashboardFilters } from './DashboardProvider';

describe('DashboardProvider', () => {
  it('should sync period updates across views', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DashboardProvider initialPeriod="7d">
        {children}
      </DashboardProvider>
    );

    const { result } = renderHook(() => useDashboardFilters(), { wrapper });

    act(() => {
      result.current.updatePeriod('30d');
    });

    expect(result.current.period).toBe('30d');
  });

  it('should handle metric updates', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <DashboardProvider initialMetric="revenue">
        {children}
      </DashboardProvider>
    );

    const { result } = renderHook(() => useDashboardFilters(), { wrapper });

    act(() => {
      result.current.updateMetric('cost');
    });

    expect(result.current.metric).toBe('cost');
  });
});
