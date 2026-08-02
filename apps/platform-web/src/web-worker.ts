import { applyWebSecurityHeaders } from './security-headers.js';

interface FetchBinding {
  fetch(request: Request): Promise<Response>;
}

interface WebWorkerEnvironment {
  readonly APP_ENV: string;
  readonly ASSETS: FetchBinding;
  readonly PLATFORM_API: FetchBinding;
}

const worker = {
  async fetch(request: Request, environment: WebWorkerEnvironment): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    const response =
      pathname === '/auth' || pathname.startsWith('/auth/')
        ? await environment.PLATFORM_API.fetch(request)
        : await environment.ASSETS.fetch(request);
    return applyWebSecurityHeaders(response, environment.APP_ENV);
  },
};

export default worker;
