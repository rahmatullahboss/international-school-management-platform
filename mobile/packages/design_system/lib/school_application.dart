import 'package:flutter/material.dart';
import 'package:school_design_system/school_design_system.dart';

typedef SchoolApplicationTitleBuilder =
    String Function(SchoolShellStrings strings);

/// Presentation-only locale preference for a mobile application.
///
/// A null locale follows the ordered device locale list. Explicit selection is
/// limited to approved locales and cannot alter account, tenant, campus,
/// persona, capability, student or server authority.
final class SchoolLocaleController extends ChangeNotifier {
  SchoolLocaleController({Locale? initialLocale})
    : _locale = _validateOptional(initialLocale);

  Locale? _locale;

  Locale? get locale => _locale;

  bool get followsDeviceLocale => _locale == null;

  void selectLocale(Locale locale) {
    final next = _validate(locale);
    if (_locale == next) return;
    _locale = next;
    notifyListeners();
  }

  void followDeviceLocale() {
    if (_locale == null) return;
    _locale = null;
    notifyListeners();
  }

  static Locale? _validateOptional(Locale? locale) =>
      locale == null ? null : _validate(locale);

  static Locale _validate(Locale locale) {
    if (!SchoolLocalePolicy.isSupported(locale)) {
      throw ArgumentError.value(
        locale,
        'locale',
        'Only approved School mobile locales may be selected.',
      );
    }
    return SchoolLocalePolicy.resolveSupportedLocale(
      locale,
      SchoolLocalizationConfiguration.supportedLocales,
    );
  }
}

/// Shared production composition for localized Material applications.
///
/// This wrapper owns presentation configuration only. Routing, authorization,
/// repositories, synchronization and native restricted-data handling remain
/// supplied by their owning application layers.
final class SchoolLocalizedMaterialApp extends StatelessWidget {
  const SchoolLocalizedMaterialApp({
    required Widget this.home,
    required this.titleBuilder,
    this.builder,
    this.debugShowCheckedModeBanner = false,
    this.localeController,
    this.theme,
    super.key,
  }) : routerConfig = null;

  const SchoolLocalizedMaterialApp.router({
    required RouterConfig<Object> this.routerConfig,
    required this.titleBuilder,
    this.builder,
    this.debugShowCheckedModeBanner = false,
    this.localeController,
    this.theme,
    super.key,
  }) : home = null;

  final TransitionBuilder? builder;
  final bool debugShowCheckedModeBanner;
  final Widget? home;
  final SchoolLocaleController? localeController;
  final RouterConfig<Object>? routerConfig;
  final ThemeData? theme;
  final SchoolApplicationTitleBuilder titleBuilder;

  @override
  Widget build(BuildContext context) {
    final controller = localeController;
    if (controller == null) return _buildApplication(null);

    return AnimatedBuilder(
      animation: controller,
      builder: (context, child) => _buildApplication(controller.locale),
    );
  }

  Widget _buildApplication(Locale? locale) {
    final router = routerConfig;
    if (router != null) {
      return MaterialApp.router(
        builder: builder,
        debugShowCheckedModeBanner: debugShowCheckedModeBanner,
        locale: locale,
        localeListResolutionCallback:
            SchoolLocalizationConfiguration.localeListResolutionCallback,
        localizationsDelegates:
            SchoolLocalizationConfiguration.localizationsDelegates,
        onGenerateTitle: _generateTitle,
        routerConfig: router,
        supportedLocales: SchoolLocalizationConfiguration.supportedLocales,
        theme: theme ?? SchoolTheme.light(),
      );
    }

    return MaterialApp(
      builder: builder,
      debugShowCheckedModeBanner: debugShowCheckedModeBanner,
      home: home,
      locale: locale,
      localeListResolutionCallback:
          SchoolLocalizationConfiguration.localeListResolutionCallback,
      localizationsDelegates:
          SchoolLocalizationConfiguration.localizationsDelegates,
      onGenerateTitle: _generateTitle,
      supportedLocales: SchoolLocalizationConfiguration.supportedLocales,
      theme: theme ?? SchoolTheme.light(),
    );
  }

  String _generateTitle(BuildContext context) =>
      titleBuilder(SchoolShellStrings.of(context));
}
