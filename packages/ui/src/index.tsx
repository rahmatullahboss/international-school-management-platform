import type { ReactNode } from 'react';

export interface NavigationItem {
  label: string;
  href: string;
}

export interface AppShellProps {
  title: string;
  direction?: 'ltr' | 'rtl';
  navigation: readonly NavigationItem[];
  children: ReactNode;
}

export function AppShell({
  title,
  direction = 'ltr',
  navigation,
  children,
}: AppShellProps): React.JSX.Element {
  return (
    <div dir={direction} data-app-shell="school-platform">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <header>
        <strong>{title}</strong>
      </header>
      <nav aria-label="Primary navigation">
        <ul>
          {navigation.map((item) => (
            <li key={item.href}>
              <a href={item.href}>{item.label}</a>
            </li>
          ))}
        </ul>
      </nav>
      <main id="main-content" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
