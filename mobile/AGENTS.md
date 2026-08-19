# Mobile workspace delivery rules

- Keep the Family and Staff production applications fail closed when reviewed API/OIDC/provider runtime configuration is unavailable. Do not add a debug authentication bypass to production composition.
- Use the repository-pinned mobile toolchain expectation (Flutter 3.44.7 for the current CI contract). A server-local copy may live under ignored `.tooling/flutter`.
- After mobile source/configuration changes, run the relevant analyzers/tests and `python3 mobile/tool/verify_native_projects.py` from the repository root (or the equivalent command from `mobile`).
- For an Android development/test delivery, after local verification is green and an authenticated Firebase CLI is available, run `mobile/tool/distribute_android_dev.sh`. This builds both School Family and School Staff with a unique Android build number and distributes them to the dedicated School Management Firebase App Distribution project/group.
- Do not reuse the MFS Firebase project, credentials, runtime data, or secrets for this project.
- Firebase App Distribution is a test-delivery mechanism only. Production notification-provider activation, OIDC/provider configuration, database mutation, signing/store release, and real student-data use require their own reviewed authorization.
- Never commit service-account private keys, OAuth client secrets, APNs keys, signing keystores, or other private credentials. Firebase Android client configuration may be committed when it contains only the generated client identifiers/configuration intended for the app.
