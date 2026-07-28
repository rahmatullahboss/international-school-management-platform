import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AppShell } from './index.js';

describe('AppShell', () => {
  it('renders accessible landmarks, skip link and direction', () => {
    const markup = renderToStaticMarkup(
      <AppShell
        title="International School Platform"
        direction="rtl"
        navigation={[
          { label: 'Dashboard', href: '/' },
          { label: 'Students', href: '/students' },
        ]}
      >
        <h1>Dashboard</h1>
      </AppShell>,
    );

    expect(markup).toContain('href="#main-content"');
    expect(markup).toContain('<nav aria-label="Primary navigation"');
    expect(markup).toContain('<main id="main-content"');
    expect(markup).toContain('dir="rtl"');
  });
});
