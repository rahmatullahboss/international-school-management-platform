import { describe, expect, test } from 'vitest';

import {
  OneRosterCsvProfile,
  OneRosterRestContract,
  type OneRosterArchive,
} from '../../packages/modules/integrations/src/index.js';

const validArchive: OneRosterArchive = {
  'orgs.csv': [
    'sourcedId,status,dateLastModified,name,type,identifier,parentSourcedId',
    'org-1,active,2026-07-28T00:00:00Z,Example School,school,EXAMPLE,',
  ].join('\n'),
  'academicSessions.csv': [
    'sourcedId,status,dateLastModified,title,type,startDate,endDate,parentSourcedId,schoolYear',
    'year-2026,active,2026-07-28T00:00:00Z,2026 Academic Year,schoolYear,2026-01-01,2026-12-31,,2026',
  ].join('\n'),
  'courses.csv': [
    'sourcedId,status,dateLastModified,title,courseCode,grades,orgSourcedId,schoolYearSourcedId,subjects,subjectCodes',
    'course-math,active,2026-07-28T00:00:00Z,Mathematics,MATH-1,01,org-1,year-2026,Mathematics,MATH',
  ].join('\n'),
  'classes.csv': [
    'sourcedId,status,dateLastModified,title,classCode,classType,location,grades,subjects,courseSourcedId,schoolSourcedId,terms,periods,resources',
    'class-math-1,active,2026-07-28T00:00:00Z,Math Class 1,MATH-A,scheduled,Room 1,01,Mathematics,course-math,org-1,year-2026,P1,',
  ].join('\n'),
  'users.csv': [
    'sourcedId,status,dateLastModified,enabledUser,orgSourcedIds,role,username,userIds,givenName,familyName,middleName,identifier,email,phone,sms,grades,password',
    'user-student-1,active,2026-07-28T00:00:00Z,true,org-1,student,student1,,Jane,Doe,,S-1,jane@example.test,,,01,',
  ].join('\n'),
  'enrollments.csv': [
    'sourcedId,status,dateLastModified,classSourcedId,schoolSourcedId,userSourcedId,role,primary,beginDate,endDate',
    'enrollment-1,active,2026-07-28T00:00:00Z,class-math-1,org-1,user-student-1,student,true,2026-01-01,2026-12-31',
  ].join('\n'),
};

describe('OneRoster CSV profile', () => {
  test('declares a versioned supported profile without claiming the full standard', () => {
    const profile = new OneRosterCsvProfile();

    expect(profile.profile).toMatchObject({
      standard: 'OneRoster',
      standardVersion: '1.2',
      profileVersion: 1,
      mode: 'csv',
    });
    expect(profile.profile.requiredFiles).toEqual([
      'orgs.csv',
      'academicSessions.csv',
      'courses.csv',
      'classes.csv',
      'users.csv',
      'enrollments.csv',
    ]);
    expect(profile.profile.supportedObjects).toContain('enrollment');
  });

  test('validates a complete synthetic archive and resolves references', () => {
    const result = new OneRosterCsvProfile().validate(validArchive, 'full');

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.counts).toEqual({
      org: 1,
      academicSession: 1,
      course: 1,
      class: 1,
      user: 1,
      enrollment: 1,
    });
  });

  test('reports missing required headers and duplicate sourced IDs', () => {
    const archive = {
      ...validArchive,
      'users.csv': [
        'sourcedId,status,enabledUser,orgSourcedIds,role,username,givenName,familyName',
        'user-1,active,true,org-1,student,u1,Jane,Doe',
        'user-1,active,true,org-1,student,u2,John,Doe',
      ].join('\n'),
    };
    const result = new OneRosterCsvProfile().validate(archive, 'full');

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        file: 'users.csv',
        code: 'missing-header',
        field: 'dateLastModified',
      }),
    );
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        file: 'users.csv',
        code: 'duplicate-sourced-id',
        sourcedId: 'user-1',
      }),
    );
  });

  test('reports broken course, class, school and user references', () => {
    const archive = {
      ...validArchive,
      'classes.csv':
        validArchive['classes.csv']?.replace(
          'course-math,org-1',
          'missing-course,missing-school',
        ) ?? '',
      'enrollments.csv':
        validArchive['enrollments.csv']?.replace(
          'class-math-1,org-1,user-student-1',
          'missing-class,missing-school,missing-user',
        ) ?? '',
    };
    const result = new OneRosterCsvProfile().validate(archive, 'full');

    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['unknown-course', 'unknown-school', 'unknown-class', 'unknown-user']),
    );
  });

  test('requires status and modification time for delta files', () => {
    const result = new OneRosterCsvProfile().validate(
      {
        'users.csv':
          'sourcedId,enabledUser,orgSourcedIds,role,username,givenName,familyName\nuser-1,true,org-1,student,u1,Jane,Doe',
      },
      'delta',
    );

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'missing-header', field: 'status' }),
    );
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'missing-header', field: 'dateLastModified' }),
    );
  });

  test('maps supported records to idempotent domain commands', () => {
    const profile = new OneRosterCsvProfile();
    const commands = profile.toDomainCommands('tenant-1', validArchive, 'full');

    expect(commands).toHaveLength(6);
    expect(commands[0]).toMatchObject({
      tenantId: 'tenant-1',
      standard: 'OneRoster',
      standardVersion: '1.2',
    });
    expect(commands.find((command) => command.objectType === 'user')).toMatchObject({
      operation: 'upsert',
      externalId: 'user-student-1',
      idempotencyKey: 'oneroster:1.2:user:user-student-1:2026-07-28T00:00:00Z',
    });
  });

  test('exports the supported profile in deterministic file order', () => {
    const profile = new OneRosterCsvProfile();
    const exported = profile.export({
      orgs: [
        {
          sourcedId: 'org-1',
          status: 'active',
          dateLastModified: '2026-07-28T00:00:00Z',
          name: 'Example School',
          type: 'school',
          identifier: 'EXAMPLE',
          parentSourcedId: '',
        },
      ],
    });

    expect(Object.keys(exported)).toEqual(['orgs.csv']);
    expect(exported['orgs.csv']).toContain(
      'sourcedId,status,dateLastModified,name,type,identifier,parentSourcedId',
    );
  });
});

describe('OneRoster REST extension contract', () => {
  test('defines versioned cursor routes without treating internal models as OneRoster storage', () => {
    const contract = new OneRosterRestContract();

    expect(contract.basePath).toBe('/api/v1/standards/oneroster/1.2');
    expect(contract.collectionPath('users')).toBe('/api/v1/standards/oneroster/1.2/users');
    expect(contract.buildPageLink('users', { limit: 100, cursor: 'cursor-2' })).toBe(
      '/api/v1/standards/oneroster/1.2/users?limit=100&cursor=cursor-2',
    );
    expect(() => contract.buildPageLink('users', { limit: 501 })).toThrow(
      'OneRoster page limit must be between 1 and 500',
    );
  });
});
