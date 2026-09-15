# Pull request checks

PRs are the primary validation gate. Mobile validation is selected by
`.github/scripts/ci_changes.py` using the complete PR diff, including both sides
of renamed files.

| Changed files                                                                                | Mobile validation                                                    |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Docs, translations, ordinary frontend code                                                   | None                                                                 |
| Shared Rust source under `crates/`                                                           | Android ARM64 and iOS device/simulator `cargo check`                 |
| Cargo manifests/lockfile, toolchain, build scripts, shared Tauri integration, `crates/http/` | Full Android APK and iOS device check and unsigned simulator archive |
| Android project, icons, configuration, capabilities                                          | Full Android APK only                                                |
| iOS project, icons, configuration, capabilities                                              | iOS device check and unsigned simulator archive only                 |
| Frontend dependency manifests/lockfile                                                       | Both full mobile builds                                              |
| Server-only source/manifest                                                                  | None                                                                 |
| CI workflows/scripts                                                                         | Both full mobile builds                                              |

Mixed changes combine requirements; a full build takes precedence over a compile
check. Compile checks skip frontend, Gradle, and Xcode packaging, but still need
native toolchains for C/Swift dependencies. They do not replace linking,
packaging, or device runtime tests.

The `Build Status` check requires every selected job to succeed, including
mobile checks. Unselected jobs may be skipped. Native secret-store PR checks
retain credential tests; their standalone manual workflow also retains iOS
compile checks.

## Manual mobile builds

After this workflow is on the default branch, use **Actions → PR Check → Run
workflow**, and select the branch to validate. Manual runs execute both full
mobile builds without the unrelated frontend/Rust PR jobs. iOS archives are
unsigned: signing secrets, provisioning profiles, and distribution are not
required or performed.

## Frontend work

The frontend job builds package declarations once, checks package types once,
and checks frontend types during its production build. Lint, unit tests,
production builds, and browser regression tests remain required. Compare job and
step timings across several runs before claiming a speedup; mobile checks can
still be expensive on a cold cache.
