import 'package:school_family_domain/school_family_domain.dart';
import 'package:school_mobile_core/mobile_core.dart';
import 'package:test/test.dart';

SchoolAuthoritativeTimestamp _schoolTime(String timestamp) =>
    SchoolAuthoritativeTimestamp.parse(
      timestamp: timestamp,
      timeZoneId: 'Asia/Dhaka',
    );

void main() {
  final first = FamilyStudentProfile(
    campusId: 'campus-1',
    displayName: 'Student One',
    gradeLabel: 'Grade 7',
    relationshipLabel: 'Child',
    studentId: 'student-1',
  );
  final second = FamilyStudentProfile(
    campusId: 'campus-1',
    displayName: 'Student Two',
    gradeLabel: 'Grade 4',
    relationshipLabel: 'Child',
    studentId: 'student-2',
  );

  group('FamilyProfileDirectory', () {
    test('switches among only authorized student profiles', () {
      final directory = FamilyProfileDirectory(
        accountId: 'account-1',
        activeStudentId: first.studentId,
        students: [first, second],
      );

      final selected = directory.select(second.studentId);

      expect(selected.activeStudent, same(second));
      expect(directory.activeStudent, same(first));
      expect(
        () => directory.select('student-unavailable'),
        throwsA(
          isA<FamilyDomainException>().having(
            (error) => error.code,
            'code',
            'FAMILY_PROFILE_UNAVAILABLE',
          ),
        ),
      );
    });

    test('rejects duplicate or inactive profile declarations', () {
      expect(
        () => FamilyProfileDirectory(
          accountId: 'account-1',
          activeStudentId: first.studentId,
          students: [first, first],
        ),
        throwsA(
          isA<FamilyDomainException>().having(
            (error) => error.code,
            'code',
            'FAMILY_PROFILE_DUPLICATE',
          ),
        ),
      );
      expect(
        () => FamilyProfileDirectory(
          accountId: 'account-1',
          activeStudentId: 'student-unavailable',
          students: [first],
        ),
        throwsA(
          isA<FamilyDomainException>().having(
            (error) => error.code,
            'code',
            'FAMILY_ACTIVE_PROFILE_UNAVAILABLE',
          ),
        ),
      );
    });
  });

  test(
    'attendance keeps the authoritative summary instead of recalculating',
    () {
      final attendance = FamilyAttendanceReadModel(
        absentSessions: 1,
        lateSessions: 1,
        presentSessions: 48,
        summaryLabel: 'Published attendance · 96%',
        totalSessions: 50,
      );

      expect(attendance.summaryLabel, 'Published attendance · 96%');
      expect(attendance.totalSessions, 50);
      expect(
        () => FamilyAttendanceReadModel(
          absentSessions: 3,
          lateSessions: 3,
          presentSessions: 5,
          summaryLabel: 'Invalid source',
          totalSessions: 10,
        ),
        throwsA(
          isA<FamilyDomainException>().having(
            (error) => error.code,
            'code',
            'FAMILY_ATTENDANCE_COUNTS_INVALID',
          ),
        ),
      );
    },
  );

  test(
    'money remains exact integer minor units with authoritative metadata',
    () {
      final fees = FamilyFeeReadModel(
        invoiceReference: 'INV-2026-0719',
        outstanding: FamilyMoneyAmount(
          currencyCode: 'bdt',
          fractionDigits: 2,
          minorUnits: 450000,
        ),
        lastReceipt: FamilyMoneyAmount(
          currencyCode: 'BDT',
          fractionDigits: 2,
          minorUnits: 450000,
        ),
        lastReceiptReference: 'RCPT-1042',
      );

      expect(fees.outstanding.currencyCode, 'BDT');
      expect(fees.outstanding.fractionDigits, 2);
      expect(fees.outstanding.minorUnits, 450000);
      expect(
        () => FamilyFeeReadModel(
          invoiceReference: 'INV-2026-0719',
          outstanding: FamilyMoneyAmount(
            currencyCode: 'BDT',
            fractionDigits: 2,
            minorUnits: 450000,
          ),
          lastReceipt: FamilyMoneyAmount(
            currencyCode: 'USD',
            fractionDigits: 2,
            minorUnits: 1000,
          ),
          lastReceiptReference: 'RCPT-1042',
        ),
        throwsA(
          isA<FamilyDomainException>().having(
            (error) => error.code,
            'code',
            'FAMILY_RECEIPT_CURRENCY_MISMATCH',
          ),
        ),
      );
      expect(
        () => FamilyFeeReadModel(
          invoiceReference: 'INV-2026-0719',
          outstanding: FamilyMoneyAmount(
            currencyCode: 'KWD',
            fractionDigits: 3,
            minorUnits: 450000,
          ),
          lastReceipt: FamilyMoneyAmount(
            currencyCode: 'KWD',
            fractionDigits: 2,
            minorUnits: 1000,
          ),
          lastReceiptReference: 'RCPT-1042',
        ),
        throwsA(
          isA<FamilyDomainException>().having(
            (error) => error.code,
            'code',
            'FAMILY_RECEIPT_FRACTION_DIGITS_MISMATCH',
          ),
        ),
      );
      expect(
        () => FamilyMoneyAmount(
          currencyCode: 'JPY',
          fractionDigits: 7,
          minorUnits: 1000,
        ),
        throwsA(
          isA<FamilyDomainException>().having(
            (error) => error.code,
            'code',
            'FAMILY_MONEY_FRACTION_DIGITS_INVALID',
          ),
        ),
      );
    },
  );

  test('dashboard snapshots keep server read models immutable', () {
    final timetable = <FamilyTimetableItem>[
      FamilyTimetableItem(
        endsAt: _schoolTime('2026-07-30T09:00:00.000+06:00'),
        itemId: 'class-1',
        locationLabel: 'Room 203',
        startsAt: _schoolTime('2026-07-30T08:00:00.000+06:00'),
        subjectLabel: 'Mathematics',
      ),
    ];
    final results = <FamilyPublishedResult>[
      FamilyPublishedResult(
        assessmentLabel: 'Term 1',
        gradeLabel: 'A',
        publishedAt: _schoolTime('2026-07-29T06:00:00.000+06:00'),
        resultId: 'result-1',
        subjectLabel: 'Science',
      ),
    ];
    final snapshot = FamilyDashboardReadModel(
      attendance: null,
      fees: null,
      generatedAt: _schoolTime('2026-07-30T06:00:00.000+06:00'),
      messages: FamilyMessageReadModel(unreadCount: 2),
      publishedResults: results,
      student: first,
      timetable: timetable,
    );

    timetable.clear();
    results.clear();

    expect(snapshot.timetable, hasLength(1));
    expect(snapshot.publishedResults, hasLength(1));
    expect(snapshot.messages?.unreadCount, 2);
    expect(
      () => snapshot.timetable.add(snapshot.timetable.single),
      throwsUnsupportedError,
    );
  });

  test('repository boundary requires an activated school session', () {
    final session = SchoolSession(
      accountId: 'account-1',
      activePersona: SchoolPersona.guardian,
      availablePersonas: const {SchoolPersona.guardian},
      campusId: 'campus-1',
      capabilities: const {SchoolCapability.attendanceRead},
      locale: 'en-BD',
      tenantId: 'tenant-1',
      timeZone: 'Asia/Dhaka',
    );

    expect(session.activePersona, SchoolPersona.guardian);
    expect(session.can(SchoolCapability.attendanceRead), isTrue);
  });
}
