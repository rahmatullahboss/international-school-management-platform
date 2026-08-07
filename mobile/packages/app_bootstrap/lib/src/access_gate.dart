import 'dart:async';

import 'package:flutter/material.dart';
import 'package:school_app_bootstrap/src/coordinator.dart';
import 'package:school_app_bootstrap/src/mobile_access_strings.dart';
import 'package:school_design_system/school_design_system.dart';

enum MobileAccessApplication { family, staff }

class MobileAccessGate extends StatelessWidget {
  const MobileAccessGate({
    required this.application,
    required this.onRetry,
    required this.onSelectAccess,
    required this.onSignIn,
    required this.onSignOut,
    required this.state,
    super.key,
  });

  final MobileAccessApplication application;
  final MobileApplicationState state;
  final Future<void> Function() onSignIn;
  final Future<void> Function() onRetry;
  final Future<void> Function() onSignOut;
  final ValueChanged<MobileAccessOption> onSelectAccess;

  @override
  Widget build(BuildContext context) {
    final strings = MobileAccessStrings.forLocale(
      Localizations.localeOf(context),
    );
    return Scaffold(
      appBar: AppBar(title: Text(_applicationName(context))),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(SchoolSpacing.md),
          children: [
            SchoolPageSection(
              description: strings.accountVerificationDescription,
              title: _title(strings),
              child: _content(context, strings),
            ),
          ],
        ),
      ),
    );
  }

  String _applicationName(BuildContext context) {
    final shell = SchoolShellStrings.of(context);
    return switch (application) {
      MobileAccessApplication.family => shell.familyAppName,
      MobileAccessApplication.staff => shell.staffAppName,
    };
  }

  String _title(MobileAccessStrings strings) => switch (state.phase) {
    MobileApplicationPhase.restoring => strings.restoringSecureSession,
    MobileApplicationPhase.signedOut => strings.signInToContinue,
    MobileApplicationPhase.authenticating => strings.openingSecureSignIn,
    MobileApplicationPhase.loadingAccess => strings.loadingSchoolAccess,
    MobileApplicationPhase.choosingAccess => strings.chooseSchoolAccess,
    MobileApplicationPhase.ready => strings.openingWorkspace,
    MobileApplicationPhase.signingOut => strings.signingOut,
    MobileApplicationPhase.failed => strings.accessCouldNotBeLoaded,
  };

  Widget _content(
    BuildContext context,
    MobileAccessStrings strings,
  ) => switch (state.phase) {
    MobileApplicationPhase.restoring ||
    MobileApplicationPhase.authenticating ||
    MobileApplicationPhase.loadingAccess ||
    MobileApplicationPhase.ready ||
    MobileApplicationPhase.signingOut => SchoolPanel(
      child: _ProgressBody(strings: strings),
    ),
    MobileApplicationPhase.signedOut => SchoolPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SchoolStatusBanner(
            label: strings.signedOut,
            message: strings.identityServiceDescription,
            tone: SchoolStatusTone.information,
          ),
          if (state.reasonCode != null) ...[
            const SizedBox(height: SchoolSpacing.md),
            Text(
              strings.safeReason(state.reasonCode!),
              key: const Key('mobile-auth-reason'),
            ),
          ],
          const SizedBox(height: SchoolSpacing.md),
          FilledButton.icon(
            key: const Key('mobile-sign-in'),
            icon: const Icon(Icons.login),
            label: Text(strings.signInSecurely),
            onPressed: () => unawaited(onSignIn()),
          ),
        ],
      ),
    ),
    MobileApplicationPhase.choosingAccess => SchoolPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SchoolStatusBanner(
            label: strings.authorizedAccessOnly,
            message: strings.chooseGrantedAccess,
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
              subtitle: Text(
                '${SchoolBidirectionalText.isolate(option.campusName)} · '
                '${strings.personaLabel(option.persona)}',
              ),
              title: Text(SchoolBidirectionalText.isolate(option.tenantName)),
              trailing: const Icon(Icons.chevron_right),
            ),
          const Divider(),
          TextButton.icon(
            icon: const Icon(Icons.logout),
            label: Text(strings.signOut),
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
            label: strings.unableToContinue,
            message: strings.safeReason(
              state.reasonCode ?? 'MOBILE_BOOTSTRAP_UNAVAILABLE',
            ),
            tone: SchoolStatusTone.error,
          ),
          const SizedBox(height: SchoolSpacing.md),
          FilledButton.icon(
            key: const Key('mobile-retry'),
            icon: const Icon(Icons.refresh),
            label: Text(strings.tryAgain),
            onPressed: () => unawaited(onRetry()),
          ),
          const SizedBox(height: SchoolSpacing.xs),
          TextButton.icon(
            icon: const Icon(Icons.logout),
            label: Text(strings.clearSessionAndSignOut),
            onPressed: () => unawaited(onSignOut()),
          ),
        ],
      ),
    ),
  };
}

class MobileConfigurationFailureScreen extends StatelessWidget {
  const MobileConfigurationFailureScreen({
    required this.application,
    required this.reasonCode,
    super.key,
  });

  final MobileAccessApplication application;
  final String reasonCode;

  @override
  Widget build(BuildContext context) {
    final strings = MobileAccessStrings.forLocale(
      Localizations.localeOf(context),
    );
    final shell = SchoolShellStrings.of(context);
    final appName = switch (application) {
      MobileAccessApplication.family => shell.familyAppName,
      MobileAccessApplication.staff => shell.staffAppName,
    };
    return Scaffold(
      appBar: AppBar(title: Text(appName)),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(SchoolSpacing.md),
          child: SchoolStatusBanner(
            label: strings.applicationConfigurationRequired,
            message: strings.configurationFailure(
              SchoolBidirectionalText.isolate(reasonCode),
            ),
            tone: SchoolStatusTone.error,
          ),
        ),
      ),
    );
  }
}

class _ProgressBody extends StatelessWidget {
  const _ProgressBody({required this.strings});

  final MobileAccessStrings strings;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: SchoolSpacing.lg),
    child: Column(
      children: [
        const CircularProgressIndicator(),
        const SizedBox(height: SchoolSpacing.md),
        Text(strings.checkingSecureAccountAccess),
      ],
    ),
  );
}
