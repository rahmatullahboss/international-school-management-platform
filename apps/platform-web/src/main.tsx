import React from 'react';
import { createRoot } from 'react-dom/client';

import { ModuleRegistry } from '@school/platform';
import { AppShell } from '@school/ui';

import './styles.css';

const modules = new ModuleRegistry();
modules.register({
  moduleId: 'platform',
  routes: ['/'],
  capabilities: ['platform.dashboard.read'],
});
modules.register({ moduleId: 'sis', routes: ['/students'], capabilities: ['student.read'] });

function FoundationDashboard(): React.JSX.Element {
  return (
    <AppShell
      title="International School Platform"
      navigation={[
        { label: 'Dashboard', href: '/' },
        { label: 'Students', href: '/students' },
      ]}
    >
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
