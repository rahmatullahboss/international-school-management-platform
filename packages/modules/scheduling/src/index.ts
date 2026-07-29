import { AppendOnlyAuditLog, createDomainEvent, type DomainEvent } from '@school/events';

export type TimetableState = 'draft' | 'published' | 'superseded';
export type ConflictResourceType = 'teacher' | 'room' | 'student' | 'section';

export interface TimetableVersion {
  tenantId: string;
  timetableVersionId: string;
  academicYearId: string;
  termId: string;
  campusId: string;
  name: string;
  effectiveFrom: string;
  effectiveTo?: string;
  state: TimetableState;
  version: number;
}

export interface MeetingPattern {
  tenantId: string;
  meetingPatternId: string;
  timetableVersionId: string;
  sectionId: string;
  weekday: number;
  startsAt: string;
  endsAt: string;
  timezone: string;
  roomId?: string;
  teacherIds: readonly string[];
  studentIds: readonly string[];
  validFrom: string;
  validTo?: string;
  version: number;
}

export interface ScheduledClassMeeting {
  tenantId: string;
  scheduledMeetingId: string;
  timetableVersionId: string;
  meetingPatternId: string;
  sectionId: string;
  localDate: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  roomId?: string;
  teacherIds: readonly string[];
  studentIds: readonly string[];
  status: 'scheduled' | 'cancelled';
  version: number;
}

export interface ScheduleConflict {
  conflictId: string;
  timetableVersionId: string;
  leftMeetingId: string;
  rightMeetingId: string;
  resourceType: ConflictResourceType;
  resourceId: string;
  severity: 'blocking' | 'warning';
  detectedAt: string;
}

export interface SubstitutionAssignment {
  substitutionId: string;
  scheduledMeetingId: string;
  substituteTeacherId?: string;
  temporaryRoomId?: string;
  reasonCode: string;
  effectiveDate: string;
  createdBy: string;
  createdAt: string;
}

export interface ResolvedMeeting extends ScheduledClassMeeting {
  baseTeacherIds: readonly string[];
  baseRoomId?: string;
  substitution?: SubstitutionAssignment;
}

export interface SchedulingCommandResult<T> {
  value: T;
  events: readonly DomainEvent<unknown>[];
}

export class SchedulingDomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'SchedulingDomainError';
  }
}

function assertPeriod(from: string, to?: string): void {
  if (to !== undefined && to < from) {
    throw new SchedulingDomainError('SCHEDULE_PERIOD_INVALID', 'Schedule period is invalid');
  }
}

function assertTimeRange(startsAt: string, endsAt: string): void {
  if (endsAt <= startsAt) {
    throw new SchedulingDomainError('SCHEDULE_TIME_INVALID', 'Meeting end must follow its start');
  }
}

function timeOverlap(
  leftStart: string,
  leftEnd: string,
  rightStart: string,
  rightEnd: string,
): boolean {
  return leftStart < rightEnd && rightStart < leftEnd;
}

function clonePattern(pattern: MeetingPattern): MeetingPattern {
  return {
    ...pattern,
    teacherIds: [...pattern.teacherIds],
    studentIds: [...pattern.studentIds],
  };
}

function cloneMeeting(meeting: ScheduledClassMeeting): ScheduledClassMeeting {
  return {
    ...meeting,
    teacherIds: [...meeting.teacherIds],
    studentIds: [...meeting.studentIds],
  };
}

export class TimetableRegistry {
  readonly #versions = new Map<string, TimetableVersion>();
  readonly #patterns = new Map<string, MeetingPattern>();
  readonly #meetings = new Map<string, ScheduledClassMeeting>();
  readonly #conflicts = new Map<string, ScheduleConflict>();
  readonly #substitutions = new Map<string, SubstitutionAssignment>();
  readonly #idempotency = new Map<string, string>();
  readonly #audit = new AppendOnlyAuditLog();

  get auditLog(): AppendOnlyAuditLog {
    return this.#audit;
  }

  createTimetable(input: {
    tenantId: string;
    idempotencyKey: string;
    academicYearId: string;
    termId: string;
    campusId: string;
    name: string;
    effectiveFrom: string;
    effectiveTo?: string;
    correlationId: string;
  }): SchedulingCommandResult<TimetableVersion> {
    assertPeriod(input.effectiveFrom, input.effectiveTo);
    const retryKey = `${input.tenantId}:timetable:${input.idempotencyKey}`;
    const replayId = this.#idempotency.get(retryKey);
    if (replayId) {
      return { value: { ...this.#requireVersion(input.tenantId, replayId) }, events: [] };
    }
    const timetable: TimetableVersion = {
      tenantId: input.tenantId,
      timetableVersionId: crypto.randomUUID(),
      academicYearId: input.academicYearId,
      termId: input.termId,
      campusId: input.campusId,
      name: input.name,
      effectiveFrom: input.effectiveFrom,
      ...(input.effectiveTo === undefined ? {} : { effectiveTo: input.effectiveTo }),
      state: 'draft',
      version: 1,
    };
    this.#versions.set(timetable.timetableVersionId, timetable);
    this.#idempotency.set(retryKey, timetable.timetableVersionId);
    return this.#result(timetable, 'schedule.timetable.created.v1', input.correlationId);
  }

  addMeetingPattern(input: {
    tenantId: string;
    timetableVersionId: string;
    sectionId: string;
    weekday: number;
    startsAt: string;
    endsAt: string;
    timezone: string;
    roomId?: string;
    teacherIds: readonly string[];
    studentIds?: readonly string[];
    validFrom: string;
    validTo?: string;
    correlationId: string;
  }): SchedulingCommandResult<MeetingPattern> {
    const timetable = this.#requireDraft(input.tenantId, input.timetableVersionId);
    assertTimeRange(input.startsAt, input.endsAt);
    assertPeriod(input.validFrom, input.validTo);
    if (!Number.isInteger(input.weekday) || input.weekday < 0 || input.weekday > 6) {
      throw new SchedulingDomainError(
        'SCHEDULE_WEEKDAY_INVALID',
        'Weekday must be between 0 and 6',
      );
    }
    const pattern: MeetingPattern = {
      tenantId: input.tenantId,
      meetingPatternId: crypto.randomUUID(),
      timetableVersionId: input.timetableVersionId,
      sectionId: input.sectionId,
      weekday: input.weekday,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      timezone: input.timezone,
      ...(input.roomId === undefined ? {} : { roomId: input.roomId }),
      teacherIds: [...new Set(input.teacherIds)],
      studentIds: [...new Set(input.studentIds ?? [])],
      validFrom: input.validFrom,
      ...(input.validTo === undefined ? {} : { validTo: input.validTo }),
      version: 1,
    };
    this.#patterns.set(pattern.meetingPatternId, pattern);
    timetable.version += 1;
    return this.#result(
      clonePattern(pattern),
      'schedule.meeting-pattern.created.v1',
      input.correlationId,
    );
  }

  materializeMeeting(input: {
    tenantId: string;
    meetingPatternId: string;
    localDate: string;
    correlationId: string;
  }): SchedulingCommandResult<ScheduledClassMeeting> {
    const pattern = this.#requirePattern(input.tenantId, input.meetingPatternId);
    this.#requireDraft(input.tenantId, pattern.timetableVersionId);
    const actualWeekday = new Date(`${input.localDate}T00:00:00Z`).getUTCDay();
    if (
      actualWeekday !== pattern.weekday ||
      input.localDate < pattern.validFrom ||
      (pattern.validTo !== undefined && input.localDate > pattern.validTo)
    ) {
      throw new SchedulingDomainError(
        'SCHEDULE_MEETING_DATE_INVALID',
        'Meeting date does not match the pattern',
      );
    }
    const duplicate = [...this.#meetings.values()].find(
      (meeting) =>
        meeting.tenantId === input.tenantId &&
        meeting.meetingPatternId === input.meetingPatternId &&
        meeting.localDate === input.localDate,
    );
    if (duplicate) return { value: cloneMeeting(duplicate), events: [] };
    const meeting: ScheduledClassMeeting = {
      tenantId: input.tenantId,
      scheduledMeetingId: crypto.randomUUID(),
      timetableVersionId: pattern.timetableVersionId,
      meetingPatternId: pattern.meetingPatternId,
      sectionId: pattern.sectionId,
      localDate: input.localDate,
      startsAt: pattern.startsAt,
      endsAt: pattern.endsAt,
      timezone: pattern.timezone,
      ...(pattern.roomId === undefined ? {} : { roomId: pattern.roomId }),
      teacherIds: [...pattern.teacherIds],
      studentIds: [...pattern.studentIds],
      status: 'scheduled',
      version: 1,
    };
    this.#meetings.set(meeting.scheduledMeetingId, meeting);
    this.#detectConflicts(meeting);
    return this.#result(
      cloneMeeting(meeting),
      'schedule.meeting.materialized.v1',
      input.correlationId,
    );
  }

  publish(input: {
    tenantId: string;
    timetableVersionId: string;
    correlationId: string;
  }): SchedulingCommandResult<TimetableVersion> {
    const timetable = this.#requireDraft(input.tenantId, input.timetableVersionId);
    const blockers = this.conflicts(input.tenantId, input.timetableVersionId).filter(
      (conflict) => conflict.severity === 'blocking',
    );
    if (blockers.length > 0) {
      throw new SchedulingDomainError(
        'SCHEDULE_CONFLICTS_BLOCK_PUBLICATION',
        `Timetable has ${blockers.length} blocking conflicts`,
      );
    }
    const meetingCount = [...this.#meetings.values()].filter(
      (meeting) =>
        meeting.tenantId === input.tenantId &&
        meeting.timetableVersionId === input.timetableVersionId,
    ).length;
    if (meetingCount === 0) {
      throw new SchedulingDomainError(
        'SCHEDULE_EMPTY',
        'A timetable cannot be published without meetings',
      );
    }
    timetable.state = 'published';
    timetable.version += 1;
    return this.#result({ ...timetable }, 'schedule.timetable.published.v1', input.correlationId);
  }

  substitute(input: {
    tenantId: string;
    scheduledMeetingId: string;
    substituteTeacherId?: string;
    temporaryRoomId?: string;
    reasonCode: string;
    effectiveDate: string;
    createdBy: string;
    correlationId: string;
  }): SchedulingCommandResult<SubstitutionAssignment> {
    const meeting = this.#requireMeeting(input.tenantId, input.scheduledMeetingId);
    const timetable = this.#requireVersion(input.tenantId, meeting.timetableVersionId);
    if (timetable.state !== 'published') {
      throw new SchedulingDomainError(
        'SCHEDULE_SUBSTITUTION_REQUIRES_PUBLISHED',
        'Substitution applies only to a published timetable',
      );
    }
    if (
      input.effectiveDate !== meeting.localDate ||
      (input.substituteTeacherId === undefined && input.temporaryRoomId === undefined)
    ) {
      throw new SchedulingDomainError('SCHEDULE_SUBSTITUTION_INVALID', 'Substitution is invalid');
    }
    const existing = [...this.#substitutions.values()].find(
      (item) => item.scheduledMeetingId === input.scheduledMeetingId,
    );
    if (existing) {
      throw new SchedulingDomainError(
        'SCHEDULE_SUBSTITUTION_EXISTS',
        'A substitution already exists for this meeting',
      );
    }
    const substitution: SubstitutionAssignment = {
      substitutionId: crypto.randomUUID(),
      scheduledMeetingId: input.scheduledMeetingId,
      ...(input.substituteTeacherId === undefined
        ? {}
        : { substituteTeacherId: input.substituteTeacherId }),
      ...(input.temporaryRoomId === undefined ? {} : { temporaryRoomId: input.temporaryRoomId }),
      reasonCode: input.reasonCode,
      effectiveDate: input.effectiveDate,
      createdBy: input.createdBy,
      createdAt: new Date().toISOString(),
    };
    this.#substitutions.set(substitution.substitutionId, substitution);
    return this.#result(
      substitution,
      'schedule.substitution.created.v1',
      input.correlationId,
      input.tenantId,
    );
  }

  resolveMeeting(tenantId: string, scheduledMeetingId: string): ResolvedMeeting {
    const meeting = this.#requireMeeting(tenantId, scheduledMeetingId);
    const substitution = [...this.#substitutions.values()].find(
      (item) => item.scheduledMeetingId === scheduledMeetingId,
    );
    return {
      ...cloneMeeting(meeting),
      baseTeacherIds: [...meeting.teacherIds],
      ...(meeting.roomId === undefined ? {} : { baseRoomId: meeting.roomId }),
      teacherIds:
        substitution?.substituteTeacherId === undefined
          ? [...meeting.teacherIds]
          : [substitution.substituteTeacherId],
      ...(substitution?.temporaryRoomId === undefined
        ? meeting.roomId === undefined
          ? {}
          : { roomId: meeting.roomId }
        : { roomId: substitution.temporaryRoomId }),
      ...(substitution === undefined ? {} : { substitution: { ...substitution } }),
    };
  }

  conflicts(tenantId: string, timetableVersionId: string): readonly ScheduleConflict[] {
    this.#requireVersion(tenantId, timetableVersionId);
    return [...this.#conflicts.values()]
      .filter((conflict) => conflict.timetableVersionId === timetableVersionId)
      .map((conflict) => ({ ...conflict }));
  }

  scheduleForTeacher(
    tenantId: string,
    timetableVersionId: string,
    teacherId: string,
  ): readonly ResolvedMeeting[] {
    this.#requireVersion(tenantId, timetableVersionId);
    return [...this.#meetings.values()]
      .filter(
        (meeting) =>
          meeting.tenantId === tenantId &&
          meeting.timetableVersionId === timetableVersionId &&
          this.resolveMeeting(tenantId, meeting.scheduledMeetingId).teacherIds.includes(teacherId),
      )
      .map((meeting) => this.resolveMeeting(tenantId, meeting.scheduledMeetingId))
      .sort((left, right) =>
        `${left.localDate}:${left.startsAt}`.localeCompare(`${right.localDate}:${right.startsAt}`),
      );
  }

  scheduleForStudent(
    tenantId: string,
    timetableVersionId: string,
    studentId: string,
  ): readonly ResolvedMeeting[] {
    this.#requireVersion(tenantId, timetableVersionId);
    return [...this.#meetings.values()]
      .filter(
        (meeting) =>
          meeting.tenantId === tenantId &&
          meeting.timetableVersionId === timetableVersionId &&
          meeting.studentIds.includes(studentId),
      )
      .map((meeting) => this.resolveMeeting(tenantId, meeting.scheduledMeetingId))
      .sort((left, right) =>
        `${left.localDate}:${left.startsAt}`.localeCompare(`${right.localDate}:${right.startsAt}`),
      );
  }

  #detectConflicts(meeting: ScheduledClassMeeting): void {
    const candidates = [...this.#meetings.values()].filter(
      (candidate) =>
        candidate.scheduledMeetingId !== meeting.scheduledMeetingId &&
        candidate.tenantId === meeting.tenantId &&
        candidate.timetableVersionId === meeting.timetableVersionId &&
        candidate.localDate === meeting.localDate &&
        candidate.status === 'scheduled' &&
        timeOverlap(candidate.startsAt, candidate.endsAt, meeting.startsAt, meeting.endsAt),
    );
    for (const candidate of candidates) {
      const resources: Array<{ type: ConflictResourceType; id: string }> = [];
      if (candidate.sectionId === meeting.sectionId) {
        resources.push({ type: 'section', id: meeting.sectionId });
      }
      if (candidate.roomId !== undefined && candidate.roomId === meeting.roomId) {
        resources.push({ type: 'room', id: candidate.roomId });
      }
      for (const teacherId of meeting.teacherIds.filter((id) =>
        candidate.teacherIds.includes(id),
      )) {
        resources.push({ type: 'teacher', id: teacherId });
      }
      for (const studentId of meeting.studentIds.filter((id) =>
        candidate.studentIds.includes(id),
      )) {
        resources.push({ type: 'student', id: studentId });
      }
      for (const resource of resources) {
        const conflict: ScheduleConflict = {
          conflictId: crypto.randomUUID(),
          timetableVersionId: meeting.timetableVersionId,
          leftMeetingId: candidate.scheduledMeetingId,
          rightMeetingId: meeting.scheduledMeetingId,
          resourceType: resource.type,
          resourceId: resource.id,
          severity: 'blocking',
          detectedAt: new Date().toISOString(),
        };
        this.#conflicts.set(conflict.conflictId, conflict);
      }
    }
  }

  #requireVersion(tenantId: string, timetableVersionId: string): TimetableVersion {
    const timetable = this.#versions.get(timetableVersionId);
    if (!timetable || timetable.tenantId !== tenantId) {
      throw new SchedulingDomainError('SCHEDULE_TIMETABLE_NOT_FOUND', 'Timetable was not found');
    }
    return timetable;
  }

  #requireDraft(tenantId: string, timetableVersionId: string): TimetableVersion {
    const timetable = this.#requireVersion(tenantId, timetableVersionId);
    if (timetable.state !== 'draft') {
      throw new SchedulingDomainError(
        'SCHEDULE_PUBLISHED_IMMUTABLE',
        'Published timetable versions are immutable',
      );
    }
    return timetable;
  }

  #requirePattern(tenantId: string, meetingPatternId: string): MeetingPattern {
    const pattern = this.#patterns.get(meetingPatternId);
    if (!pattern || pattern.tenantId !== tenantId) {
      throw new SchedulingDomainError(
        'SCHEDULE_PATTERN_NOT_FOUND',
        'Meeting pattern was not found',
      );
    }
    return pattern;
  }

  #requireMeeting(tenantId: string, scheduledMeetingId: string): ScheduledClassMeeting {
    const meeting = this.#meetings.get(scheduledMeetingId);
    if (!meeting || meeting.tenantId !== tenantId) {
      throw new SchedulingDomainError(
        'SCHEDULE_MEETING_NOT_FOUND',
        'Scheduled meeting was not found',
      );
    }
    return meeting;
  }

  #result<
    T extends { tenantId?: string; timetableVersionId?: string; scheduledMeetingId?: string },
  >(
    value: T,
    eventType: string,
    correlationId: string,
    explicitTenantId?: string,
  ): SchedulingCommandResult<T> {
    const tenantId = explicitTenantId ?? value.tenantId;
    if (!tenantId)
      throw new SchedulingDomainError('SCHEDULE_TENANT_REQUIRED', 'Tenant is required');
    const aggregateId = value.scheduledMeetingId ?? value.timetableVersionId ?? crypto.randomUUID();
    this.#audit.append({ tenantId, action: eventType, subjectId: aggregateId });
    return {
      value,
      events: [
        createDomainEvent({
          eventType,
          schemaVersion: 1,
          tenantId,
          aggregateType: 'timetable',
          aggregateId,
          aggregateVersion:
            'version' in value && typeof value.version === 'number' ? value.version : 1,
          correlationId,
          payload: value,
        }),
      ],
    };
  }
}
