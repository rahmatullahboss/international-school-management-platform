import 'package:school_mobile_core/privacy_lifecycle.dart';
import 'package:test/test.dart';

void main() {
  final now = DateTime.utc(2026, 7, 30, 13);

  test('background obscures restricted content and purges transient bytes', () {
    final policy = MobilePrivacyLifecyclePolicy();

    final decision = policy.handle(
      MobilePlatformLifecycleSignal.paused,
      now: now,
      restrictedContentVisible: true,
      transientBytesLeased: true,
    );

    expect(decision.state, MobilePrivacyLifecycleState.obscured);
    expect(decision.obscureRestrictedContent, isTrue);
    expect(decision.cancelRestrictedPresentation, isTrue);
    expect(decision.purgeTransientBytes, isTrue);
    expect(decision.requireFreshAuthorization, isFalse);
    expect(decision.reasonCode, 'MOBILE_LIFECYCLE_BACKGROUND_PRIVACY');
  });

  test('process detachment requires fresh authorization after resume', () {
    final policy = MobilePrivacyLifecyclePolicy();

    final detached = policy.handle(
      MobilePlatformLifecycleSignal.detached,
      now: now,
      restrictedContentVisible: true,
      transientBytesLeased: true,
    );
    final resumedWithoutProof = policy.handle(
      MobilePlatformLifecycleSignal.resumed,
      now: now.add(const Duration(minutes: 1)),
    );

    expect(detached.state, MobilePrivacyLifecycleState.detached);
    expect(detached.requireFreshAuthorization, isTrue);
    expect(detached.purgeTransientBytes, isTrue);
    expect(
      resumedWithoutProof.reasonCode,
      'MOBILE_LIFECYCLE_FRESH_AUTHORIZATION_REQUIRED',
    );
    expect(resumedWithoutProof.obscureRestrictedContent, isTrue);
    expect(resumedWithoutProof.requireFreshAuthorization, isTrue);
  });

  test('fresh authorization clears detached fail-closed state', () {
    final policy = MobilePrivacyLifecyclePolicy();
    policy.handle(MobilePlatformLifecycleSignal.detached, now: now);

    final resumed = policy.handle(
      MobilePlatformLifecycleSignal.resumed,
      now: now.add(const Duration(minutes: 1)),
      authorizationExpiresAt: now.add(const Duration(minutes: 4)),
    );
    final nextResume = policy.handle(
      MobilePlatformLifecycleSignal.resumed,
      now: now.add(const Duration(minutes: 2)),
      authorizationExpiresAt: now.add(const Duration(minutes: 4)),
    );

    expect(resumed.state, MobilePrivacyLifecycleState.active);
    expect(resumed.requireFreshAuthorization, isTrue);
    expect(nextResume.requireFreshAuthorization, isFalse);
    expect(nextResume.reasonCode, 'MOBILE_LIFECYCLE_RESUMED');
  });

  test('expired authorization fails closed on ordinary resume', () {
    final policy = MobilePrivacyLifecyclePolicy();

    final decision = policy.handle(
      MobilePlatformLifecycleSignal.resumed,
      now: now,
      authorizationExpiresAt: now.subtract(const Duration(seconds: 1)),
      restrictedContentVisible: true,
      transientBytesLeased: true,
    );

    expect(decision.requireFreshAuthorization, isTrue);
    expect(decision.cancelRestrictedPresentation, isTrue);
    expect(decision.obscureRestrictedContent, isTrue);
    expect(decision.purgeTransientBytes, isTrue);
  });

  test('memory pressure reduces exposure without inventing authorization', () {
    final policy = MobilePrivacyLifecyclePolicy();

    final decision = policy.handle(
      MobilePlatformLifecycleSignal.memoryPressure,
      now: now,
      restrictedContentVisible: true,
      transientBytesLeased: true,
    );

    expect(decision.state, MobilePrivacyLifecycleState.active);
    expect(decision.cancelRestrictedPresentation, isTrue);
    expect(decision.obscureRestrictedContent, isTrue);
    expect(decision.purgeTransientBytes, isTrue);
    expect(decision.requireFreshAuthorization, isFalse);
    expect(decision.reasonCode, 'MOBILE_LIFECYCLE_MEMORY_PRESSURE');
  });

  test('decisions expose reason codes but no sensitive diagnostics', () {
    final policy = MobilePrivacyLifecyclePolicy();
    final decision = policy.handle(
      MobilePlatformLifecycleSignal.hidden,
      now: now,
      restrictedContentVisible: true,
      transientBytesLeased: true,
    );

    final diagnostic = decision.reasonCode.toLowerCase();
    expect(diagnostic, isNot(contains('token')));
    expect(diagnostic, isNot(contains('digest')));
    expect(diagnostic, isNot(contains('/tmp/')));
    expect(diagnostic, isNot(contains('student')));
  });
}
