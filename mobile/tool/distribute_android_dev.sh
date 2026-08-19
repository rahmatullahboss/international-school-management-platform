#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOBILE_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${MOBILE_ROOT}/.." && pwd)"

FIREBASE_PROJECT_ID="${FIREBASE_PROJECT_ID:-school-management-mobile-dev}"
FIREBASE_GROUPS="${FIREBASE_GROUPS:-owner-testers}"
FAMILY_FIREBASE_APP_ID="${FAMILY_FIREBASE_APP_ID:-1:825907178224:android:75e859d723217a768e3035}"
STAFF_FIREBASE_APP_ID="${STAFF_FIREBASE_APP_ID:-1:825907178224:android:dccf16c308fb3afd8e3035}"
BUILD_NUMBER="${BUILD_NUMBER:-$(date +%s)}"
GIT_SHA="$(git -C "${REPO_ROOT}" rev-parse --short=12 HEAD)"
RELEASE_NOTES="${RELEASE_NOTES:-School mobile dev build ${GIT_SHA} · Android build ${BUILD_NUMBER}}"

if [[ -z "${FLUTTER_BIN:-}" && -x "${REPO_ROOT}/.tooling/flutter/bin/flutter" ]]; then
  FLUTTER_BIN="${REPO_ROOT}/.tooling/flutter/bin/flutter"
fi
if [[ -z "${FLUTTER_BIN:-}" ]]; then
  FLUTTER_BIN="$(command -v flutter || true)"
fi
if [[ -z "${FLUTTER_BIN}" || ! -x "${FLUTTER_BIN}" ]]; then
  echo "a compatible Flutter executable is required (set FLUTTER_BIN if needed)" >&2
  exit 1
fi
command -v firebase >/dev/null 2>&1 || {
  echo "firebase CLI is required" >&2
  exit 1
}

if ! [[ "${BUILD_NUMBER}" =~ ^[0-9]+$ ]]; then
  echo "BUILD_NUMBER must be a positive integer" >&2
  exit 1
fi
if (( BUILD_NUMBER < 1 || BUILD_NUMBER > 2100000000 )); then
  echo "BUILD_NUMBER must be between 1 and 2100000000 for Android" >&2
  exit 1
fi

COMMON_DART_DEFINES=()
for key in SCHOOL_API_BASE_URL SCHOOL_OIDC_ISSUER SCHOOL_OIDC_CLIENT_ID SCHOOL_OIDC_SCOPES SCHOOL_OIDC_POST_LOGOUT_REDIRECT_URI; do
  value="${!key:-}"
  if [[ -n "${value}" ]]; then
    COMMON_DART_DEFINES+=("--dart-define=${key}=${value}")
  fi
done

build_and_distribute() {
  local app_name="$1"
  local app_dir="$2"
  local firebase_app_id="$3"
  local redirect_uri="$4"
  local apk_path="${app_dir}/build/app/outputs/flutter-apk/app-debug.apk"
  local dart_defines=("${COMMON_DART_DEFINES[@]}")

  if [[ -n "${redirect_uri}" ]]; then
    dart_defines+=("--dart-define=SCHOOL_OIDC_REDIRECT_URI=${redirect_uri}")
  fi

  echo "==> Building ${app_name} (build ${BUILD_NUMBER})"
  (
    cd "${app_dir}"
    "${FLUTTER_BIN}" build apk --debug --build-number "${BUILD_NUMBER}" "${dart_defines[@]}"
  )

  if [[ ! -f "${apk_path}" ]]; then
    echo "APK not found: ${apk_path}" >&2
    exit 1
  fi

  echo "==> Distributing ${app_name} to Firebase group ${FIREBASE_GROUPS}"
  firebase appdistribution:distribute "${apk_path}" \
    --app "${firebase_app_id}" \
    --groups "${FIREBASE_GROUPS}" \
    --release-notes "${RELEASE_NOTES}" \
    --project "${FIREBASE_PROJECT_ID}"
}

FAMILY_REDIRECT_URI="${SCHOOL_FAMILY_OIDC_REDIRECT_URI:-}"
STAFF_REDIRECT_URI="${SCHOOL_STAFF_OIDC_REDIRECT_URI:-}"

build_and_distribute \
  "School Family" \
  "${MOBILE_ROOT}/apps/family_app" \
  "${FAMILY_FIREBASE_APP_ID}" \
  "${FAMILY_REDIRECT_URI}"

build_and_distribute \
  "School Staff" \
  "${MOBILE_ROOT}/apps/staff_app" \
  "${STAFF_FIREBASE_APP_ID}" \
  "${STAFF_REDIRECT_URI}"

echo "==> Firebase App Distribution completed for both Android apps."
