library;

import 'package:flutter/material.dart';

abstract final class SchoolColors {
  static const institutionalInk = Color(0xFF12263A);
  static const operationalMuted = Color(0xFF4C6275);
  static const paper = Color(0xFFFFFFFF);
  static const canvas = Color(0xFFF3F6F8);
  static const structuralRule = Color(0xFFCBD6DE);
  static const actionTeal = Color(0xFF006D77);
  static const actionTealStrong = Color(0xFF004F57);
  static const focusBlue = Color(0xFF0B63CE);
  static const informationSurface = Color(0xFFE7F2F8);
  static const informationText = Color(0xFF16445F);
  static const successSurface = Color(0xFFE5F4EC);
  static const successText = Color(0xFF145C36);
  static const warningSurface = Color(0xFFFFF1CF);
  static const warningText = Color(0xFF714900);
  static const errorSurface = Color(0xFFFDE8E7);
  static const errorText = Color(0xFF8A1C17);
}

abstract final class SchoolSpacing {
  static const xs = 8.0;
  static const sm = 12.0;
  static const md = 16.0;
  static const lg = 24.0;
  static const xl = 32.0;
}

abstract final class SchoolTheme {
  static ThemeData light() {
    final colorScheme = ColorScheme.fromSeed(seedColor: SchoolColors.actionTeal)
        .copyWith(
          error: SchoolColors.errorText,
          onError: SchoolColors.paper,
          onPrimary: SchoolColors.paper,
          onSurface: SchoolColors.institutionalInk,
          primary: SchoolColors.actionTeal,
          surface: SchoolColors.paper,
        );

    return ThemeData(
      appBarTheme: const AppBarTheme(
        backgroundColor: SchoolColors.institutionalInk,
        centerTitle: false,
        elevation: 0,
        foregroundColor: SchoolColors.paper,
      ),
      colorScheme: colorScheme,
      dividerTheme: const DividerThemeData(
        color: SchoolColors.structuralRule,
        space: 1,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: SchoolColors.actionTeal,
          foregroundColor: SchoolColors.paper,
          minimumSize: const Size(48, 48),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        ),
      ),
      focusColor: SchoolColors.focusBlue,
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
        filled: true,
        fillColor: SchoolColors.paper,
      ),
      scaffoldBackgroundColor: SchoolColors.canvas,
      textTheme: const TextTheme(
        bodyLarge: TextStyle(
          color: SchoolColors.institutionalInk,
          fontSize: 16,
          height: 1.5,
        ),
        bodyMedium: TextStyle(
          color: SchoolColors.institutionalInk,
          fontSize: 14,
          height: 1.45,
        ),
        labelLarge: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
        titleLarge: TextStyle(
          color: SchoolColors.institutionalInk,
          fontSize: 24,
          fontWeight: FontWeight.w700,
          height: 1.2,
        ),
        titleMedium: TextStyle(
          color: SchoolColors.institutionalInk,
          fontSize: 18,
          fontWeight: FontWeight.w700,
          height: 1.25,
        ),
      ),
      useMaterial3: true,
    );
  }
}

enum SchoolStatusTone { information, success, warning, error }

final class SchoolDestination {
  const SchoolDestination({
    required this.icon,
    required this.label,
    required this.selectedIcon,
  });

  final IconData icon;
  final IconData selectedIcon;
  final String label;
}

class SchoolAdaptiveScaffold extends StatelessWidget {
  const SchoolAdaptiveScaffold({
    required this.body,
    required this.destinations,
    required this.onDestinationSelected,
    required this.selectedIndex,
    required this.title,
    this.actions = const <Widget>[],
    this.status,
    super.key,
  });

  final String title;
  final Widget body;
  final List<SchoolDestination> destinations;
  final int selectedIndex;
  final ValueChanged<int> onDestinationSelected;
  final List<Widget> actions;
  final Widget? status;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final isWide = constraints.maxWidth >= 760;
      final statusWidget = status;
      final content = Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (statusWidget != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                SchoolSpacing.md,
                SchoolSpacing.md,
                SchoolSpacing.md,
                0,
              ),
              child: statusWidget,
            ),
          Expanded(child: body),
        ],
      );

      return Scaffold(
        appBar: AppBar(title: Text(title), actions: actions),
        body: isWide
            ? Row(
                children: [
                  NavigationRail(
                    destinations: destinations
                        .map(
                          (destination) => NavigationRailDestination(
                            icon: Icon(destination.icon),
                            label: Text(destination.label),
                            selectedIcon: Icon(destination.selectedIcon),
                          ),
                        )
                        .toList(growable: false),
                    labelType: NavigationRailLabelType.all,
                    onDestinationSelected: onDestinationSelected,
                    selectedIndex: selectedIndex,
                  ),
                  const VerticalDivider(width: 1),
                  Expanded(child: content),
                ],
              )
            : content,
        bottomNavigationBar: isWide
            ? null
            : NavigationBar(
                destinations: destinations
                    .map(
                      (destination) => NavigationDestination(
                        icon: Icon(destination.icon),
                        label: destination.label,
                        selectedIcon: Icon(destination.selectedIcon),
                      ),
                    )
                    .toList(growable: false),
                onDestinationSelected: onDestinationSelected,
                selectedIndex: selectedIndex,
              ),
      );
    },
  );
}

class SchoolPanel extends StatelessWidget {
  const SchoolPanel({required this.child, this.padding, super.key});

  final Widget child;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) => Material(
    clipBehavior: Clip.antiAlias,
    color: SchoolColors.paper,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(16),
      side: const BorderSide(color: SchoolColors.structuralRule),
    ),
    child: Padding(
      padding: padding ?? const EdgeInsets.all(SchoolSpacing.md),
      child: child,
    ),
  );
}

class SchoolStatusBanner extends StatelessWidget {
  const SchoolStatusBanner({
    required this.label,
    required this.message,
    required this.tone,
    super.key,
  });

  final String label;
  final String message;
  final SchoolStatusTone tone;

  @override
  Widget build(BuildContext context) {
    final (surface, text, icon) = switch (tone) {
      SchoolStatusTone.information => (
        SchoolColors.informationSurface,
        SchoolColors.informationText,
        Icons.info_outline,
      ),
      SchoolStatusTone.success => (
        SchoolColors.successSurface,
        SchoolColors.successText,
        Icons.check_circle_outline,
      ),
      SchoolStatusTone.warning => (
        SchoolColors.warningSurface,
        SchoolColors.warningText,
        Icons.warning_amber_outlined,
      ),
      SchoolStatusTone.error => (
        SchoolColors.errorSurface,
        SchoolColors.errorText,
        Icons.error_outline,
      ),
    };

    return Semantics(
      container: true,
      label: '$label. $message',
      liveRegion: tone == SchoolStatusTone.error,
      child: Container(
        decoration: BoxDecoration(
          border: Border.all(color: text.withValues(alpha: 0.35)),
          borderRadius: BorderRadius.circular(8),
          color: surface,
        ),
        padding: const EdgeInsets.all(SchoolSpacing.sm),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: text),
            const SizedBox(width: SchoolSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: TextStyle(color: text, fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 2),
                  Text(message, style: TextStyle(color: text)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class SchoolPageSection extends StatelessWidget {
  const SchoolPageSection({
    required this.child,
    required this.title,
    this.description,
    super.key,
  });

  final String title;
  final String? description;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final descriptionText = description;
    return Padding(
      padding: const EdgeInsets.all(SchoolSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleLarge),
          if (descriptionText != null) ...[
            const SizedBox(height: SchoolSpacing.xs),
            Text(
              descriptionText,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: SchoolColors.operationalMuted,
              ),
            ),
          ],
          const SizedBox(height: SchoolSpacing.md),
          child,
        ],
      ),
    );
  }
}
