'use client';

import { useDashboard } from '@/components/dashboard/DashboardProvider';
import { NetworkTreemap } from '@/components/dashboard/NetworkTreemap';
import { DetailPanel } from '@/components/dashboard/DetailPanel';
import { FreshnessIndicator } from '@/components/dashboard/FreshnessIndicator';
import { FreshnessWarning } from '@/components/dashboard/FreshnessWarning';
import { SavedViewsControls } from '@/components/dashboard/SavedViewsControls';
import { isMetricSupportedOnNetwork, unsupportedMetricMessage } from '@/lib/network';

export function TreemapSection() {
  const { network, metric, setMetric, selectedNode } = useDashboard();
  const metricSupported = isMetricSupportedOnNetwork(metric, network);

  return (
    <div className='mx-auto flex w-full max-w-7xl flex-col gap-6 px-3 py-6 sm:px-6 lg:px-8'>
      <FreshnessIndicator />
      <FreshnessWarning />
      <SavedViewsControls />
      {!metricSupported && (
        <div role='status' className='rounded-lg border border-amber-800/70 bg-amber-950/40 px-4 py-3 text-sm text-amber-100'>
          <p>{unsupportedMetricMessage(metric)}</p>
          <button type='button' className='mt-2 text-sm font-medium text-amber-50 underline' onClick={() => setMetric('ops')}>Switch to operations</button>
        </div>
      )}
      <div className="grid min-w-0 grid-cols-1 gap-6 transition-all duration-300">
        <div className='min-w-0'>
          <NetworkTreemap />
        </div>
        {selectedNode && (
          <div className='min-w-0 scroll-mt-4' id='detail-panel-container'>
            <DetailPanel />
          </div>
        )}
      </div>
    </div>
  );
}
