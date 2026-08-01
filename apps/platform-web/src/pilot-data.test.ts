import { describe, expect, it } from 'vitest';

import {
  adminCapabilities,
  adminOverview,
  campusName,
  guardianCapabilities,
  guardianOverview,
  modulePages,
  pilotTimestamp,
  schoolName,
  studentCapabilities,
  studentOverview,
  teacherCapabilities,
  teacherOverview,
} from './pilot-data.js';

describe('published pilot data contract', () => {
  it('keeps principal persona capabilities unique and populated', () => {
    for (const capabilities of [
      adminCapabilities,
      teacherCapabilities,
      guardianCapabilities,
      studentCapabilities,
    ]) {
      expect(capabilities.length).toBeGreaterThan(0);
      expect(new Set(capabilities).size).toBe(capabilities.length);
    }
  });

  it('publishes internally consistent persona overview data', () => {
    expect(schoolName).toBe('International Community School');
    expect(campusName).toBe('Main Campus');
    expect(Date.parse(pilotTimestamp)).not.toBeNaN();
    expect(adminOverview.metrics.length).toBeGreaterThan(0);
    expect(teacherOverview.sessions.length).toBeGreaterThan(0);
    expect(guardianOverview.children[0]?.campusLabel).toBe(campusName);
    expect(studentOverview.lessons.length).toBeGreaterThan(0);
  });

  it('requires every published module page to expose metrics, work queue and actions', () => {
    const entries = Object.entries(modulePages);
    expect(entries).toHaveLength(29);
    for (const [route, page] of entries) {
      expect(route).toMatch(/^\/(admin|teacher|family|student)\//);
      expect(page.title.trim().length).toBeGreaterThan(0);
      expect(page.description.trim().length).toBeGreaterThan(0);
      expect(page.eyebrow.trim().length).toBeGreaterThan(0);
      expect(page.metrics.length).toBeGreaterThan(0);
      expect(page.queue.length).toBeGreaterThan(0);
      expect(page.actions.length).toBeGreaterThan(0);
      expect(page.queue.every((item) => item.href.startsWith('/'))).toBe(true);
      expect(page.actions.every((action) => action.href.startsWith('/'))).toBe(true);
    }
  });
});
