import { useEffect, useMemo, useState, type FormEvent, type ReactElement } from 'react';

import {
  newOperatorIdempotencyKey,
  submitProductionOperatorCommand,
  type ProductionOperatorCommandBody,
  type ProductionOperatorCommandResult,
} from './production-operator-command';
import {
  loadProductionOperatorWorkQueue,
  type AdmissionsLifecycleCandidate,
  type ProductionOperatorWorkQueue,
} from './production-operator-work-queue';

const ACTION_LABELS = {
  review: 'Record application review',
  'issue-offer': 'Issue admissions offer',
  'accept-offer': 'Accept admissions offer',
  'convert-applicant': 'Convert applicant to student',
} as const;

const ACTION_PERMISSIONS = {
  review: 'admissions.application.review',
  'issue-offer': 'admissions.application.offer.issue',
  'accept-offer': 'admissions.application.offer.accept',
  'convert-applicant': 'admissions.application.applicant.convert',
} as const;

function formString(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function resultMessage(result: ProductionOperatorCommandResult): ReactElement {
  if (result.state === 'accepted') {
    return (
      <div className="pilot-demo-note" role="status">
        <strong>
          {result.replayed ? 'Existing receipt verified' : 'Lifecycle action accepted'}
        </strong>
        <span>Command {result.commandId}</span>
        <span>Evidence {result.evidenceId}</span>
        <span>{new Date(result.acceptedAt).toLocaleString()}</span>
      </div>
    );
  }
  if (result.state === 'rejected') {
    return (
      <div className="pilot-demo-note" role="alert">
        <strong>{result.message}</strong>
        <span>Code: {result.code}</span>
        {result.currentVersion === undefined ? null : (
          <span>Current record version: {result.currentVersion}</span>
        )}
      </div>
    );
  }
  return (
    <div className="pilot-demo-note" role="alert">
      <strong>Lifecycle action unavailable</strong>
      <span>{result.message}</span>
    </div>
  );
}

function queueMessage(queue: ProductionOperatorWorkQueue | undefined): ReactElement | null {
  if (queue === undefined) {
    return (
      <div className="pilot-demo-note" role="status">
        <strong>Loading admissions lifecycle…</strong>
        <span>Only server-authorized candidates and academic placements are loaded.</span>
      </div>
    );
  }
  if (queue.state !== 'ready') {
    return (
      <div className="pilot-demo-note" role="alert">
        <strong>Admissions lifecycle unavailable</strong>
        <span>{queue.message}</span>
      </div>
    );
  }
  if (queue.role !== 'admissions') return null;
  if (queue.items.length === 0) {
    return (
      <div className="pilot-demo-note" role="status">
        <strong>No actionable admissions work</strong>
        <span>
          No review, offer, acceptance or conversion action is ready in this campus scope.
        </span>
      </div>
    );
  }
  return null;
}

function buildBody(
  candidate: AdmissionsLifecycleCandidate,
  form: FormData,
): ProductionOperatorCommandBody | undefined {
  if (candidate.action === 'review') {
    const scoreValue = formString(form, 'score');
    const notesValue = formString(form, 'notes');
    return {
      command: 'admissions.application.review.record',
      applicationId: candidate.applicationId,
      expectedVersion: candidate.version,
      recommendation: formString(form, 'recommendation') as
        'admit' | 'waitlist' | 'decline' | 'more-information',
      score: scoreValue === '' ? null : Number(scoreValue),
      notes: notesValue === '' ? null : notesValue,
    };
  }
  if (candidate.action === 'issue-offer') {
    const placementKey = formString(form, 'placement');
    const placement = candidate.placementOptions.find(
      (option) =>
        `${option.programId}:${option.academicYearId}:${option.gradeLevelId}` === placementKey,
    );
    const expiresLocal = formString(form, 'expiresAt');
    if (placement === undefined || expiresLocal === '') return undefined;
    const parsedExpiry = new Date(expiresLocal);
    if (!Number.isFinite(parsedExpiry.getTime())) return undefined;
    return {
      command: 'admissions.application.offer.issue',
      applicationId: candidate.applicationId,
      expectedVersion: candidate.version,
      programId: placement.programId,
      academicYearId: placement.academicYearId,
      gradeLevelId: placement.gradeLevelId,
      expiresAt: parsedExpiry.toISOString(),
    };
  }
  if (candidate.action === 'accept-offer') {
    return {
      command: 'admissions.application.offer.accept',
      applicationId: candidate.applicationId,
      expectedVersion: candidate.version,
    };
  }
  const effectiveFrom = formString(form, 'effectiveFrom');
  if (effectiveFrom === '') return undefined;
  return {
    command: 'admissions.application.applicant.convert',
    applicationId: candidate.applicationId,
    expectedVersion: candidate.version,
    effectiveFrom,
  };
}

function CandidateSummary({
  candidate,
}: {
  readonly candidate: AdmissionsLifecycleCandidate;
}): ReactElement {
  return (
    <div className="pilot-demo-note" data-admissions-stage={candidate.action}>
      <strong>{candidate.applicationNumber}</strong>
      <span>{ACTION_LABELS[candidate.action]}</span>
      <span>
        {candidate.status} · version {candidate.version}
      </span>
      {candidate.offerExpiresAt === null ? null : (
        <span>Offer expires {new Date(candidate.offerExpiresAt).toLocaleString()}</span>
      )}
    </div>
  );
}

export function ProductionAdmissionsLifecyclePanel(props: {
  readonly capabilities: readonly string[];
}): ReactElement {
  const [queue, setQueue] = useState<ProductionOperatorWorkQueue>();
  const [selectedId, setSelectedId] = useState('');
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ProductionOperatorCommandResult>();

  const reload = async (): Promise<void> => {
    const nextQueue = await loadProductionOperatorWorkQueue();
    setQueue(nextQueue);
    setSelectedId((current) => {
      if (nextQueue.state !== 'ready' || nextQueue.role !== 'admissions') return '';
      if (nextQueue.items.some((item) => item.applicationId === current)) return current;
      return nextQueue.items[0]?.applicationId ?? '';
    });
  };

  useEffect(() => {
    let cancelled = false;
    void loadProductionOperatorWorkQueue().then((nextQueue) => {
      if (cancelled) return;
      setQueue(nextQueue);
      if (nextQueue.state === 'ready' && nextQueue.role === 'admissions') {
        setSelectedId(nextQueue.items[0]?.applicationId ?? '');
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const candidates = queue?.state === 'ready' && queue.role === 'admissions' ? queue.items : [];
  const candidate = useMemo(
    () => candidates.find((item) => item.applicationId === selectedId),
    [candidates, selectedId],
  );
  const permission = candidate === undefined ? undefined : ACTION_PERMISSIONS[candidate.action];
  const allowed = permission !== undefined && props.capabilities.includes(permission);

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (pending || candidate === undefined || !allowed) return;
    const body = buildBody(candidate, new FormData(event.currentTarget));
    if (body === undefined) {
      setResult({
        state: 'unavailable',
        message: 'Select a valid server-authorized placement and required values.',
      });
      return;
    }
    setPending(true);
    setResult(undefined);
    const nextResult = await submitProductionOperatorCommand(
      body,
      newOperatorIdempotencyKey(body.command),
    );
    setResult(nextResult);
    if (nextResult.state === 'accepted') await reload();
    setPending(false);
  };

  return (
    <section className="pilot-coverage" aria-labelledby="admissions-lifecycle-title">
      <div className="pilot-section-heading">
        <p>Server-owned admissions lifecycle</p>
        <h2 id="admissions-lifecycle-title">Applications requiring action</h2>
        <span>
          Tenant and campus scope, record versions, lifecycle stage, program, academic year and
          grade identities come from the database. The browser cannot submit arbitrary placement
          IDs.
        </span>
      </div>
      {queueMessage(queue)}
      {candidates.length === 0 ? null : (
        <>
          <label className="pilot-demo-note">
            Current application
            <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
              {candidates.map((item) => (
                <option key={item.applicationId} value={item.applicationId}>
                  {item.applicationNumber} · {ACTION_LABELS[item.action]}
                </option>
              ))}
            </select>
          </label>
          {candidate === undefined ? null : <CandidateSummary candidate={candidate} />}
          {candidate !== undefined && !allowed ? (
            <div className="pilot-demo-note" role="alert">
              <strong>Action not granted</strong>
              <span>The current database role does not grant {permission}.</span>
            </div>
          ) : null}
          {candidate === undefined || !allowed ? null : (
            <form className="pilot-demo-note" onSubmit={(event) => void submit(event)}>
              {candidate.action === 'review' ? (
                <>
                  <label>
                    Recommendation
                    <select name="recommendation" defaultValue="more-information">
                      <option value="admit">Admit</option>
                      <option value="waitlist">Waitlist</option>
                      <option value="decline">Decline</option>
                      <option value="more-information">More information</option>
                    </select>
                  </label>
                  <label>
                    Score (optional)
                    <input name="score" type="number" min="0" max="100" step="0.1" />
                  </label>
                  <label>
                    Confidential review notes (optional)
                    <textarea name="notes" maxLength={2000} />
                  </label>
                </>
              ) : null}
              {candidate.action === 'issue-offer' ? (
                <>
                  <label>
                    Published placement
                    <select name="placement" required defaultValue="">
                      <option value="" disabled>
                        Select an eligible program, year and grade
                      </option>
                      {candidate.placementOptions.map((option) => (
                        <option
                          key={`${option.programId}:${option.academicYearId}:${option.gradeLevelId}`}
                          value={`${option.programId}:${option.academicYearId}:${option.gradeLevelId}`}
                        >
                          {option.programName} · {option.academicYearName} ·{' '}
                          {option.gradeLevelLabel}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Offer expires
                    <input name="expiresAt" type="datetime-local" required />
                  </label>
                </>
              ) : null}
              {candidate.action === 'accept-offer' ? (
                <p>
                  Checklist and contract requirements are already verified by the server-owned
                  queue. Confirm to record acceptance of this unexpired offer.
                </p>
              ) : null}
              {candidate.action === 'convert-applicant' ? (
                <label>
                  Enrollment effective date
                  <input
                    name="effectiveFrom"
                    type="date"
                    required
                    min={candidate.suggestedEffectiveFrom ?? undefined}
                    max={candidate.effectiveFromMax ?? undefined}
                    defaultValue={candidate.suggestedEffectiveFrom ?? undefined}
                  />
                </label>
              ) : null}
              <button type="submit" disabled={pending}>
                {pending ? 'Submitting…' : ACTION_LABELS[candidate.action]}
              </button>
            </form>
          )}
        </>
      )}
      {result === undefined ? null : resultMessage(result)}
    </section>
  );
}
