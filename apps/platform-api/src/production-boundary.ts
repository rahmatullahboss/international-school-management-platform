export interface ProductionBoundaryEnvironment {
  readonly APP_ENV: string;
}

function notFoundResponse(): Response {
  return new Response(
    JSON.stringify({
      error: {
        code: 'not_found',
        message: 'The requested resource was not found.',
      },
    }),
    {
      status: 404,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
      },
    },
  );
}

export function enforceProductionPilotBoundary(
  request: Request,
  environment: ProductionBoundaryEnvironment,
): Response | undefined {
  if (environment.APP_ENV !== 'production') return undefined;
  const pathname = new URL(request.url).pathname;
  if (pathname !== '/pilot' && !pathname.startsWith('/pilot/')) return undefined;
  return notFoundResponse();
}
