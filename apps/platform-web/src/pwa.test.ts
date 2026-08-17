import { describe, expect, it, vi } from 'vitest';

import {
  registerPlatformServiceWorker,
  resolveSavedBandwidthMode,
  type ServiceWorkerContainerTarget,
  type ServiceWorkerRegistrationTarget,
  type ServiceWorkerStateTarget,
} from './pwa.js';

describe('platform PWA registration', () => {
  it('reports unsupported when no service-worker container is available', async () => {
    const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
    try {
      await expect(registerPlatformServiceWorker()).resolves.toEqual({ status: 'unsupported' });
    } finally {
      if (originalNavigator === undefined) delete (globalThis as { navigator?: unknown }).navigator;
      else Object.defineProperty(globalThis, 'navigator', originalNavigator);
    }
  });

  it('uses browser serviceWorker defaults and reports an already waiting update', async () => {
    const onUpdateAvailable = vi.fn();
    const registration: ServiceWorkerRegistrationTarget = {
      installing: null,
      waiting: {},
      addEventListener(_type, listener) {
        listener();
      },
    };
    const register = vi.fn(() => Promise.resolve(registration));
    const container: ServiceWorkerContainerTarget = { controller: {}, register };
    const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', {
      value: { serviceWorker: container },
      configurable: true,
    });
    try {
      await expect(registerPlatformServiceWorker({ onUpdateAvailable })).resolves.toEqual({
        status: 'registered',
        updateAvailable: true,
      });
      expect(register).toHaveBeenCalledWith('/sw.js', { scope: '/' });
      expect(onUpdateAvailable).toHaveBeenCalledTimes(1);
    } finally {
      if (originalNavigator === undefined) delete (globalThis as { navigator?: unknown }).navigator;
      else Object.defineProperty(globalThis, 'navigator', originalNavigator);
    }
  });

  it('tracks an installing worker that becomes active while a controller exists', async () => {
    const onUpdateAvailable = vi.fn();
    const worker: ServiceWorkerStateTarget = {
      state: 'installing',
      addEventListener(_type, listener) {
        Object.defineProperty(worker, 'state', { value: 'installed', configurable: true });
        listener();
      },
    };
    const registration: ServiceWorkerRegistrationTarget = {
      installing: worker,
      waiting: null,
      addEventListener(_type, listener) {
        listener();
      },
    };
    const container: ServiceWorkerContainerTarget = {
      controller: {},
      register(scriptUrl, options) {
        expect(scriptUrl).toBe('/custom-sw.js');
        expect(options).toEqual({ scope: '/school/' });
        return Promise.resolve(registration);
      },
    };

    await expect(
      registerPlatformServiceWorker({
        container,
        scriptUrl: '/custom-sw.js',
        scope: '/school/',
        onUpdateAvailable,
      }),
    ).resolves.toEqual({ status: 'registered', updateAvailable: true });
    expect(onUpdateAvailable).toHaveBeenCalledTimes(1);
  });

  it('ignores updatefound when there is no installing worker', async () => {
    const onUpdateAvailable = vi.fn();
    const container: ServiceWorkerContainerTarget = {
      controller: null,
      register() {
        return Promise.resolve({
          installing: null,
          waiting: null,
          addEventListener(_type, listener) {
            listener();
          },
        });
      },
    };
    await expect(registerPlatformServiceWorker({ container, onUpdateAvailable })).resolves.toEqual({
      status: 'registered',
      updateAvailable: false,
    });
    expect(onUpdateAvailable).not.toHaveBeenCalled();
  });

  it('does not mark an installed worker as an update without an existing controller', async () => {
    const onUpdateAvailable = vi.fn();
    const worker: ServiceWorkerStateTarget = {
      state: 'installed',
      addEventListener(_type, listener) {
        listener();
      },
    };
    const container: ServiceWorkerContainerTarget = {
      controller: null,
      register() {
        return Promise.resolve({
          installing: worker,
          waiting: null,
          addEventListener(_type, listener) {
            listener();
          },
        });
      },
    };
    await expect(registerPlatformServiceWorker({ container, onUpdateAvailable })).resolves.toEqual({
      status: 'registered',
      updateAvailable: false,
    });
    expect(onUpdateAvailable).not.toHaveBeenCalled();
  });

  it('fails closed when service-worker registration rejects', async () => {
    const container: ServiceWorkerContainerTarget = {
      controller: null,
      register() {
        return Promise.reject(new Error('registration unavailable'));
      },
    };
    await expect(registerPlatformServiceWorker({ container })).resolves.toEqual({
      status: 'failed',
      reasonCode: 'SERVICE_WORKER_REGISTRATION_FAILED',
    });
  });
});

describe('saved bandwidth mode', () => {
  it('respects explicit supported values before browser save-data preference', () => {
    expect(resolveSavedBandwidthMode('low', false)).toBe('low');
    expect(resolveSavedBandwidthMode('standard', true)).toBe('standard');
  });

  it('falls back to the browser save-data preference for missing or invalid storage', () => {
    expect(resolveSavedBandwidthMode(null, true)).toBe('low');
    expect(resolveSavedBandwidthMode('invalid', false)).toBe('standard');
  });
});
