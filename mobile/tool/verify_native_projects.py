#!/usr/bin/env python3
"""Fail closed when committed Flutter native project settings drift."""

from __future__ import annotations

from pathlib import Path


APPS = {
    "family_app": {
        "bundle": "com.ozzyl.school.family",
        "label": "School Family",
        "scheme": "ozzylschoolfamily",
    },
    "staff_app": {
        "bundle": "com.ozzyl.school.staff",
        "label": "School Staff",
        "scheme": "ozzylschoolstaff",
    },
}


def require(path: Path, *snippets: str) -> str:
    if not path.is_file():
        raise SystemExit(f"NATIVE_FILE_REQUIRED:{path}")
    content = path.read_text(encoding="utf-8")
    for snippet in snippets:
        if snippet not in content:
            raise SystemExit(f"NATIVE_SETTING_REQUIRED:{path}:{snippet}")
    return content


def prohibit(path: Path, *snippets: str) -> None:
    content = require(path)
    for snippet in snippets:
        if snippet in content:
            raise SystemExit(f"NATIVE_SETTING_PROHIBITED:{path}:{snippet}")


def main() -> None:
    root = Path(__file__).resolve().parents[1] / "apps"
    for app, config in APPS.items():
        app_root = root / app
        gradle = app_root / "android/app/build.gradle.kts"
        require(
            gradle,
            f'namespace = "{config["bundle"]}"',
            f'applicationId = "{config["bundle"]}"',
            "minSdk = 23",
            f'"appAuthRedirectScheme" to "{config["scheme"]}"',
            "Release signing is injected only by the controlled store pipeline.",
        )
        prohibit(gradle, 'signingConfigs.getByName("debug")')

        android_manifest = app_root / "android/app/src/main/AndroidManifest.xml"
        require(
            android_manifest,
            f'android:label="{config["label"]}"',
            'android:allowBackup="false"',
            'android:usesCleartextTraffic="false"',
        )
        prohibit(
            android_manifest,
            'android:allowBackup="true"',
            'android:usesCleartextTraffic="true"',
        )

        info_plist = app_root / "ios/Runner/Info.plist"
        require(
            info_plist,
            "<key>CFBundleURLTypes</key>",
            f"<string>{config['scheme']}</string>",
            "<key>LSSupportsOpeningDocumentsInPlace</key>\n\t<false/>",
            "<key>NSAllowsArbitraryLoads</key>\n\t\t<false/>",
            "<key>UIFileSharingEnabled</key>\n\t<false/>",
        )
        prohibit(
            info_plist,
            "<key>LSSupportsOpeningDocumentsInPlace</key>\n\t<true/>",
            "<key>NSAllowsArbitraryLoads</key>\n\t\t<true/>",
            "<key>UIFileSharingEnabled</key>\n\t<true/>",
        )
        require(
            app_root / "ios/Runner.xcodeproj/project.pbxproj",
            f"PRODUCT_BUNDLE_IDENTIFIER = {config['bundle']};",
        )
        require(
            app_root / "ios/Runner/DebugProfile.entitlements",
            "<key>keychain-access-groups</key>",
        )
        require(
            app_root / "ios/Runner/Release.entitlements",
            "<key>keychain-access-groups</key>",
        )
        require(
            app_root / "ios/Flutter/Debug.xcconfig",
            "CODE_SIGN_ENTITLEMENTS=Runner/DebugProfile.entitlements",
        )
        require(
            app_root / "ios/Flutter/Release.xcconfig",
            "CODE_SIGN_ENTITLEMENTS=Runner/Release.entitlements",
        )

    print("Native application configuration verified.")


if __name__ == "__main__":
    main()
