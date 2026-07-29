import 'dart:async';
import 'package:flutter/material.dart';
import 'package:school_app_bootstrap/src/coordinator.dart';
import 'package:school_design_system/school_design_system.dart';

class MobileAccessGate extends StatelessWidget {
  const MobileAccessGate({
    required this.appName,
    required this.onRetry,
    required this.onSelectAccess,
    required this.onSignIn,
    required this.onSignOut,
    required this.state,
    super.key,
  });

  final String appName;
  final MobileApplicationState state;
  final Future<void> Function() onSignIn;
  final Future<void> Function() onRetry;
  final Future<void> Function() onSignOut;
  final ValueChanged<MobileAccessOption> onSelectAccess;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(appName)),
    body: SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(SchoolSpacing.md),
        children: [
          SchoolPageSection(
            description:
                'Your account is verified before school, campus and role access is activated.',
            title: _title,
            child: _content(context),
          ),
        ],
      ),
    ),
  );

  String get _title => switch (state.phase) {
    MobileApplicationPhase.restoring => 'Restoring secure session',
    MobileApplicationPhase.signedOut => 'Sign in to continue',
    MobileApplicationPhase.authenticating => 'Opening secure sign-in',
    MobileApplicationPhase.loadingAccess => 'Loading school access',
    MobileApplicationPhase.choosingAccess => 'Choose your school access',
    MobileApplicationPhase.ready => 'Opening workspace',
    MobileApplicationPhase.signingOut => 'Signing out',
    MobileApplicationPhase.failed => 'Access could not be loaded',
  };

  Widget _content(BuildContext context) => switch (state.phase) {
    MobileApplicationPhase.restoring ||
    MobileApplicationPhase.authenticating ||
    MobileApplicationPhase.loadingAccess ||
    MobileApplicationPhase.ready ||
    MobileApplicationPhase.signingOut => const SchoolPanel(
      child: _ProgressBody(),
    ),
    MobileApplicationPhase.signedOut => SchoolPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SchoolStatusBanner(
            label: 'Signed out',
            message:
                'Authentication uses the school identity service. Your password is never handled by this app.',
            tone: SchoolStatusTone.information,
          ),
          if (state.reasonCode != null) ...[
            const SizedBox(height: SchoolSpacing.md),
            Text(
              _safeReason(state.reasonCode!),
              key: const Key('mobile-auth-reason'),
            ),
          ],
          const SizedBox(height: SchoolSpacing.md),
          FilledButton.icon(
            key: const Key('mobile-sign-in'),
            icon: const Icon(Icons.login),
            label: const Text('Sign in securely'),
            onPressed: () => unawaited(onSignIn()),
          ),
        ],
      ),
    ),
    MobileApplicationPhase.choosingAccess => SchoolPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SchoolStatusBanner(
            label: 'Authorized access only',
            message:
                'Choose one school, campus and role granted to this account.',
            tone: SchoolStatusTone.information,
          ),
          const SizedBox(height: SchoolSpacing.sm),
          for (final option in state.accessOptions)
            ListTile(
              contentPadding: EdgeInsets.zero,
              key: ValueKey(
                'access-${option.tenantId}-${option.campusId}-${option.persona.name}',
              ),
              leading: const Icon(Icons.domain_outlined),
              onTap: () => onSelectAccess(option),
              subtitle: Text('${option.campusName} · ${option.persona.label}'),
              title: Text(option.tenantName),
              trailing: const Icon(Icons.chevron_right),
            ),
          const Divider(),
          TextButton.icon(
            icon: const Icon(Icons.logout),
            label: const Text('Sign out'),
            onPressed: () => unawaited(onSignOut()),
          ),
        ],
      ),
    ),
    MobileApplicationPhase.failed => SchoolPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SchoolStatusBanner(
            label: 'Unable to continue',
            message: _safeReason(
              state.reasonCode ?? 'MOBILE_BOOTSTRAP_UNAVAILABLE',
            ),
            tone: SchoolStatusTone.error,
          ),
          const SizedBox(height: SchoolSpacing.md),
          FilledButton.icon(
            key: const Key('mobile-retry'),
            icon: const Icon(Icons.refresh),
            label: const Text('Try again'),
            onPressed: () => unawaited(onRetry()),
          ),
          const SizedBox(height: SchoolSpacing.xs),
          TextButton.icon(
            icon: const Icon(Icons.logout),
            label: const Text('Clear session and sign out'),
            onPressed: () => unawaited(onSignOut()),
          ),
        ],
      ),
    ),
  };

  String _safeReason(String code) => switch (code) {
    'OIDC_USER_CANCELLED' =>
      'Sign-in was cancelled. No account changes were made.',
    'OIDC_SESSION_EXPIRED' =>
      'Your secure session expired. Sign in again to continue.',
    'BOOTSTRAP_NO_APP_ACCESS' =>
      'This account does not currently have access to this mobile application.',
    'MOBILE_API_BASE_CONFIGURATION_REQUIRED' ||
    'OIDC_COMPILE_TIME_CONFIGURATION_REQUIRED' ||
    'MOBILE_REDIRECT_SCHEME_MISMATCH' ||
    'MOBILE_LOGOUT_REDIRECT_SCHEME_MISMATCH' =>
      'This application build is not configured for the school identity service.',
    'AUTHENTICATION_REQUIRED' =>
      'Sign in again to refresh your account access.',
    _ =>
      'The school access service is unavailable. Try again or contact school support.',
  };
}

class MobileConfigurationFailureScreen extends StatelessWidget {
  const MobileConfigurationFailureScreen({
    required this.appName,
    required this.reasonCode,
    super.key,
  });

  final String appName;
  final String reasonCode;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(appName)),
    body: SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(SchoolSpacing.md),
        child: SchoolStatusBanner(
          label: 'Application configuration required',
          message:
              'This build cannot connect securely. Support code: $reasonCode',
          tone: SchoolStatusTone.error,
        ),
      ),
    ),
  );
}

class _ProgressBody extends StatelessWidget {
  const _ProgressBody();

  @override
  Widget build(BuildContext context) => const Padding(
    padding: EdgeInsets.symmetric(vertical: SchoolSpacing.lg),
    child: Column(
      children: [
        CircularProgressIndicator(),
        SizedBox(height: SchoolSpacing.md),
        Text('Checking secure account access…'),
      ],
    ),
  );
}
