# AGENTS.md

Shared instructions for agents working on Wealthfolio, a local-first finance app
with a React frontend, Tauri desktop/mobile runtime, and Axum web server.

## Working agreements

- Resolve routine implementation choices from nearby code. State material
  assumptions; ask when ambiguity changes scope, public behavior, data
  compatibility, or an irreversible action.
- Prefer the smallest readable change that satisfies the task. Avoid speculative
  features and abstractions; preserve validation at external input and
  persistence boundaries.
- Match existing style. Do not refactor unrelated code or reformat adjacent
  files. Remove only imports, variables, and functions made unused by your
  changes.
- Preserve existing user changes. Report unrelated issues rather than fixing
  them.
- For multi-step work, give a brief plan with verification steps. Keep plans
  clear and concise; list unresolved questions only when they need an answer.
- Lead the final response with findings or outcomes. Include checks run,
  results, and any validation gaps. Use absolute file links in responses; keep
  repository documentation paths relative so they work in every checkout.

## Architecture and implementation

- Frontend code lives in `apps/frontend/src/`; shared TypeScript packages live
  in `packages/`. Reuse `@wealthfolio/ui` components and existing feature
  patterns.
- Frontend calls go through `@/adapters`. `apps/frontend/vite.config.ts` selects
  Tauri or web adapters at build time using `BUILD_TARGET`; `adapters/index.ts`
  defaults to Tauri for TypeScript checking. Do not assume a type check
  validates both runtime implementations.
- Shared domain calls live in `apps/frontend/src/adapters/shared/` and use
  `shared/platform.ts`, which resolves through `#platform`. Runtime-specific
  operations live in `adapters/tauri/` and `adapters/web/`; some features own
  local adapters. Follow the relevant existing domain instead of creating a new
  layer.
- Keep Tauri commands (`apps/tauri/src/commands/`) and Axum handlers
  (`apps/server/src/api/`) thin. Put shared business logic in the owning Rust
  crate; core services live in `crates/core/`, persistence and migrations in
  `crates/storage-sqlite/`.

When adding or changing a backend call, trace both runtime paths: the frontend
adapter/export, Tauri command registration in `apps/tauri/src/lib.rs`, web
command mapping in `apps/frontend/src/adapters/web/core.ts`, and Axum
route/handler. Use `apps/frontend/src/adapters/shared/accounts.ts` as a
shared-call example and
`apps/frontend/src/adapters/adapter-command-parity.test.ts` to check wiring.

For UI work, use React Router in `apps/frontend/src/routes.tsx`, existing
react-hook-form/Zod form patterns, and theme tokens in
`apps/frontend/src/globals.css`. Prefer interfaces for object shapes, named
component exports, and lowercase-with-dashes directories; avoid TypeScript
enums. For Rust domain errors, follow the existing `Result`/`Option` and
`thiserror` patterns.

## Persisted identifiers and security

- Reuse named constants for secret-store keys and identifiers shared across code
  paths. Put shared constants in the owning module/crate; preserve persisted key
  values when replacing literals.
- Preserve local-first SQLite storage and existing opt-in broker/device-sync
  boundaries. Do not introduce new storage or transmission of financial data
  outside the requested scope.
- Access secrets through `SecretStore` in `crates/core/src/secrets/mod.rs`.
  Tauri uses native credential storage (`apps/tauri/src/secret_store.rs`); the
  web server uses a file-backed store with configured encryption
  (`apps/server/src/secrets/mod.rs`, `apps/server/src/config.rs`). Preserve
  these protections; do not add plaintext persistence or browser localStorage
  for secrets.
- Never log secrets or financial data.

## Setup and commands

Run commands from the repository root unless noted. Use the Node version in
`.node-version`, pnpm version in `package.json`, and Rust toolchain in
`rust-toolchain.toml`. Install JS dependencies with
`pnpm install --frozen-lockfile`. Build package declarations with
`pnpm build:types` before standalone frontend checks/builds in a fresh checkout;
`pnpm type-check` includes that step.

| Task                       | Command / scope                                                                |
| -------------------------- | ------------------------------------------------------------------------------ |
| Desktop development        | `pnpm tauri dev` (persistent dev process)                                      |
| Web development            | `pnpm dev:web` (persistent dev process)                                        |
| TS tests, one run          | `pnpm --filter frontend exec vitest run` (append a test path for focused runs) |
| TS formatting, lint, types | `pnpm check` (does not run tests, builds, or Rust checks)                      |
| TS type checks             | `pnpm type-check`                                                              |
| Web frontend build         | `pnpm build`                                                                   |
| Tauri frontend build       | `pnpm build:tauri` (does not compile Rust)                                     |
| Focused Rust tests         | `cargo test --locked -p <crate> <test_filter>`                                 |
| Rust runtime compilation   | `cargo check --locked -p wealthfolio-app -p wealthfolio-server`                |

## Validation by change

Start with focused regression checks, then cover the affected consumers. After
checks pass, repeat or broaden them only for new changes, failures, or
unresolved risk. Do not substitute a running dev server for a completed build
check.

| Changed area                    | Required validation                                                                                                                                                               |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Documentation/instructions only | Verify referenced paths, commands, imports, and consistency; check formatting and diff. Application builds/tests are unnecessary.                                                 |
| Frontend or shared TS packages  | Relevant one-shot tests, lint, and `pnpm type-check`; build affected frontend targets (`pnpm build`, `pnpm build:tauri`). Shared frontend changes require both targets.           |
| Adapter/API wiring              | Above frontend checks plus `pnpm --filter frontend exec vitest run src/adapters/adapter-command-parity.test.ts`; check affected Rust runtimes and relevant handler/service tests. |
| Rust logic or persistence       | Focused crate tests and `cargo fmt --all -- --check`; compile affected consumers. Shared backend changes require both runtime packages in the command above.                      |
| UI behavior/layout              | Relevant frontend checks plus exercise the changed flow; use existing browser/layout tests when they cover it.                                                                    |

For full PR checks and environment prerequisites, consult
`.github/workflows/pr-check.yml` and relevant specialized workflows when working
in that area. Rust storage outbox tests need
`CONNECT_API_URL=http://test.local`; Tauri compilation needs frontend assets at
the configured `frontendDist` (build with `pnpm build:tauri`; CI documents its
placeholder setup). Native/mobile checks also require the target's system
dependencies and SDKs.

Report checks that were blocked or not run and why; never imply they passed.
Review the final diff for unrelated changes before finishing.

## Code review rules

For bug-fix reviews:

- Trace the reported symptom through the actual execution path before judging
  the fix. Establish why the original code fails and how the change prevents it.
- Seek a reproduction or regression test that fails before and passes after.
- Distinguish confirmed findings, hypotheses, and unverified behavior.
- “No regressions found” does not mean “the reported bug is fixed.” If
  root-cause evidence is missing, explicitly conclude **“fix not verified”**; do
  not imply approval.
- Inspect the exact PR revision and report validation limitations.
