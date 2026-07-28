export interface MigrationTemplateEntity {
  entityType: string;
  filePattern: string;
  requiredColumns: readonly string[];
  naturalKeyColumns: readonly string[];
}

export interface MigrationSourceTemplate {
  templateKey: string;
  version: number;
  sourceProduct: string;
  entities: readonly Readonly<MigrationTemplateEntity>[];
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
  }
  return value;
}

function cloneAndFreeze<T>(value: T): Readonly<T> {
  return deepFreeze(structuredClone(value));
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest('SHA-256', copy.buffer);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Text(value: string): Promise<string> {
  return sha256Bytes(new TextEncoder().encode(value));
}

export class SourceTemplateRegistry {
  readonly #templates = new Map<string, Readonly<MigrationSourceTemplate>>();

  publish(template: MigrationSourceTemplate): Readonly<MigrationSourceTemplate> {
    if (template.version < 1) throw new Error('Migration source-template version must be positive');
    if (template.entities.length === 0)
      throw new Error('Migration source template requires entities');
    const key = `${template.templateKey}@${template.version}`;
    if (this.#templates.has(key)) {
      throw new Error('Migration source-template version is immutable');
    }
    const published = cloneAndFreeze(template);
    this.#templates.set(key, published);
    return published;
  }

  resolve(templateKey: string, version: number): Readonly<MigrationSourceTemplate> | undefined {
    return this.#templates.get(`${templateKey}@${version}`);
  }
}

export interface MigrationProject {
  projectId: string;
  tenantId: string;
  name: string;
  sourceSystem: string;
  targetEnvironment: string;
  status: 'draft' | 'active' | 'cutover-approved' | 'closed';
  createdAt: Date;
}

export interface MigrationProjectVersion {
  projectId: string;
  version: number;
  templateReference: string;
  mappingSnapshot: Readonly<Record<string, unknown>>;
  transformationSnapshot: Readonly<Record<string, unknown>>;
  configurationChecksum: string;
  createdBy: string;
  createdAt: Date;
}

export interface MigrationFileEvidence {
  projectId: string;
  version: number;
  fileName: string;
  mediaType: string;
  byteLength: number;
  checksum: string;
  registeredAt: Date;
}

export interface MigrationRun {
  runId: string;
  runKey: string;
  projectId: string;
  version: number;
  status: 'running' | 'completed' | 'completed-with-errors';
  configurationChecksum: string;
  fileChecksums: readonly string[];
  startedAt: Date;
  completedAt: Date | null;
}

export interface MigrationReconciliation {
  runId: string;
  entityType: string;
  metric: string;
  expected: number;
  actual: number;
  difference: number;
  passed: boolean;
  recordedAt: Date;
}

export interface CutoverChecklistItem {
  item: string;
  completedBy: string | null;
  completedAt: Date | null;
}

export interface MigrationCutover {
  cutoverId: string;
  projectId: string;
  version: number;
  runId: string;
  checklist: readonly Readonly<CutoverChecklistItem>[];
  rollbackPlan: string;
  status: 'pending' | 'approved' | 'rejected';
  signedBy: string | null;
  signedAt: Date | null;
  decisionNote: string | null;
}

export interface MigrationStudioOptions {
  idFactory?: () => string;
  now?: () => Date;
}

export class MigrationStudio {
  readonly templates = new SourceTemplateRegistry();
  readonly #projects = new Map<string, Readonly<MigrationProject>>();
  readonly #versions = new Map<string, Readonly<MigrationProjectVersion>[]>();
  readonly #files = new Map<string, Readonly<MigrationFileEvidence>>();
  readonly #runs = new Map<string, Readonly<MigrationRun>>();
  readonly #runByKey = new Map<string, string>();
  readonly #reconciliations = new Map<string, Readonly<MigrationReconciliation>>();
  readonly #cutovers = new Map<string, Readonly<MigrationCutover>>();
  readonly #idFactory: () => string;
  readonly #now: () => Date;

  constructor(options: MigrationStudioOptions = {}) {
    this.#idFactory = options.idFactory ?? (() => crypto.randomUUID());
    this.#now = options.now ?? (() => new Date());
  }

  createProject(input: {
    tenantId: string;
    name: string;
    sourceSystem: string;
    targetEnvironment: string;
  }): Readonly<MigrationProject> {
    const projectId = this.#idFactory();
    if (this.#projects.has(projectId))
      throw new Error('Migration project identifier already exists');
    const project = cloneAndFreeze<MigrationProject>({
      ...input,
      projectId,
      status: 'draft',
      createdAt: this.#now(),
    });
    this.#projects.set(projectId, project);
    return project;
  }

  async createVersion(input: {
    projectId: string;
    templateKey: string;
    templateVersion: number;
    mappingSnapshot: Readonly<Record<string, unknown>>;
    transformationSnapshot: Readonly<Record<string, unknown>>;
    createdBy: string;
  }): Promise<Readonly<MigrationProjectVersion>> {
    this.#requireProject(input.projectId);
    const template = this.templates.resolve(input.templateKey, input.templateVersion);
    if (!template) throw new Error('Unknown migration source template');
    const existing = this.#versions.get(input.projectId) ?? [];
    const configurationChecksum = await sha256Text(
      stableStringify({
        templateReference: `${input.templateKey}@${input.templateVersion}`,
        mappingSnapshot: input.mappingSnapshot,
        transformationSnapshot: input.transformationSnapshot,
      }),
    );
    const version = cloneAndFreeze<MigrationProjectVersion>({
      projectId: input.projectId,
      version: existing.length + 1,
      templateReference: `${input.templateKey}@${input.templateVersion}`,
      mappingSnapshot: input.mappingSnapshot,
      transformationSnapshot: input.transformationSnapshot,
      configurationChecksum,
      createdBy: input.createdBy,
      createdAt: this.#now(),
    });
    this.#versions.set(input.projectId, [...existing, version]);
    return version;
  }

  async registerFile(input: {
    projectId: string;
    version: number;
    fileName: string;
    bytes: Uint8Array;
    mediaType: string;
  }): Promise<Readonly<MigrationFileEvidence>> {
    this.#requireVersion(input.projectId, input.version);
    const checksum = await sha256Bytes(input.bytes);
    const key = `${input.projectId}:${input.version}:${input.fileName}`;
    const existing = this.#files.get(key);
    if (existing) {
      if (existing.checksum !== checksum) {
        throw new Error('Migration file name is already registered with another checksum');
      }
      return existing;
    }
    const evidence = cloneAndFreeze<MigrationFileEvidence>({
      projectId: input.projectId,
      version: input.version,
      fileName: input.fileName,
      mediaType: input.mediaType,
      byteLength: input.bytes.byteLength,
      checksum,
      registeredAt: this.#now(),
    });
    this.#files.set(key, evidence);
    return evidence;
  }

  async startRun(projectId: string, versionNumber: number): Promise<Readonly<MigrationRun>> {
    const version = this.#requireVersion(projectId, versionNumber);
    const files = [...this.#files.values()]
      .filter((file) => file.projectId === projectId && file.version === versionNumber)
      .sort((left, right) => left.fileName.localeCompare(right.fileName));
    if (files.length === 0) throw new Error('Migration run requires registered source files');
    const fileChecksums = files.map((file) => file.checksum);
    const runKey = await sha256Text(
      stableStringify({
        projectId,
        version: versionNumber,
        configurationChecksum: version.configurationChecksum,
        fileChecksums,
      }),
    );
    const existingId = this.#runByKey.get(runKey);
    if (existingId) return this.#requireRun(existingId);
    const run = cloneAndFreeze<MigrationRun>({
      runId: this.#idFactory(),
      runKey,
      projectId,
      version: versionNumber,
      status: 'running',
      configurationChecksum: version.configurationChecksum,
      fileChecksums,
      startedAt: this.#now(),
      completedAt: null,
    });
    this.#runs.set(run.runId, run);
    this.#runByKey.set(runKey, run.runId);
    return run;
  }

  recordReconciliation(input: {
    runId: string;
    entityType: string;
    metric: string;
    expected: number;
    actual: number;
  }): Readonly<MigrationReconciliation> {
    this.#requireRun(input.runId);
    if (!Number.isFinite(input.expected) || !Number.isFinite(input.actual)) {
      throw new Error('Reconciliation values must be finite');
    }
    const record = cloneAndFreeze<MigrationReconciliation>({
      ...input,
      difference: input.actual - input.expected,
      passed: input.actual === input.expected,
      recordedAt: this.#now(),
    });
    this.#reconciliations.set(`${input.runId}:${input.entityType}:${input.metric}`, record);
    return record;
  }

  completeRun(runId: string): Readonly<MigrationRun> {
    const run = this.#requireRun(runId);
    const reconciliation = this.#runReconciliations(runId);
    if (reconciliation.length === 0)
      throw new Error('Migration run requires reconciliation evidence');
    const completed = cloneAndFreeze<MigrationRun>({
      ...run,
      status: reconciliation.every((entry) => entry.passed) ? 'completed' : 'completed-with-errors',
      completedAt: this.#now(),
    });
    this.#runs.set(runId, completed);
    return completed;
  }

  createCutover(input: {
    projectId: string;
    version: number;
    runId: string;
    checklist: readonly string[];
    rollbackPlan: string;
  }): Readonly<MigrationCutover> {
    this.#requireVersion(input.projectId, input.version);
    const run = this.#requireRun(input.runId);
    if (run.projectId !== input.projectId || run.version !== input.version) {
      throw new Error('Cutover run does not match project version');
    }
    if (input.checklist.length === 0) throw new Error('Cutover checklist is required');
    if (input.rollbackPlan.trim().length === 0)
      throw new Error('Cutover rollback plan is required');
    const cutover = cloneAndFreeze<MigrationCutover>({
      cutoverId: this.#idFactory(),
      projectId: input.projectId,
      version: input.version,
      runId: input.runId,
      checklist: [...new Set(input.checklist)].map((item) => ({
        item,
        completedBy: null,
        completedAt: null,
      })),
      rollbackPlan: input.rollbackPlan,
      status: 'pending',
      signedBy: null,
      signedAt: null,
      decisionNote: null,
    });
    this.#cutovers.set(cutover.cutoverId, cutover);
    return cutover;
  }

  completeChecklist(
    cutoverId: string,
    item: string,
    completedBy: string,
  ): Readonly<MigrationCutover> {
    const cutover = this.#requireCutover(cutoverId);
    const found = cutover.checklist.some((entry) => entry.item === item);
    if (!found) throw new Error('Unknown cutover checklist item');
    const updated = cloneAndFreeze<MigrationCutover>({
      ...cutover,
      checklist: cutover.checklist.map((entry) =>
        entry.item === item ? { ...entry, completedBy, completedAt: this.#now() } : entry,
      ),
    });
    this.#cutovers.set(cutoverId, updated);
    return updated;
  }

  signOffCutover(
    cutoverId: string,
    signedBy: string,
    decision: 'approved' | 'rejected',
    decisionNote: string | null = null,
  ): Readonly<MigrationCutover> {
    const cutover = this.#requireCutover(cutoverId);
    if (decision === 'approved') {
      const reconciliation = this.#runReconciliations(cutover.runId);
      if (reconciliation.length === 0 || reconciliation.some((entry) => !entry.passed)) {
        throw new Error('Cutover reconciliation has unresolved failures');
      }
      if (cutover.checklist.some((entry) => entry.completedAt === null)) {
        throw new Error('Cutover checklist is incomplete');
      }
    }
    const signed = cloneAndFreeze<MigrationCutover>({
      ...cutover,
      status: decision,
      signedBy,
      signedAt: this.#now(),
      decisionNote,
    });
    this.#cutovers.set(cutoverId, signed);
    if (decision === 'approved') {
      const project = this.#requireProject(cutover.projectId);
      this.#projects.set(
        project.projectId,
        cloneAndFreeze({ ...project, status: 'cutover-approved' as const }),
      );
    }
    return signed;
  }

  #requireProject(projectId: string): Readonly<MigrationProject> {
    const project = this.#projects.get(projectId);
    if (!project) throw new Error('Unknown migration project');
    return project;
  }

  #requireVersion(projectId: string, version: number): Readonly<MigrationProjectVersion> {
    this.#requireProject(projectId);
    const found = this.#versions.get(projectId)?.find((entry) => entry.version === version);
    if (!found) throw new Error('Unknown migration project version');
    return found;
  }

  #requireRun(runId: string): Readonly<MigrationRun> {
    const run = this.#runs.get(runId);
    if (!run) throw new Error('Unknown migration run');
    return run;
  }

  #requireCutover(cutoverId: string): Readonly<MigrationCutover> {
    const cutover = this.#cutovers.get(cutoverId);
    if (!cutover) throw new Error('Unknown migration cutover');
    return cutover;
  }

  #runReconciliations(runId: string): readonly Readonly<MigrationReconciliation>[] {
    return [...this.#reconciliations.values()].filter((entry) => entry.runId === runId);
  }
}
