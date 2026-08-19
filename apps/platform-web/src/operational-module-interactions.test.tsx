import { isValidElement, type ReactElement } from 'react';
import type * as ReactTypes from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { modulePages } from './pilot-data.js';
import type { PilotRole } from './portal-shared.js';

const stateMocks = vi.hoisted(() => ({
  values: [] as unknown[],
  setters: [] as ReturnType<typeof vi.fn>[],
  call: 0,
}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactTypes>();
  return {
    ...actual,
    useState: ((initialState: unknown) => {
      const index = stateMocks.call++;
      const setter = vi.fn();
      stateMocks.setters[index] = setter;
      const injected = stateMocks.values[index];
      const value =
        injected === undefined
          ? typeof initialState === 'function'
            ? (initialState as () => unknown)()
            : initialState
          : injected;
      return [value, setter];
    }) as unknown as typeof actual.useState,
  };
});

function findElementInValue(
  value: unknown,
  predicate: (element: ReactElement) => boolean,
): ReactElement | undefined {
  if (isValidElement(value)) {
    if (predicate(value)) return value;
    const props = value.props as Record<string, unknown>;
    for (const propValue of Object.values(props)) {
      const found = findElementInValue(propValue, predicate);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findElementInValue(item, predicate);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

async function routeComponent(
  path: string,
  role: PilotRole,
  componentName: string,
): Promise<ReactElement> {
  const page = modulePages[path];
  if (page === undefined) throw new Error(`missing module page for ${path}`);
  const { OperationalModuleSurface } = await import('./operational-module-surface.js');
  const surface = OperationalModuleSurface({ path, page, role });
  const component = findElementInValue(
    surface,
    (element) => typeof element.type === 'function' && element.type.name === componentName,
  );
  if (component === undefined || typeof component.type !== 'function') {
    throw new Error(`expected ${componentName} for ${path}`);
  }
  stateMocks.call = 0;
  stateMocks.setters.length = 0;
  const Component = component.type as unknown as (props: unknown) => ReactElement;
  return Component(component.props);
}

function button(
  element: ReactElement,
  matcher: (props: Record<string, unknown>) => boolean,
): ReactElement {
  const found = findElementInValue(
    element,
    (candidate) =>
      candidate.type === 'button' && matcher(candidate.props as Record<string, unknown>),
  );
  if (found === undefined) throw new Error('expected interactive button');
  return found;
}

function click(element: ReactElement): void {
  const onClick = (element.props as { readonly onClick?: () => void }).onClick;
  if (onClick === undefined) throw new Error('expected click handler');
  onClick();
}

beforeEach(() => {
  vi.resetModules();
  stateMocks.values = [];
  stateMocks.setters.length = 0;
  stateMocks.call = 0;
  vi.unstubAllGlobals();
});

describe('OperationalModuleSurface interaction handlers', () => {
  it('marks teacher attendance locally and saves only the device draft', async () => {
    const setItem = vi.fn();
    vi.stubGlobal('window', { localStorage: { setItem } });
    const attendance = await routeComponent('/teacher/attendance', 'teacher', 'TeacherAttendance');
    const late = button(attendance, (props) => props.children === 'Late');

    click(late);

    const attendanceSetter = stateMocks.setters[0];
    const dirtySetter = stateMocks.setters[1];
    const statusSetter = stateMocks.setters[2];
    if (attendanceSetter === undefined || dirtySetter === undefined || statusSetter === undefined) {
      throw new Error('expected attendance state setters');
    }
    const attendanceUpdater = attendanceSetter.mock.calls[0]?.[0] as
      ((current: Record<string, string>) => Record<string, string>) | undefined;
    const dirtyUpdater = dirtySetter.mock.calls[0]?.[0] as
      ((current: ReadonlySet<string>) => Set<string>) | undefined;
    expect(attendanceUpdater?.({ 'Samira Noor': 'Present' })).toEqual({ 'Samira Noor': 'Late' });
    expect([...(dirtyUpdater?.(new Set()) ?? new Set())]).toEqual(['Samira Noor']);
    expect(statusSetter).toHaveBeenCalledWith('Device changes not saved yet.');

    const save = button(attendance, (props) => props.children === 'Save on device');
    click(save);

    expect(setItem).toHaveBeenCalledWith(
      'school-pilot-teacher-attendance',
      expect.stringContaining('"Nabil Hasan":"Absent"'),
    );
    expect(dirtySetter.mock.calls.at(-1)?.[0]).toEqual(new Set());
    expect(statusSetter).toHaveBeenCalledWith(
      'Saved on this device. Attendance has not been submitted to the school.',
    );
  });

  it('switches only within the teacher-scoped student and resource records', async () => {
    const students = await routeComponent('/teacher/students', 'teacher', 'TeacherStudents');
    const openRiya = button(
      students,
      (props) => props['aria-label'] === 'Open Riya Ahmed permitted profile',
    );
    click(openRiya);
    expect(stateMocks.setters[0]).toHaveBeenCalledWith('Riya Ahmed');

    const resources = await routeComponent('/teacher/resources', 'teacher', 'TeacherResources');
    const geometry = button(resources, (props) => props['aria-label'] === 'Edit Geometry quiz');
    const calculus = button(resources, (props) => props['aria-label'] === 'Repair Calculus intro');
    click(geometry);
    click(calculus);
    expect(stateMocks.setters[0]).toHaveBeenNthCalledWith(1, 'Geometry quiz');
    expect(stateMocks.setters[0]).toHaveBeenNthCalledWith(2, 'Calculus intro');
  });

  it('updates scoped message search and toggles unread-only filtering', async () => {
    const messages = await routeComponent('/teacher/messages', 'teacher', 'MessageWorkspace');
    const input = findElementInValue(
      messages,
      (element) =>
        element.type === 'input' &&
        (element.props as { 'aria-label'?: string })['aria-label'] === 'Search conversations',
    );
    if (input === undefined) throw new Error('expected conversation search');
    const onChange = (
      input.props as {
        readonly onChange?: (event: { readonly currentTarget: { readonly value: string } }) => void;
      }
    ).onChange;
    if (onChange === undefined) throw new Error('expected message query handler');
    onChange({ currentTarget: { value: 'algebra' } });
    expect(stateMocks.setters[0]).toHaveBeenCalledWith('algebra');

    const unread = button(messages, (props) => props.children === 'Unread');
    click(unread);
    const toggle = stateMocks.setters[1]?.mock.calls[0]?.[0] as
      ((current: boolean) => boolean) | undefined;
    expect(toggle?.(false)).toBe(true);
    expect(toggle?.(true)).toBe(false);
  });

  it('switches published attendance history and authorised document detail', async () => {
    const attendance = await routeComponent(
      '/family/attendance',
      'guardian',
      'AttendancePublished',
    );
    const history = button(
      attendance,
      (props) => props['aria-label'] === 'View 14 July revision history',
    );
    click(history);
    expect(stateMocks.setters[0]).toHaveBeenCalledWith('14 Jul');
    const explanation = button(
      attendance,
      (props) => props['aria-label'] === 'Track 12 July explanation',
    );
    click(explanation);
    expect(stateMocks.setters[0]).toHaveBeenCalledWith('12 Jul');

    const documents = await routeComponent('/student/documents', 'student', 'DocumentsWorkspace');
    const welcome = button(documents, (props) => props.children === 'Welcome');
    const term2 = button(documents, (props) => props.children === 'Term 2');
    click(welcome);
    click(term2);
    expect(stateMocks.setters[0]).toHaveBeenNthCalledWith(1, true);
    expect(stateMocks.setters[0]).toHaveBeenNthCalledWith(2, false);
  });

  it('renders a safe empty body for an unknown operational path', async () => {
    const { OperationalModuleSurface } = await import('./operational-module-surface.js');
    const page = modulePages['/admin/sis'];
    if (page === undefined) throw new Error('expected fallback page fixture');

    const element = OperationalModuleSurface({ path: '/unknown', page, role: 'admin' });

    expect(element).toBeDefined();
  });
});
