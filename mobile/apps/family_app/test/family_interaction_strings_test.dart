import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:school_family_app/family_interaction_strings.dart';
import 'package:school_family_domain/family_interactions.dart';

void main() {
  test(
    'provides reviewed Family interaction copy for English Bangla and Arabic',
    () {
      final english = FamilyInteractionStrings.forLocale(
        const Locale('en', 'GB'),
      );
      final bangla = FamilyInteractionStrings.forLocale(
        const Locale('bn', 'BD'),
      );
      final arabic = FamilyInteractionStrings.forLocale(
        const Locale('ar', 'SA'),
      );

      expect(english.verifyAndOpenSecurely, 'Verify and open securely');
      expect(english.guardianConsent, 'Guardian consent');
      expect(bangla.verifyAndOpenSecurely, 'যাচাই করে নিরাপদে খুলুন');
      expect(bangla.guardianConsent, 'অভিভাবকের সম্মতি');
      expect(arabic.verifyAndOpenSecurely, 'تحقق وافتح بأمان');
      expect(arabic.guardianConsent, 'موافقة ولي الأمر');
    },
  );

  test(
    'localizes server-owned interaction statuses without changing values',
    () {
      expect(
        FamilyInteractionStrings.documentClassificationFor(
          const Locale('bn', 'BD'),
          FamilyDocumentClassification.restricted,
        ),
        'সীমিত',
      );
      expect(
        FamilyInteractionStrings.cachePolicyFor(
          const Locale('ar', 'SA'),
          FamilyDocumentCachePolicy.noStore,
        ),
        'بدون تخزين',
      );
      expect(
        FamilyInteractionStrings.formStatusFor(
          const Locale('en', 'GB'),
          FamilyFormStatus.submitted,
        ),
        'Submitted',
      );
      expect(
        FamilyInteractionStrings.consentStatusFor(
          const Locale('bn', 'BD'),
          FamilyConsentStatus.granted,
        ),
        'অনুমোদিত',
      );
    },
  );

  test(
    'keeps authoritative revisions and policy versions in localized sentences',
    () {
      expect(
        FamilyInteractionStrings.formDefinitionFor(
          const Locale('ar', 'SA'),
          baseVersion: 4,
          schemaVersion: 7,
          isolatedStudentName: 'Amina',
        ),
        contains('4'),
      );
      expect(
        FamilyInteractionStrings.formDefinitionFor(
          const Locale('ar', 'SA'),
          baseVersion: 4,
          schemaVersion: 7,
          isolatedStudentName: 'Amina',
        ),
        contains('7'),
      );
      expect(
        FamilyInteractionStrings.policyStatusFor(
          const Locale('en', 'GB'),
          isolatedPolicyVersion: 'P-3',
          status: FamilyConsentStatus.pending,
          dueLabel: '8 Aug 2026',
        ),
        'Policy P-3 · Pending · due 8 Aug 2026',
      );
    },
  );

  test('falls back to English for unsupported locales', () {
    final strings = FamilyInteractionStrings.forLocale(
      const Locale('fr', 'FR'),
    );

    expect(strings.documentsUnavailable, 'Documents unavailable');
    expect(strings.sendMessage, 'Send message');
    expect(strings.tryAgain, 'Try again');
  });
}
