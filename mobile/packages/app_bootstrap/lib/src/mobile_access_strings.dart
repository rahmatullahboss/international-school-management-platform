import 'package:flutter/widgets.dart';
import 'package:school_mobile_core/mobile_core.dart';

final class MobileAccessStrings {
  const MobileAccessStrings._({
    required this.accessCouldNotBeLoaded,
    required this.accessServiceUnavailable,
    required this.accountVerificationDescription,
    required this.applicationConfigurationRequired,
    required this.authRequired,
    required this.authorizedAccessOnly,
    required this.buildNotConfigured,
    required this.checkingSecureAccountAccess,
    required this.chooseGrantedAccess,
    required this.chooseSchoolAccess,
    required this.clearSessionAndSignOut,
    required this.identityServiceDescription,
    required this.loadingSchoolAccess,
    required this.noAppAccess,
    required this.openingSecureSignIn,
    required this.openingWorkspace,
    required this.restoringSecureSession,
    required this.sessionExpired,
    required this.signInSecurely,
    required this.signInToContinue,
    required this.signOut,
    required this.signedOut,
    required this.signingOut,
    required this.tryAgain,
    required this.unableToContinue,
    required this.userCancelled,
    required this.configurationFailurePrefix,
    required this.configurationFailureSupportCode,
  });

  factory MobileAccessStrings.forLocale(Locale locale) =>
      switch (locale.languageCode.toLowerCase()) {
        'bn' => const MobileAccessStrings._(
          accessCouldNotBeLoaded: 'অ্যাক্সেস লোড করা যায়নি',
          accessServiceUnavailable:
              'স্কুল অ্যাক্সেস সেবা এখন পাওয়া যাচ্ছে না। আবার চেষ্টা করুন অথবা স্কুল সহায়তার সঙ্গে যোগাযোগ করুন।',
          accountVerificationDescription:
              'স্কুল, ক্যাম্পাস ও ভূমিকার অ্যাক্সেস চালু করার আগে আপনার অ্যাকাউন্ট যাচাই করা হয়।',
          applicationConfigurationRequired: 'অ্যাপ কনফিগারেশন প্রয়োজন',
          authRequired: 'আপনার অ্যাকাউন্ট অ্যাক্সেস রিফ্রেশ করতে আবার সাইন ইন করুন।',
          authorizedAccessOnly: 'শুধু অনুমোদিত অ্যাক্সেস',
          buildNotConfigured:
              'এই অ্যাপ বিল্ডটি স্কুলের পরিচয় সেবার জন্য কনফিগার করা নেই।',
          checkingSecureAccountAccess:
              'নিরাপদ অ্যাকাউন্ট অ্যাক্সেস যাচাই করা হচ্ছে…',
          chooseGrantedAccess:
              'এই অ্যাকাউন্টে অনুমোদিত একটি স্কুল, ক্যাম্পাস ও ভূমিকা বেছে নিন।',
          chooseSchoolAccess: 'আপনার স্কুল অ্যাক্সেস বেছে নিন',
          clearSessionAndSignOut: 'সেশন মুছে সাইন আউট করুন',
          identityServiceDescription:
              'প্রমাণীকরণ স্কুলের পরিচয় সেবা ব্যবহার করে। এই অ্যাপ কখনো আপনার পাসওয়ার্ড পরিচালনা করে না।',
          loadingSchoolAccess: 'স্কুল অ্যাক্সেস লোড করা হচ্ছে',
          noAppAccess:
              'এই অ্যাকাউন্টে বর্তমানে এই মোবাইল অ্যাপ ব্যবহারের অনুমতি নেই।',
          openingSecureSignIn: 'নিরাপদ সাইন-ইন খোলা হচ্ছে',
          openingWorkspace: 'ওয়ার্কস্পেস খোলা হচ্ছে',
          restoringSecureSession: 'নিরাপদ সেশন পুনরুদ্ধার করা হচ্ছে',
          sessionExpired:
              'আপনার নিরাপদ সেশনের মেয়াদ শেষ হয়েছে। চালিয়ে যেতে আবার সাইন ইন করুন।',
          signInSecurely: 'নিরাপদভাবে সাইন ইন করুন',
          signInToContinue: 'চালিয়ে যেতে সাইন ইন করুন',
          signOut: 'সাইন আউট',
          signedOut: 'সাইন আউট করা হয়েছে',
          signingOut: 'সাইন আউট করা হচ্ছে',
          tryAgain: 'আবার চেষ্টা করুন',
          unableToContinue: 'চালিয়ে যাওয়া যাচ্ছে না',
          userCancelled:
              'সাইন-ইন বাতিল করা হয়েছে। অ্যাকাউন্টে কোনো পরিবর্তন করা হয়নি।',
          configurationFailurePrefix:
              'এই বিল্ড নিরাপদভাবে সংযোগ করতে পারছে না।',
          configurationFailureSupportCode: 'সহায়তা কোড',
        ),
        'ar' => const MobileAccessStrings._(
          accessCouldNotBeLoaded: 'تعذر تحميل صلاحيات الوصول',
          accessServiceUnavailable:
              'خدمة الوصول إلى المدرسة غير متاحة الآن. حاول مرة أخرى أو تواصل مع دعم المدرسة.',
          accountVerificationDescription:
              'يتم التحقق من حسابك قبل تفعيل الوصول إلى المدرسة والحرم والدور.',
          applicationConfigurationRequired: 'يلزم إعداد التطبيق',
          authRequired: 'سجّل الدخول مرة أخرى لتحديث صلاحيات حسابك.',
          authorizedAccessOnly: 'الوصول المصرح به فقط',
          buildNotConfigured:
              'هذا الإصدار من التطبيق غير مهيأ لخدمة هوية المدرسة.',
          checkingSecureAccountAccess:
              'جارٍ التحقق من الوصول الآمن للحساب…',
          chooseGrantedAccess:
              'اختر مدرسة وحرمًا ودورًا واحدًا ممنوحًا لهذا الحساب.',
          chooseSchoolAccess: 'اختر صلاحية الوصول إلى مدرستك',
          clearSessionAndSignOut: 'مسح الجلسة وتسجيل الخروج',
          identityServiceDescription:
              'تستخدم المصادقة خدمة هوية المدرسة. لا يتعامل هذا التطبيق مع كلمة مرورك مطلقًا.',
          loadingSchoolAccess: 'جارٍ تحميل صلاحيات المدرسة',
          noAppAccess:
              'لا يملك هذا الحساب حاليًا صلاحية الوصول إلى تطبيق الجوال هذا.',
          openingSecureSignIn: 'جارٍ فتح تسجيل الدخول الآمن',
          openingWorkspace: 'جارٍ فتح مساحة العمل',
          restoringSecureSession: 'جارٍ استعادة الجلسة الآمنة',
          sessionExpired:
              'انتهت صلاحية جلستك الآمنة. سجّل الدخول مرة أخرى للمتابعة.',
          signInSecurely: 'تسجيل الدخول بأمان',
          signInToContinue: 'سجّل الدخول للمتابعة',
          signOut: 'تسجيل الخروج',
          signedOut: 'تم تسجيل الخروج',
          signingOut: 'جارٍ تسجيل الخروج',
          tryAgain: 'حاول مرة أخرى',
          unableToContinue: 'تعذر المتابعة',
          userCancelled:
              'تم إلغاء تسجيل الدخول. لم يتم إجراء أي تغييرات على الحساب.',
          configurationFailurePrefix:
              'يتعذر على هذا الإصدار الاتصال بأمان.',
          configurationFailureSupportCode: 'رمز الدعم',
        ),
        _ => const MobileAccessStrings._(
          accessCouldNotBeLoaded: 'Access could not be loaded',
          accessServiceUnavailable:
              'The school access service is unavailable. Try again or contact school support.',
          accountVerificationDescription:
              'Your account is verified before school, campus and role access is activated.',
          applicationConfigurationRequired: 'Application configuration required',
          authRequired: 'Sign in again to refresh your account access.',
          authorizedAccessOnly: 'Authorized access only',
          buildNotConfigured:
              'This application build is not configured for the school identity service.',
          checkingSecureAccountAccess: 'Checking secure account access…',
          chooseGrantedAccess:
              'Choose one school, campus and role granted to this account.',
          chooseSchoolAccess: 'Choose your school access',
          clearSessionAndSignOut: 'Clear session and sign out',
          identityServiceDescription:
              'Authentication uses the school identity service. Your password is never handled by this app.',
          loadingSchoolAccess: 'Loading school access',
          noAppAccess:
              'This account does not currently have access to this mobile application.',
          openingSecureSignIn: 'Opening secure sign-in',
          openingWorkspace: 'Opening workspace',
          restoringSecureSession: 'Restoring secure session',
          sessionExpired:
              'Your secure session expired. Sign in again to continue.',
          signInSecurely: 'Sign in securely',
          signInToContinue: 'Sign in to continue',
          signOut: 'Sign out',
          signedOut: 'Signed out',
          signingOut: 'Signing out',
          tryAgain: 'Try again',
          unableToContinue: 'Unable to continue',
          userCancelled:
              'Sign-in was cancelled. No account changes were made.',
          configurationFailurePrefix: 'This build cannot connect securely.',
          configurationFailureSupportCode: 'Support code',
        ),
      };

  String personaLabel(SchoolPersona persona) => switch (persona) {
    SchoolPersona.guardian => switch (_language) {
      'bn' => 'অভিভাবক',
      'ar' => 'ولي الأمر',
      _ => 'Guardian',
    },
    SchoolPersona.student => switch (_language) {
      'bn' => 'শিক্ষার্থী',
      'ar' => 'الطالب',
      _ => 'Student',
    },
    SchoolPersona.teacher => switch (_language) {
      'bn' => 'শিক্ষক',
      'ar' => 'المعلم',
      _ => 'Teacher',
    },
  };

  String safeReason(String code) => switch (code) {
    'OIDC_USER_CANCELLED' => userCancelled,
    'OIDC_SESSION_EXPIRED' => sessionExpired,
    'BOOTSTRAP_NO_APP_ACCESS' => noAppAccess,
    'MOBILE_API_BASE_CONFIGURATION_REQUIRED' ||
    'OIDC_COMPILE_TIME_CONFIGURATION_REQUIRED' ||
    'MOBILE_REDIRECT_SCHEME_MISMATCH' ||
    'MOBILE_LOGOUT_REDIRECT_SCHEME_MISMATCH' => buildNotConfigured,
    'AUTHENTICATION_REQUIRED' => authRequired,
    _ => accessServiceUnavailable,
  };

  String configurationFailure(String isolatedReasonCode) =>
      '$configurationFailurePrefix $configurationFailureSupportCode: $isolatedReasonCode';

  String get _language {
    if (identical(this, _banglaSentinel)) return 'bn';
    if (identical(this, _arabicSentinel)) return 'ar';
    return 'en';
  }

  // Sentinels are initialized through the same factory values below and only
  // support persona-label selection without storing authority-bearing state.
  static final MobileAccessStrings _banglaSentinel =
      MobileAccessStrings.forLocale(const Locale('bn'));
  static final MobileAccessStrings _arabicSentinel =
      MobileAccessStrings.forLocale(const Locale('ar'));

  final String accessCouldNotBeLoaded;
  final String accessServiceUnavailable;
  final String accountVerificationDescription;
  final String applicationConfigurationRequired;
  final String authRequired;
  final String authorizedAccessOnly;
  final String buildNotConfigured;
  final String checkingSecureAccountAccess;
  final String chooseGrantedAccess;
  final String chooseSchoolAccess;
  final String clearSessionAndSignOut;
  final String configurationFailurePrefix;
  final String configurationFailureSupportCode;
  final String identityServiceDescription;
  final String loadingSchoolAccess;
  final String noAppAccess;
  final String openingSecureSignIn;
  final String openingWorkspace;
  final String restoringSecureSession;
  final String sessionExpired;
  final String signInSecurely;
  final String signInToContinue;
  final String signOut;
  final String signedOut;
  final String signingOut;
  final String tryAgain;
  final String unableToContinue;
  final String userCancelled;
}
