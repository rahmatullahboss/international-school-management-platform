export interface RuntimeInternalErrorPayload {
  readonly error: {
    readonly code: 'internal_error';
    readonly message: 'The request could not be completed.';
  };
}

export function runtimeInternalErrorPayload(): RuntimeInternalErrorPayload {
  return {
    error: {
      code: 'internal_error',
      message: 'The request could not be completed.',
    },
  };
}

export function runtimeInternalErrorResponse(): Response {
  return new Response(JSON.stringify(runtimeInternalErrorPayload()), {
    status: 500,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
      'x-correlation-id': crypto.randomUUID(),
    },
  });
}
