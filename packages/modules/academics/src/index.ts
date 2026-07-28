import { AppendOnlyAuditLog, createDomainEvent, type DomainEvent } from '@school/events';

export type PublicationState = 'draft' | 'published' | 'retired';
export type StaffAssignmentRole = 'teacher' | 'co-teacher' | 'assistant';

export interface AcademicYear {
  tenantId: string;
  academicYearId: string;
  code: string;
  name: string;
  startsOn: string;
  endsOn: string;
  state: PublicationState;
  version: number;
}

export interface AcademicTerm {
  tenantId: string;
  termId: string;
  academicYearId: string;
  code: string;
  name: string;
  startsOn: string;
  endsOn: string;
  sequence: number;
}

export interface CalendarDay {
  date: string;
  instructional: boolean;
  cycleDay?: string;
  label?: string;
}

export interface InstructionalCalendar {
  tenantId: string;
  calendarId: string;
  academicYearId: string;
  campusId: string;
  timezone: string;
  state: PublicationState;
  version: number;
  days: readonly CalendarDay[];
}

export interface BellPeriod {
  periodId: string;
  code: string;
  startsAt: string;
  endsAt: string;
  attendanceRequired: boolean;
}

export interface BellSchedule {
  tenantId: string;
  bellScheduleId: string;
  campusId: string;
  name: string;
  timezone: string;
  effectiveFrom: string;
  effectiveTo?: string;
  periods: readonly BellPeriod[];
  state: PublicationState;
  version: number;
}

export interface CurriculumVersion {
  tenantId: string;
  curriculumVersionId: string;
  curriculumKey: string;
  versionLabel: string;
  name: string;
  countryPackRef?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  state: PublicationState;
  version: number;
}

export interface ProgramVersion {
  tenantId: string;
  programVersionId: string;
  programKey: string;
  versionLabel: string;
  curriculumVersionId: string;
  name: string;
  gradeLevels: readonly string[];
  state: PublicationState;
  version: number;
}

export interface CourseVersion {
  tenantId: string;
  courseVersionId: string;
  courseKey: string;
  versionLabel: string;
  curriculumVersionId: string;
  code: string;
  title: string;
  credits: number;
  prerequisites: readonly string[];
  state: PublicationState;
  version: number;
}

export interface LearningStandard {
  tenantId: string;
  standardId: string;
  curriculumVersionId: string;
  code: string;
  description: string;
  parentStandardId?: string;
}

export interface ClassSection {
  tenantId: string;
  sectionId: string;
  courseVersionId: string;
  academicYearId: string;
  termId: string;
  campusId: string;
  code: string;
  title: string;
  capacity: number;
  state: PublicationState;
  version: number;
}

export interface StaffAssignment {
  assignmentId: string;
  sectionId: string;
  staffProfileId: string;
  role: StaffAssignmentRole;
  effectiveFrom: string;
  effectiveTo?: string;
}

export interface RosterEntry {
  rosterEntryId: string;
  sectionId: string;
  studentProfileId: string;
  enrollmentId: string;
  joinedOn: string;
  leftOn?: string;
}

export interface AcademicCommandResult<T> {
  value: T;
  events: readonly DomainEvent<unknown>[];
}

export class AcademicDomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AcademicDomainError';
  }
}

function assertIsoPeriod(startsOn: string, endsOn?: string): void {
  if (endsOn !== undefined && endsOn < startsOn) {
    throw new AcademicDomainError('ACAD_PERIOD_INVALID', 'The effective period is invalid');
  }
}

function overlaps(
  leftStart: string,
  leftEnd: string,
  rightStart: string,
  rightEnd: string,
): boolean {
  return leftStart <= rightEnd && rightStart <= leftEnd;
}

function cloneCalendar(calendar: InstructionalCalendar): InstructionalCalendar {
  return { ...calendar, days: calendar.days.map((day) => ({ ...day })) };
}

function cloneBellSchedule(schedule: BellSchedule): BellSchedule {
  return { ...schedule, periods: schedule.periods.map((period) => ({ ...period })) };
}

function cloneProgram(program: ProgramVersion): ProgramVersion {
  return { ...program, gradeLevels: [...program.gradeLevels] };
}

function cloneCourse(course: CourseVersion): CourseVersion {
  return { ...course, prerequisites: [...course.prerequisites] };
}

export class AcademicRegistry {
  readonly #years = new Map<string, AcademicYear>();
  readonly #terms = new Map<string, AcademicTerm>();
  readonly #calendars = new Map<string, InstructionalCalendar>();
  readonly #bellSchedules = new Map<string, BellSchedule>();
  readonly #curricula = new Map<string, CurriculumVersion>();
  readonly #programs = new Map<string, ProgramVersion>();
  readonly #courses = new Map<string, CourseVersion>();
  readonly #standards = new Map<string, LearningStandard>();
  readonly #sections = new Map<string, ClassSection>();
  readonly #staffAssignments = new Map<string, StaffAssignment>();
  readonly #rosters = new Map<string, RosterEntry>();
  readonly #idempotency = new Map<string, string>();
  readonly #audit = new AppendOnlyAuditLog();

  get auditLog(): AppendOnlyAuditLog {
    return this.#audit;
  }

  createAcademicYear(input: {
    tenantId: string;
    idempotencyKey: string;
    code: string;
    name: string;
    startsOn: string;
    endsOn: string;
    correlationId: string;
  }): AcademicCommandResult<AcademicYear> {
    assertIsoPeriod(input.startsOn, input.endsOn);
    const replay = this.#replay<AcademicYear>(
      input.tenantId,
      'academic-year',
      input.idempotencyKey,
      this.#years,
    );
    if (replay) return { value: replay, events: [] };
    const duplicate = [...this.#years.values()].some(
      (year) => year.tenantId === input.tenantId && year.code === input.code,
    );
    if (duplicate) {
      throw new AcademicDomainError('ACAD_YEAR_CODE_EXISTS', 'Academic year code already exists');
    }
    const year: AcademicYear = {
      tenantId: input.tenantId,
      academicYearId: crypto.randomUUID(),
      code: input.code,
      name: input.name,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      state: 'draft',
      version: 1,
    };
    this.#years.set(year.academicYearId, year);
    this.#remember(input.tenantId, 'academic-year', input.idempotencyKey, year.academicYearId);
    return this.#result(year, 'academic.year.created.v1', input.correlationId);
  }

  addTerm(input: {
    tenantId: string;
    academicYearId: string;
    code: string;
    name: string;
    startsOn: string;
    endsOn: string;
    sequence: number;
    correlationId: string;
  }): AcademicCommandResult<AcademicTerm> {
    const year = this.#require(
      this.#years,
      input.tenantId,
      input.academicYearId,
      'ACAD_YEAR_NOT_FOUND',
    );
    this.#requireDraft(year.state, 'academic year');
    assertIsoPeriod(input.startsOn, input.endsOn);
    if (input.startsOn < year.startsOn || input.endsOn > year.endsOn) {
      throw new AcademicDomainError(
        'ACAD_TERM_OUTSIDE_YEAR',
        'Term must be inside the academic year',
      );
    }
    const collision = [...this.#terms.values()].some(
      (term) =>
        term.tenantId === input.tenantId &&
        term.academicYearId === input.academicYearId &&
        (term.code === input.code ||
          overlaps(term.startsOn, term.endsOn, input.startsOn, input.endsOn)),
    );
    if (collision) {
      throw new AcademicDomainError('ACAD_TERM_CONFLICT', 'Term code or date range conflicts');
    }
    const term: AcademicTerm = {
      tenantId: input.tenantId,
      termId: crypto.randomUUID(),
      academicYearId: input.academicYearId,
      code: input.code,
      name: input.name,
      startsOn: input.startsOn,
      endsOn: input.endsOn,
      sequence: input.sequence,
    };
    this.#terms.set(term.termId, term);
    year.version += 1;
    return this.#result(term, 'academic.term.created.v1', input.correlationId);
  }

  defineCalendar(input: {
    tenantId: string;
    academicYearId: string;
    campusId: string;
    timezone: string;
    days: readonly CalendarDay[];
    correlationId: string;
  }): AcademicCommandResult<InstructionalCalendar> {
    const year = this.#require(
      this.#years,
      input.tenantId,
      input.academicYearId,
      'ACAD_YEAR_NOT_FOUND',
    );
    this.#requireDraft(year.state, 'academic year');
    const seen = new Set<string>();
    const days = input.days.map((day) => {
      if (day.date < year.startsOn || day.date > year.endsOn || seen.has(day.date)) {
        throw new AcademicDomainError(
          'ACAD_CALENDAR_DAY_INVALID',
          'Calendar dates must be unique and inside the year',
        );
      }
      seen.add(day.date);
      return { ...day };
    });
    const calendar: InstructionalCalendar = {
      tenantId: input.tenantId,
      calendarId: crypto.randomUUID(),
      academicYearId: input.academicYearId,
      campusId: input.campusId,
      timezone: input.timezone,
      state: 'draft',
      version: 1,
      days,
    };
    this.#calendars.set(calendar.calendarId, calendar);
    return this.#result(
      cloneCalendar(calendar),
      'academic.calendar.created.v1',
      input.correlationId,
    );
  }

  defineBellSchedule(input: {
    tenantId: string;
    campusId: string;
    name: string;
    timezone: string;
    effectiveFrom: string;
    effectiveTo?: string;
    periods: readonly Omit<BellPeriod, 'periodId'>[];
    correlationId: string;
  }): AcademicCommandResult<BellSchedule> {
    assertIsoPeriod(input.effectiveFrom, input.effectiveTo);
    const periods = input.periods.map((period, index) => {
      if (period.endsAt <= period.startsAt) {
        throw new AcademicDomainError(
          'ACAD_BELL_PERIOD_INVALID',
          'Bell period end must follow its start',
        );
      }
      const previous = input.periods[index - 1];
      if (previous && previous.endsAt > period.startsAt) {
        throw new AcademicDomainError('ACAD_BELL_PERIOD_OVERLAP', 'Bell periods cannot overlap');
      }
      return { ...period, periodId: crypto.randomUUID() };
    });
    const schedule: BellSchedule = {
      tenantId: input.tenantId,
      bellScheduleId: crypto.randomUUID(),
      campusId: input.campusId,
      name: input.name,
      timezone: input.timezone,
      effectiveFrom: input.effectiveFrom,
      ...(input.effectiveTo === undefined ? {} : { effectiveTo: input.effectiveTo }),
      periods,
      state: 'draft',
      version: 1,
    };
    this.#bellSchedules.set(schedule.bellScheduleId, schedule);
    return this.#result(
      cloneBellSchedule(schedule),
      'academic.bell-schedule.created.v1',
      input.correlationId,
    );
  }

  createCurriculumVersion(input: {
    tenantId: string;
    curriculumKey: string;
    versionLabel: string;
    name: string;
    countryPackRef?: string;
    effectiveFrom: string;
    effectiveTo?: string;
    correlationId: string;
  }): AcademicCommandResult<CurriculumVersion> {
    assertIsoPeriod(input.effectiveFrom, input.effectiveTo);
    const duplicate = [...this.#curricula.values()].some(
      (item) =>
        item.tenantId === input.tenantId &&
        item.curriculumKey === input.curriculumKey &&
        item.versionLabel === input.versionLabel,
    );
    if (duplicate) {
      throw new AcademicDomainError(
        'ACAD_CURRICULUM_VERSION_EXISTS',
        'Curriculum version already exists',
      );
    }
    const curriculum: CurriculumVersion = {
      tenantId: input.tenantId,
      curriculumVersionId: crypto.randomUUID(),
      curriculumKey: input.curriculumKey,
      versionLabel: input.versionLabel,
      name: input.name,
      ...(input.countryPackRef === undefined ? {} : { countryPackRef: input.countryPackRef }),
      effectiveFrom: input.effectiveFrom,
      ...(input.effectiveTo === undefined ? {} : { effectiveTo: input.effectiveTo }),
      state: 'draft',
      version: 1,
    };
    this.#curricula.set(curriculum.curriculumVersionId, curriculum);
    return this.#result(curriculum, 'academic.curriculum-version.created.v1', input.correlationId);
  }

  createProgramVersion(input: {
    tenantId: string;
    programKey: string;
    versionLabel: string;
    curriculumVersionId: string;
    name: string;
    gradeLevels: readonly string[];
    correlationId: string;
  }): AcademicCommandResult<ProgramVersion> {
    this.#require(
      this.#curricula,
      input.tenantId,
      input.curriculumVersionId,
      'ACAD_CURRICULUM_NOT_FOUND',
    );
    if (
      new Set(input.gradeLevels).size !== input.gradeLevels.length ||
      input.gradeLevels.length === 0
    ) {
      throw new AcademicDomainError(
        'ACAD_PROGRAM_GRADES_INVALID',
        'Program grade levels must be unique and non-empty',
      );
    }
    const program: ProgramVersion = {
      tenantId: input.tenantId,
      programVersionId: crypto.randomUUID(),
      programKey: input.programKey,
      versionLabel: input.versionLabel,
      curriculumVersionId: input.curriculumVersionId,
      name: input.name,
      gradeLevels: [...input.gradeLevels],
      state: 'draft',
      version: 1,
    };
    this.#programs.set(program.programVersionId, program);
    return this.#result(
      cloneProgram(program),
      'academic.program-version.created.v1',
      input.correlationId,
    );
  }

  createCourseVersion(input: {
    tenantId: string;
    courseKey: string;
    versionLabel: string;
    curriculumVersionId: string;
    code: string;
    title: string;
    credits: number;
    prerequisites?: readonly string[];
    correlationId: string;
  }): AcademicCommandResult<CourseVersion> {
    this.#require(
      this.#curricula,
      input.tenantId,
      input.curriculumVersionId,
      'ACAD_CURRICULUM_NOT_FOUND',
    );
    if (!Number.isFinite(input.credits) || input.credits < 0) {
      throw new AcademicDomainError(
        'ACAD_COURSE_CREDITS_INVALID',
        'Course credits must be non-negative',
      );
    }
    const course: CourseVersion = {
      tenantId: input.tenantId,
      courseVersionId: crypto.randomUUID(),
      courseKey: input.courseKey,
      versionLabel: input.versionLabel,
      curriculumVersionId: input.curriculumVersionId,
      code: input.code,
      title: input.title,
      credits: input.credits,
      prerequisites: [...(input.prerequisites ?? [])],
      state: 'draft',
      version: 1,
    };
    this.#courses.set(course.courseVersionId, course);
    return this.#result(
      cloneCourse(course),
      'academic.course-version.created.v1',
      input.correlationId,
    );
  }

  addLearningStandard(input: {
    tenantId: string;
    curriculumVersionId: string;
    code: string;
    description: string;
    parentStandardId?: string;
    correlationId: string;
  }): AcademicCommandResult<LearningStandard> {
    this.#require(
      this.#curricula,
      input.tenantId,
      input.curriculumVersionId,
      'ACAD_CURRICULUM_NOT_FOUND',
    );
    if (input.parentStandardId !== undefined) {
      this.#require(
        this.#standards,
        input.tenantId,
        input.parentStandardId,
        'ACAD_STANDARD_PARENT_NOT_FOUND',
      );
    }
    const standard: LearningStandard = {
      tenantId: input.tenantId,
      standardId: crypto.randomUUID(),
      curriculumVersionId: input.curriculumVersionId,
      code: input.code,
      description: input.description,
      ...(input.parentStandardId === undefined ? {} : { parentStandardId: input.parentStandardId }),
    };
    this.#standards.set(standard.standardId, standard);
    return this.#result(standard, 'academic.learning-standard.created.v1', input.correlationId);
  }

  createSection(input: {
    tenantId: string;
    courseVersionId: string;
    academicYearId: string;
    termId: string;
    campusId: string;
    code: string;
    title: string;
    capacity: number;
    correlationId: string;
  }): AcademicCommandResult<ClassSection> {
    this.#require(this.#courses, input.tenantId, input.courseVersionId, 'ACAD_COURSE_NOT_FOUND');
    this.#require(this.#years, input.tenantId, input.academicYearId, 'ACAD_YEAR_NOT_FOUND');
    const term = this.#require(this.#terms, input.tenantId, input.termId, 'ACAD_TERM_NOT_FOUND');
    if (
      term.academicYearId !== input.academicYearId ||
      !Number.isInteger(input.capacity) ||
      input.capacity <= 0
    ) {
      throw new AcademicDomainError(
        'ACAD_SECTION_INVALID',
        'Section year, term or capacity is invalid',
      );
    }
    const section: ClassSection = {
      tenantId: input.tenantId,
      sectionId: crypto.randomUUID(),
      courseVersionId: input.courseVersionId,
      academicYearId: input.academicYearId,
      termId: input.termId,
      campusId: input.campusId,
      code: input.code,
      title: input.title,
      capacity: input.capacity,
      state: 'draft',
      version: 1,
    };
    this.#sections.set(section.sectionId, section);
    return this.#result(section, 'academic.class-section.created.v1', input.correlationId);
  }

  assignStaff(input: {
    tenantId: string;
    sectionId: string;
    staffProfileId: string;
    role: StaffAssignmentRole;
    effectiveFrom: string;
    effectiveTo?: string;
    correlationId: string;
  }): AcademicCommandResult<StaffAssignment> {
    const section = this.#require(
      this.#sections,
      input.tenantId,
      input.sectionId,
      'ACAD_SECTION_NOT_FOUND',
    );
    assertIsoPeriod(input.effectiveFrom, input.effectiveTo);
    const duplicate = [...this.#staffAssignments.values()].some(
      (assignment) =>
        assignment.sectionId === input.sectionId &&
        assignment.staffProfileId === input.staffProfileId &&
        assignment.role === input.role &&
        assignment.effectiveTo === undefined,
    );
    if (duplicate) {
      throw new AcademicDomainError(
        'ACAD_STAFF_ASSIGNMENT_EXISTS',
        'Staff assignment already exists',
      );
    }
    const assignment: StaffAssignment = {
      assignmentId: crypto.randomUUID(),
      sectionId: input.sectionId,
      staffProfileId: input.staffProfileId,
      role: input.role,
      effectiveFrom: input.effectiveFrom,
      ...(input.effectiveTo === undefined ? {} : { effectiveTo: input.effectiveTo }),
    };
    this.#staffAssignments.set(assignment.assignmentId, assignment);
    section.version += 1;
    return this.#result(
      assignment,
      'academic.staff-assignment.created.v1',
      input.correlationId,
      input.tenantId,
    );
  }

  enrollStudent(input: {
    tenantId: string;
    sectionId: string;
    studentProfileId: string;
    enrollmentId: string;
    joinedOn: string;
    correlationId: string;
  }): AcademicCommandResult<RosterEntry> {
    const section = this.#require(
      this.#sections,
      input.tenantId,
      input.sectionId,
      'ACAD_SECTION_NOT_FOUND',
    );
    const active = [...this.#rosters.values()].filter(
      (entry) => entry.sectionId === input.sectionId && entry.leftOn === undefined,
    );
    const existing = active.find((entry) => entry.studentProfileId === input.studentProfileId);
    if (existing) return { value: { ...existing }, events: [] };
    if (active.length >= section.capacity) {
      throw new AcademicDomainError('ACAD_SECTION_CAPACITY_REACHED', 'Section capacity is reached');
    }
    const roster: RosterEntry = {
      rosterEntryId: crypto.randomUUID(),
      sectionId: input.sectionId,
      studentProfileId: input.studentProfileId,
      enrollmentId: input.enrollmentId,
      joinedOn: input.joinedOn,
    };
    this.#rosters.set(roster.rosterEntryId, roster);
    section.version += 1;
    return this.#result(
      roster,
      'academic.roster-entry.created.v1',
      input.correlationId,
      input.tenantId,
    );
  }

  publish(input: {
    tenantId: string;
    aggregateType:
      | 'academic-year'
      | 'calendar'
      | 'bell-schedule'
      | 'curriculum'
      | 'program'
      | 'course'
      | 'section';
    aggregateId: string;
    correlationId: string;
  }): AcademicCommandResult<{ aggregateId: string; state: 'published'; version: number }> {
    const collection = this.#publicationCollection(input.aggregateType);
    const item = this.#require(
      collection,
      input.tenantId,
      input.aggregateId,
      'ACAD_AGGREGATE_NOT_FOUND',
    );
    if (item.state === 'published') {
      return {
        value: { aggregateId: input.aggregateId, state: 'published', version: item.version },
        events: [],
      };
    }
    if (item.state !== 'draft') {
      throw new AcademicDomainError(
        'ACAD_PUBLICATION_STATE_INVALID',
        'Only draft records can be published',
      );
    }
    item.state = 'published';
    item.version += 1;
    return this.#result(
      { aggregateId: input.aggregateId, state: 'published', version: item.version },
      `academic.${input.aggregateType}.published.v1`,
      input.correlationId,
      input.tenantId,
    );
  }

  listSections(tenantId: string, campusId?: string): readonly ClassSection[] {
    return [...this.#sections.values()]
      .filter(
        (section) =>
          section.tenantId === tenantId &&
          (campusId === undefined || section.campusId === campusId),
      )
      .map((section) => ({ ...section }));
  }

  sectionRoster(tenantId: string, sectionId: string): readonly RosterEntry[] {
    this.#require(this.#sections, tenantId, sectionId, 'ACAD_SECTION_NOT_FOUND');
    return [...this.#rosters.values()]
      .filter((entry) => entry.sectionId === sectionId)
      .map((entry) => ({ ...entry }));
  }

  sectionStaff(tenantId: string, sectionId: string): readonly StaffAssignment[] {
    this.#require(this.#sections, tenantId, sectionId, 'ACAD_SECTION_NOT_FOUND');
    return [...this.#staffAssignments.values()]
      .filter((entry) => entry.sectionId === sectionId)
      .map((entry) => ({ ...entry }));
  }

  getCourseVersion(tenantId: string, courseVersionId: string): CourseVersion {
    return cloneCourse(
      this.#require(this.#courses, tenantId, courseVersionId, 'ACAD_COURSE_NOT_FOUND'),
    );
  }

  #publicationCollection(
    type:
      | 'academic-year'
      | 'calendar'
      | 'bell-schedule'
      | 'curriculum'
      | 'program'
      | 'course'
      | 'section',
  ): Map<string, { tenantId: string; state: PublicationState; version: number }> {
    switch (type) {
      case 'academic-year':
        return this.#years;
      case 'calendar':
        return this.#calendars;
      case 'bell-schedule':
        return this.#bellSchedules;
      case 'curriculum':
        return this.#curricula;
      case 'program':
        return this.#programs;
      case 'course':
        return this.#courses;
      case 'section':
        return this.#sections;
    }
  }

  #requireDraft(state: PublicationState, label: string): void {
    if (state !== 'draft') {
      throw new AcademicDomainError('ACAD_PUBLISHED_IMMUTABLE', `Published ${label} is immutable`);
    }
  }

  #require<T extends { tenantId: string }>(
    map: Map<string, T>,
    tenantId: string,
    id: string,
    code: string,
  ): T {
    const value = map.get(id);
    if (!value || value.tenantId !== tenantId) {
      throw new AcademicDomainError(code, 'Academic record was not found');
    }
    return value;
  }

  #remember(tenantId: string, operation: string, key: string, aggregateId: string): void {
    this.#idempotency.set(`${tenantId}:${operation}:${key}`, aggregateId);
  }

  #replay<T extends { tenantId: string }>(
    tenantId: string,
    operation: string,
    key: string,
    map: Map<string, T>,
  ): T | undefined {
    const id = this.#idempotency.get(`${tenantId}:${operation}:${key}`);
    if (!id) return undefined;
    const value = map.get(id);
    return value && value.tenantId === tenantId ? { ...value } : undefined;
  }

  #result<
    T extends {
      tenantId?: string;
      academicYearId?: string;
      curriculumVersionId?: string;
      sectionId?: string;
      aggregateId?: string;
    },
  >(
    value: T,
    eventType: string,
    correlationId: string,
    explicitTenantId?: string,
  ): AcademicCommandResult<T> {
    const tenantId = explicitTenantId ?? value.tenantId;
    if (!tenantId) throw new AcademicDomainError('ACAD_TENANT_REQUIRED', 'Tenant is required');
    const aggregateId =
      value.aggregateId ??
      value.sectionId ??
      value.academicYearId ??
      value.curriculumVersionId ??
      crypto.randomUUID();
    this.#audit.append({ tenantId, action: eventType, subjectId: aggregateId });
    const event = createDomainEvent({
      eventType,
      schemaVersion: 1,
      tenantId,
      aggregateType: 'academic-record',
      aggregateId,
      aggregateVersion: 'version' in value && typeof value.version === 'number' ? value.version : 1,
      correlationId,
      payload: value,
    });
    return { value, events: [event] };
  }
}

export * from './application.js';
