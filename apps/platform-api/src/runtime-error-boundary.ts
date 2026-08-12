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
