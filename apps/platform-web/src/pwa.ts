export interface ServiceWorkerStateTarget {
  readonly state: string;
  addEventListener(type: 'statechange', listener: () => void): void;
}

export interface ServiceWorkerRegistrationTarget {
  readonly installing: ServiceWorkerStateTarget | null;
  readonly waiting: unknown;
  addEventListener(type: 'updatefound', listener: () => void): void;
}

export interface ServiceWorkerContainerTarget {
  readonly controller: unknown;
  register(
    scriptUrl: string,
    options: { readonly scope: string },
  ): Promise<ServiceWorkerRegistrationTarget>;
}

export interface PlatformServiceWorkerOptions {
  readonly container?: ServiceWorkerContainerTarget;
  readonly scriptUrl?: string;
  readonly scope?: string;
  readonly onUpdateAvailable?: () => void;
}

export type PlatformServiceWorkerResult =
  | Readonly<{ readonly status: 'unsupported' }>
  | Readonly<{ readonly status: 'registered'; readonly updateAvailable: boolean }>
  | Readonly<{
      readonly status: 'failed';
      readonly reasonCode: 'SERVICE_WORKER_REGISTRATION_FAILED';
    }>;

function browserServiceWorkerContainer(): ServiceWorkerContainerTarget | undefined {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return undefined;
  return navigator.serviceWorker;
}

export async function registerPlatformServiceWorker(
  options: PlatformServiceWorkerOptions = {},
): Promise<PlatformServiceWorkerResult> {
  const container = options.container ?? browserServiceWorkerContainer();
  if (container === undefined) return Object.freeze({ status: 'unsupported' });

  try {
    const registration = await container.register(options.scriptUrl ?? '/sw.js', {
      scope: options.scope ?? '/',
    });
    let updateAvailable = registration.waiting !== null;
    if (updateAvailable) options.onUpdateAvailable?.();

    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (worker === null) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && container.controller !== null) {
          updateAvailable = true;
          options.onUpdateAvailable?.();
        }
      });
    });

    return Object.freeze({ status: 'registered', updateAvailable });
  } catch {
    return Object.freeze({
      status: 'failed',
      reasonCode: 'SERVICE_WORKER_REGISTRATION_FAILED',
    });
  }
}

export function resolveSavedBandwidthMode(
  storedValue: string | null,
  saveDataEnabled: boolean,
): 'standard' | 'low' {
  if (storedValue === 'low' || storedValue === 'standard') return storedValue;
  return saveDataEnabled ? 'low' : 'standard';
}
