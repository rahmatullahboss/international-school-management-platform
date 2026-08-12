import type { RuntimeProjectionBatchResolution } from './runtime-projection-worker.js';

export function emitRuntimeProjectionBatchObservation(
  resolution: RuntimeProjectionBatchResolution,
): void {
  const observation = resolution.ok
    ? {
        event: 'runtime_projection_batch' as const,
        ok: true as const,
        claimed: resolution.result.claimed,
        completed: resolution.result.completed,
        retried: resolution.result.retried,
        deadLettered: resolution.result.deadLettered,
      }
    : {
        event: 'runtime_projection_batch' as const,
        ok: false as const,
        code: resolution.code,
      };

  console.log(JSON.stringify(observation));
}
