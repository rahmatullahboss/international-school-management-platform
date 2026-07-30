/// Platform-neutral privacy decisions for Android/iOS application lifecycle.
///
/// Native integration layers translate platform signals into this contract.
/// The policy carries reason codes only; tokens, temporary paths, digests,
/// ciphertext, document names and personal data are deliberately excluded.
library;

enum MobilePlatformLifecycleSignal {
  resumed,
  inactive,
  hidden,
  paused,
  detached,
  memoryPressure,
}

enum MobilePrivacyLifecycleState { active, obscured, detached }

final class MobilePrivacyLifecycleDecision {
  const MobilePrivacyLifecycleDecision({
    required this.cancelRestrictedPresentation,
    required this.obscureRestrictedContent,
    required this.purgeTransientBytes,
    required this.reasonCode,
    required this.requireFreshAuthorization,
    required this.state,
  });

  final MobilePrivacyLifecycleState state;
  final bool obscureRestrictedContent;
  final bool cancelRestrictedPresentation;
  final bool purgeTransientBytes;
  final bool requireFreshAuthorization;
  final String reasonCode;
}

/// Stateful lifecycle policy shared by Family and Staff native hosts.
///
/// Once the process detaches, authorization remains invalid until a resumed
/// signal is evaluated with a fresh, unexpired authorization proof. Background
/// and memory-pressure signals never authorize work; they only reduce exposure.
final class MobilePrivacyLifecyclePolicy {
  MobilePrivacyLifecycleState _state = MobilePrivacyLifecycleState.active;
  bool _freshAuthorizationRequired = false;

  MobilePrivacyLifecycleState get state => _state;

  MobilePrivacyLifecycleDecision handle(
    MobilePlatformLifecycleSignal signal, {
    required DateTime now,
    DateTime? authorizationExpiresAt,
    bool restrictedContentVisible = false,
    bool transientBytesLeased = false,
  }) {
    switch (signal) {
      case MobilePlatformLifecycleSignal.resumed:
        final authorizationWasRequired = _freshAuthorizationRequired;
        final authorizationIsFresh =
            authorizationExpiresAt != null &&
            authorizationExpiresAt.isAfter(now);
        final requireFreshAuthorization = !authorizationIsFresh;
        _state = MobilePrivacyLifecycleState.active;
        if (authorizationIsFresh) {
          _freshAuthorizationRequired = false;
        }
        return MobilePrivacyLifecycleDecision(
          cancelRestrictedPresentation: requireFreshAuthorization,
          obscureRestrictedContent: requireFreshAuthorization,
          purgeTransientBytes:
              transientBytesLeased && requireFreshAuthorization,
          reasonCode: switch ((
            requireFreshAuthorization,
            authorizationWasRequired,
          )) {
            (true, true) =>
              'MOBILE_LIFECYCLE_FRESH_AUTHORIZATION_REQUIRED_AFTER_DETACH',
            (true, false) => 'MOBILE_LIFECYCLE_FRESH_AUTHORIZATION_REQUIRED',
            (false, _) => 'MOBILE_LIFECYCLE_RESUMED',
          },
          requireFreshAuthorization: requireFreshAuthorization,
          state: _state,
        );
      case MobilePlatformLifecycleSignal.inactive:
      case MobilePlatformLifecycleSignal.hidden:
      case MobilePlatformLifecycleSignal.paused:
        _state = MobilePrivacyLifecycleState.obscured;
        return MobilePrivacyLifecycleDecision(
          cancelRestrictedPresentation: restrictedContentVisible,
          obscureRestrictedContent: restrictedContentVisible,
          purgeTransientBytes: transientBytesLeased,
          reasonCode: 'MOBILE_LIFECYCLE_BACKGROUND_PRIVACY',
          requireFreshAuthorization: false,
          state: _state,
        );
      case MobilePlatformLifecycleSignal.detached:
        _state = MobilePrivacyLifecycleState.detached;
        _freshAuthorizationRequired = true;
        return MobilePrivacyLifecycleDecision(
          cancelRestrictedPresentation: restrictedContentVisible,
          obscureRestrictedContent: restrictedContentVisible,
          purgeTransientBytes: transientBytesLeased,
          reasonCode: 'MOBILE_LIFECYCLE_PROCESS_DETACHED',
          requireFreshAuthorization: true,
          state: _state,
        );
      case MobilePlatformLifecycleSignal.memoryPressure:
        return MobilePrivacyLifecycleDecision(
          cancelRestrictedPresentation: restrictedContentVisible,
          obscureRestrictedContent: restrictedContentVisible,
          purgeTransientBytes: transientBytesLeased,
          reasonCode: 'MOBILE_LIFECYCLE_MEMORY_PRESSURE',
          requireFreshAuthorization: false,
          state: _state,
        );
    }
  }
}
