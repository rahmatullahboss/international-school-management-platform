import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

import {
  ExperienceResiliencePanel,
  ExperienceTelemetryBuffer,
  type BandwidthMode,
  type ConnectivityState,
} from '@school/documents-experience/resilience';
import '@school/documents-experience/resilience.css';
import { ModuleRegistry } from '@school/platform';
import { AppShell } from '@school/ui';

import { registerPlatformServiceWorker, resolveSavedBandwidthMode } from './pwa';
import './styles.css';

const modules = new ModuleRegistry();
modules.register({
  moduleId: 'platform',
  routes: ['/'],
  capabilities: ['platform.dashboard.read'],
});
modules.register({ moduleId: 'sis', routes: ['/students'], capabilities: ['student.read'] });

const telemetry = new ExperienceTelemetryBuffer(100);
const bandwidthStorageKey = 'school-platform:bandwidth-mode:v1';

interface NavigatorWithConnection extends Navigator {
  readonly connection?: {
    readonly saveData?: boolean;
  };
}

function saveDataEnabled(): boolean {
  return (navigator as NavigatorWithConnection).connection?.saveData === true;
}

function initialBandwidthMode(): BandwidthMode {
  return resolveSavedBandwidthMode(localStorage.getItem(bandwidthStorageKey), saveDataEnabled());
}

function initialConnectivity(): ConnectivityState {
  if (!navigator.onLine) return 'offline';
  return saveDataEnabled() ? 'degraded' : 'online';
}

function FoundationDashboard(): React.JSX.Element {
  const [bandwidthMode, setBandwidthMode] = useState<BandwidthMode>(initialBandwidthMode);
  const [connectivity, setConnectivity] = useState<ConnectivityState>(initialConnectivity);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.bandwidth = bandwidthMode;
    localStorage.setItem(bandwidthStorageKey, bandwidthMode);
  }, [bandwidthMode]);

  useEffect(() => {
    const updateConnectivity = (): void => {
      const next: ConnectivityState = navigator.onLine
        ? bandwidthMode === 'low' || saveDataEnabled()
          ? 'degraded'
          : 'online'
        : 'offline';
      setConnectivity(next);
      telemetry.record({
        name: 'connectivity.changed',
        timestamp: new Date().toISOString(),
        outcome: next === 'offline' ? 'pending' : 'success',
        routeTemplate: '/',
        attributes: {
          connectivity: next,
          bandwidthMode,
          persona: 'platform',
        },
      });
    };

    updateConnectivity();
    window.addEventListener('online', updateConnectivity);
    window.addEventListener('offline', updateConnectivity);
    return () => {
      window.removeEventListener('online', updateConnectivity);
      window.removeEventListener('offline', updateConnectivity);
    };
  }, [bandwidthMode]);

  useEffect(() => {
    if (!import.meta.env.PROD) return undefined;
    let active = true;
    void registerPlatformServiceWorker({
      onUpdateAvailable: () => {
        if (active) setUpdateAvailable(true);
      },
    }).then((result) => {
      telemetry.record({
        name: 'pwa.service_worker',
        timestamp: new Date().toISOString(),
        outcome: result.status === 'failed' ? 'failure' : 'success',
        routeTemplate: '/',
        attributes: {
          reasonCode: result.status === 'failed' ? result.reasonCode.toLowerCase() : result.status,
          persona: 'platform',
        },
      });
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <AppShell
      title="International School Platform"
      navigation={[
        { label: 'Dashboard', href: '/' },
        { label: 'Students', href: '/students' },
      ]}
    >
      <ExperienceResiliencePanel
        locale={navigator.language || 'en-GB'}
        connectivity={connectivity}
        bandwidthMode={bandwidthMode}
        pendingActionCount={0}
        updateAvailable={updateAvailable}
        retryHref={connectivity === 'online' ? undefined : '/?retry-sync=1'}
        supportHref="/offline.html"
        onBandwidthModeChange={setBandwidthMode}
      />
      <h1>Dashboard</h1>
      <p>Foundation workspace initialized with tenant-safe platform contracts.</p>
      <dl>
        <div>
          <dt>Dashboard owner</dt>
          <dd>{modules.ownerOfRoute('/')}</dd>
        </div>
        <div>
          <dt>Student capability owner</dt>
          <dd>{modules.ownerOfCapability('student.read')}</dd>
        </div>
      </dl>
    </AppShell>
  );
}

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element not found');
}

createRoot(root).render(
  <React.StrictMode>
    <FoundationDashboard />
  </React.StrictMode>,
);
