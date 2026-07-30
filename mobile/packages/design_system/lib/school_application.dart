import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:school_design_system/school_design_system.dart';
import 'package:school_design_system/school_localization.dart';

typedef SchoolApplicationTitleBuilder =
    String Function(SchoolShellStrings strings);
typedef SchoolLocaleApplicationBuilder =
    Widget Function(BuildContext context, SchoolLocaleController controller);

/// Stores only an approved presentation language code.
///
/// Implementations must not store account, tenant, campus, persona, capability,
/// student, token, endpoint, or other authority-bearing values with this key.
abstract interface class SchoolLocalePreferenceStore {
  Future<String?> readLanguageCode();

  Future<void> writeLanguageCode(String? languageCode);
}

/// Device-backed locale preference using a key separate from authentication.
final class SecureSchoolLocalePreferenceStore
    implements SchoolLocalePreferenceStore {
  SecureSchoolLocalePreferenceStore({
    FlutterSecureStorage? storage,
    required String storageKey,
  }) : _storage = storage ?? const FlutterSecureStorage(),
       _storageKey = _validateStorageKey(storageKey);

  final FlutterSecureStorage _storage;
  final String _storageKey;

  @override
  Future<String?> readLanguageCode() => _storage.read(key: _storageKey);

  @override
  Future<void> writeLanguageCode(String? languageCode) {
    if (languageCode == null) {
      return _storage.delete(key: _storageKey);
    }
    final locale = Locale(languageCode);
    if (!SchoolLocalePolicy.isSupported(locale)) {
      throw ArgumentError.value(
        languageCode,
        'languageCode',
        'Only approved School mobile language codes may be stored.',
      );
    }
    return _storage.write(
      key: _storageKey,
      value: SchoolLocalePolicy.resolveSupportedLocale(
        locale,
        SchoolLocalePolicy.supportedLocales,
      ).languageCode,
    );
  }

  static String _validateStorageKey(String value) {
    final normalized = value.trim();
    if (normalized.isEmpty) {
      throw ArgumentError.value(
        value,
        'storageKey',
        'A storage key is required.',
      );
    }
    return normalized;
  }
}

/// In-memory preference store for deterministic source tests.
final class MemorySchoolLocalePreferenceStore
    implements SchoolLocalePreferenceStore {
  MemorySchoolLocalePreferenceStore({String? languageCode})
    : _languageCode = languageCode;

  String? _languageCode;

  String? get languageCode => _languageCode;

  @override
  Future<String?> readLanguageCode() async => _languageCode;

  @override
  Future<void> writeLanguageCode(String? languageCode) async {
    _languageCode = languageCode;
  }
}

/// Presentation-only locale preference for a mobile application.
///
/// A null locale follows the ordered device locale list. Explicit selection is
/// limited to approved locales and cannot alter account, tenant, campus,
/// persona, capability, student or server authority.
final class SchoolLocaleController extends ChangeNotifier {
  SchoolLocaleController({
    Locale? initialLocale,
    SchoolLocalePreferenceStore? preferenceStore,
  }) : _locale = _validateOptional(initialLocale),
       _preferenceStore = preferenceStore,
       _isInitialized = preferenceStore == null {
    SchoolLocaleRuntime.prefer(_locale);
  }

  factory SchoolLocaleController.secure({
    required String storageKey,
    FlutterSecureStorage? storage,
  }) => SchoolLocaleController(
    preferenceStore: SecureSchoolLocalePreferenceStore(
      storage: storage,
      storageKey: storageKey,
    ),
  );

  final SchoolLocalePreferenceStore? _preferenceStore;
  Locale? _locale;
  bool _isBusy = false;
  bool _isInitialized;
  String? _lastErrorCode;

  Locale? get locale => _locale;
  bool get followsDeviceLocale => _locale == null;
  bool get isBusy => _isBusy;
  bool get isInitialized => _isInitialized;
  String? get lastErrorCode => _lastErrorCode;

  String get compactLabel => switch (_locale?.languageCode) {
    'en' => 'EN',
    'bn' => 'বাংলা',
    'ar' => 'ع',
    _ => 'AUTO',
  };

  String get cycleSemanticLabel {
    final current = switch (_locale?.languageCode) {
      'en' => 'English',
      'bn' => 'Bangla',
      'ar' => 'Arabic',
      _ => 'device language',
    };
    final next = switch (_nextLocale()?.languageCode) {
      'en' => 'English',
      'bn' => 'Bangla',
      'ar' => 'Arabic',
      _ => 'device language',
    };
    return 'Language preference: $current. Activate to use $next.';
  }

  Future<void> initialize() async {
    if (_isInitialized) return;
    final store = _preferenceStore;
    if (store == null) {
      _isInitialized = true;
      notifyListeners();
      return;
    }

    _setBusy(true);
    try {
      final languageCode = await store.readLanguageCode();
      if (languageCode == null) {
        _applyLocale(null);
        _lastErrorCode = null;
      } else {
        final storedLocale = Locale(languageCode);
        if (!SchoolLocalePolicy.isSupported(storedLocale)) {
          await store.writeLanguageCode(null);
          _applyLocale(null);
          _lastErrorCode = 'MOBILE_LOCALE_PREFERENCE_INVALID';
        } else {
          _applyLocale(_validate(storedLocale));
          _lastErrorCode = null;
        }
      }
    } on Object {
      _applyLocale(null);
      _lastErrorCode = 'MOBILE_LOCALE_PREFERENCE_READ_FAILED';
    } finally {
      _isInitialized = true;
      _setBusy(false);
    }
  }

  /// Applies a temporary source/test preference without writing device state.
  void selectLocale(Locale locale) {
    _applyLocale(_validate(locale));
  }

  /// Returns to the ordered device locale list without writing device state.
  void followDeviceLocale() {
    _applyLocale(null);
  }

  Future<void> selectLocaleAndPersist(Locale locale) =>
      _persist(_validate(locale));

  Future<void> followDeviceLocaleAndPersist() => _persist(null);

  Future<void> cycleAndPersist() => _persist(_nextLocale());

  Future<void> _persist(Locale? next) async {
    final store = _preferenceStore;
    if (store == null) {
      _applyLocale(next);
      _lastErrorCode = null;
      notifyListeners();
      return;
    }
    if (_isBusy) return;

    _setBusy(true);
    try {
      await store.writeLanguageCode(next?.languageCode);
      _applyLocale(next);
      _lastErrorCode = null;
    } on Object {
      _lastErrorCode = 'MOBILE_LOCALE_PREFERENCE_WRITE_FAILED';
    } finally {
      _setBusy(false);
    }
  }

  Locale? _nextLocale() => switch (_locale?.languageCode) {
    null => const Locale('en'),
    'en' => const Locale('bn'),
    'bn' => const Locale('ar'),
    _ => null,
  };

  void _applyLocale(Locale? next) {
    if (_locale == next) {
      SchoolLocaleRuntime.prefer(next);
      return;
    }
    _locale = next;
    SchoolLocaleRuntime.prefer(next);
    notifyListeners();
  }

  void _setBusy(bool value) {
    if (_isBusy == value) return;
    _isBusy = value;
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

/// Rebuilds application composition when the persisted presentation locale
/// changes and exposes a minimum-size cycle control without opening a route.
///
/// The builder must return a new application widget instance. Stateful
/// application elements remain update-compatible, so authorization/session
/// state is preserved while MaterialApp locale resolution runs again.
final class SchoolLocalePreferenceHost extends StatelessWidget {
  const SchoolLocalePreferenceHost({
    required this.appBuilder,
    required this.controller,
    this.showCycleControl = true,
    super.key,
  });

  final SchoolLocaleApplicationBuilder appBuilder;
  final SchoolLocaleController controller;
  final bool showCycleControl;

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: controller,
    builder: (context, child) {
      final padding = MediaQueryData.fromView(View.of(context)).padding;
      return Stack(
        fit: StackFit.expand,
        textDirection: TextDirection.ltr,
        children: [
          appBuilder(context, controller),
          if (showCycleControl)
            Positioned(
              bottom: padding.bottom + 80,
              right: 12,
              child: _SchoolLocaleCycleControl(controller: controller),
            ),
        ],
      );
    },
  );
}

final class _SchoolLocaleCycleControl extends StatelessWidget {
  const _SchoolLocaleCycleControl({required this.controller});

  final SchoolLocaleController controller;

  @override
  Widget build(BuildContext context) {
    final hasError = controller.lastErrorCode != null;
    return Directionality(
      textDirection: TextDirection.ltr,
      child: Theme(
        data: SchoolTheme.light(),
        child: Semantics(
          button: true,
          enabled: !controller.isBusy,
          label: controller.cycleSemanticLabel,
          liveRegion: hasError,
          value: hasError
              ? 'Preference was not saved.'
              : controller.compactLabel,
          child: Material(
            clipBehavior: Clip.antiAlias,
            color: SchoolColors.paper,
            elevation: 6,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(28),
              side: BorderSide(
                color: hasError
                    ? SchoolColors.errorText
                    : SchoolColors.structuralRule,
              ),
            ),
            child: InkWell(
              onTap: controller.isBusy
                  ? null
                  : () => unawaited(controller.cycleAndPersist()),
              child: SizedBox.square(
                dimension: 56,
                child: Center(
                  child: controller.isBusy
                      ? const SizedBox.square(
                          dimension: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.language, size: 20),
                            Text(
                              controller.compactLabel,
                              maxLines: 1,
                              style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                ),
              ),
            ),
          ),
        ),
      ),
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
    final effectiveLocale = locale ?? SchoolLocaleRuntime.preferredLocale;
    final applicationKey = ValueKey<String>(
      effectiveLocale?.languageCode ?? 'device',
    );
    final router = routerConfig;
    if (router != null) {
      return MaterialApp.router(
        key: applicationKey,
        builder: builder,
        debugShowCheckedModeBanner: debugShowCheckedModeBanner,
        locale: effectiveLocale,
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
      key: applicationKey,
      builder: builder,
      debugShowCheckedModeBanner: debugShowCheckedModeBanner,
      home: home,
      locale: effectiveLocale,
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
