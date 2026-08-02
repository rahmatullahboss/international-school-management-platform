interface FetchBinding {
  fetch(request: Request): Promise<Response>;
}

interface WebWorkerEnvironment {
  readonly ASSETS: FetchBinding;
  readonly PLATFORM_API: FetchBinding;
}

const worker = {
  async fetch(request: Request, environment: WebWorkerEnvironment): Promise<Response> {
    const pathname = new URL(request.url).pathname;
    if (pathname === '/auth' || pathname.startsWith('/auth/')) {
      return environment.PLATFORM_API.fetch(request);
    }
    return environment.ASSETS.fetch(request);
  },
};

export default worker;
