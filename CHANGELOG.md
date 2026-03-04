# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-03-04

### Added

- **Jotai Middleware** (`tab-bridge/jotai`) — `atomWithTabSync` for cross-tab atom synchronization
  - Per-atom `createTabSync` instance scoped to `${channel}:${key}`
  - Full compatibility with derived (read-only) atoms
  - Automatic instance lifecycle (created on mount, destroyed on unmount)
  - `AtomWithTabSyncOptions` type export
- **Redux Store Enhancer** (`tab-bridge/redux`) — `tabSyncEnhancer` for Redux/RTK store synchronization
  - State-based sync (diffs top-level keys after each dispatch)
  - Internal `@@tab-bridge/MERGE` action handled by wrapped reducer
  - `include` / `exclude` for selective slice sync
  - Compatible with Redux Toolkit's `configureStore`
  - `TabSyncReduxOptions` and `TAB_SYNC_MERGE_ACTION` exports
- **React DevTools Panel** (`TabSyncDevTools`) — floating dev panel for tab-bridge inspection
  - State tab: live JSON view + manual state editing
  - Tabs tab: active tab list with leader badge and "you" indicator
  - Log tab: real-time event stream (state changes, tab joins/leaves)
  - Configurable position (`bottom-right`, `bottom-left`, `top-right`, `top-left`)
  - Tree-shakeable — excluded from production bundles when not imported
- **E2E Tests** (Playwright) — real browser multi-tab testing
  - State Sync: 3 scenarios (one-way, bidirectional, patch)
  - Leader Election: 3 scenarios (election, tab join, failover)
  - RPC: 3 scenarios (direct call, leader call, callAll fan-out)
  - CI workflow job for automated E2E runs

## [0.3.0] - 2026-03-03

### Added

- **Zustand Middleware** (`tab-bridge/zustand`) — one-line integration for Zustand stores with automatic cross-tab state synchronization
  - `tabSync` middleware wrapping Zustand's `StateCreator`
  - Selective key sync via `include` / `exclude` options
  - Functions (actions) are automatically excluded from synchronization
  - Compatible with Zustand's `persist` middleware (composable in any order)
  - `onSyncReady` callback for accessing the underlying `TabSyncInstance`
  - `TabSyncZustandOptions` type export
- **Interactive Demos** — 3 new showcase demos in `examples/`
  - Collaborative Editor — real-time multi-tab text editing
  - Shopping Cart — cart sync across tabs with persistence
  - Leader Dashboard — leader-only data fetching with RPC
- **Next.js Guide** (`docs/NEXTJS.md`) — SSR-safe usage patterns for App Router, hydration mismatch prevention, and Provider setup

### Changed

- Updated GitHub Pages deploy workflow to serve all demo HTML files
- README expanded with Zustand middleware section, Next.js section, and interactive demo links

## [0.2.0] - 2026-02-26

### Added

- **State Transactions** — `sync.transaction()` for atomic multi-key updates with abort support
- **Broadcast RPC** — `sync.callAll()` to invoke an RPC method on all other tabs and collect responses
- **`select()` debounce** — optional `debounce` parameter to throttle derived-state callbacks
- **React `useTabSyncActions()`** — returns `set`, `patch`, `transaction` without subscribing to state (no re-renders)
- **React `useTabs()`** — subscribe to the list of active tabs
- **React `useLeaderInfo()`** — subscribe to the current leader's full `TabInfo`
- **Destroy guards** — all public methods now throw `TabSyncError` with `DESTROYED` code after `sync.destroy()`

### Changed

- **Leader Election** — added `generation` and `claimId` fields for split-brain prevention and stale ACK filtering
- **RPC `sendResponse`** — graceful fallback when result serialization fails
- **Type definitions** — split `src/types.ts` into domain-specific files under `src/types/`
- **Persistence** — extracted into dedicated `src/core/persist.ts` module
- **Logger** — extracted into `src/utils/logger.ts`
- **Test structure** — migrated all tests from co-located `src/` to mirrored `tests/` directory

## [0.1.1] - 2026-03-03

### Fixed

- README Mermaid diagrams now render as images on npm (npm does not support Mermaid natively)

### Changed

- Renamed npm package from `tab-sync` to `tab-bridge`
- Expanded `package.json` keywords for better npm discoverability

## [0.1.0] - 2026-02-26

### Added

- **State Synchronization** — real-time state sync across browser tabs with Last-Write-Wins conflict resolution
- **Leader Election** — modified Bully algorithm with heartbeat-based failure detection and automatic failover
- **Tab Registry** — tracks all open tabs with metadata (visibility, URL, leader status)
- **Cross-Tab RPC** — typed remote procedure calls between tabs with timeout and error propagation
- **React Adapter** — `TabSyncProvider`, `useTabSync`, `useTabSyncValue`, `useTabSyncSelector`, `useIsLeader` hooks built on `useSyncExternalStore`
- **Middleware Pipeline** — intercept, validate, and transform state changes before they're applied
- **State Persistence** — survive page reloads with localStorage (or custom storage), key whitelisting, and debounced writes
- **Custom Error System** — `TabSyncError` with structured `ErrorCode` values for precise error handling
- **Protocol Versioning** — safe rolling deployments with automatic message version filtering
- **SSR Safety** — environment detection guards for all browser-specific APIs
- **Typed Event Emitter** — minimal, fully typed emitter for internal and external event management
- **Discriminated Union Messages** — type-safe message routing with full payload inference
- **Dual Transport** — BroadcastChannel (primary) with automatic localStorage fallback
- **Debug Mode** — colored, structured console logging for development
- **Convenience APIs** — `once`, `select`, `waitForLeader` methods for improved DX
- **Dual Format Build** — ESM + CJS output with full TypeScript declarations (.d.ts + .d.cts)
- **Tree-Shakable** — code splitting enabled, `sideEffects: false`
- **CI Pipeline** — GitHub Actions with typecheck, test, build, and auto-publish on version change

[0.4.0]: https://github.com/serbi2012/tab-bridge/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/serbi2012/tab-bridge/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/serbi2012/tab-bridge/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/serbi2012/tab-bridge/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/serbi2012/tab-bridge/releases/tag/v0.1.0
