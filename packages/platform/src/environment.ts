export interface RuntimeEnvironment {
  environment: string;
  region: string;
}

export function parseRuntimeEnvironment<T extends { APP_ENV?: string; APP_REGION?: string }>(
  values: T,
): RuntimeEnvironment {
  const environment = values.APP_ENV?.trim();
  if (!environment) {
    throw new Error('APP_ENV is required');
  }

  const region = values.APP_REGION?.trim();
  if (!region) {
    throw new Error('APP_REGION is required');
  }

  return { environment, region };
}
