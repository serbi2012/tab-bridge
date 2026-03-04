<div align="center">

<br />

<h1>
  <code>🔄 tab-bridge</code>
</h1>

<h3>Real-time State Synchronization Across Browser Tabs</h3>

<p>
  <strong>One function call. Every tab in sync. Zero dependencies.</strong>
</p>

<br />

[![npm version](https://img.shields.io/npm/v/tab-bridge?style=for-the-badge&color=cb3837&label=npm&logo=npm&logoColor=white)](https://www.npmjs.com/package/tab-bridge)
[![bundle size](https://img.shields.io/bundlephobia/minzip/tab-bridge?style=for-the-badge&color=6ead0a&label=size&logo=webpack&logoColor=white)](https://bundlephobia.com/package/tab-bridge)
[![TypeScript](https://img.shields.io/badge/TypeScript-first-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![license](https://img.shields.io/github/license/serbi2012/tab-bridge?style=for-the-badge&color=blue&logo=open-source-initiative&logoColor=white)](./LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/serbi2012/tab-bridge?style=for-the-badge&color=yellow&logo=github&logoColor=white)](https://github.com/serbi2012/tab-bridge)

<br />

<img src="https://mermaid.ink/img/Z3JhcGggTFIKICAgIEFbIlRhYiBBXG7wn5GRIExlYWRlciJdIDwtLT58InJlYWx0aW1lIHN5bmMifCBCWyJUYWIgQlxuRm9sbG93ZXIiXQogICAgQiA8LS0-fCJyZWFsdGltZSBzeW5jInwgQ1siVGFiIENcbkZvbGxvd2VyIl0KICAgIEEgPC0tPnwicmVhbHRpbWUgc3luYyJ8IEMKICAgIHN0eWxlIEEgZmlsbDojNGY0NmU1LHN0cm9rZTojNDMzOGNhLGNvbG9yOiNmZmYsc3Ryb2tlLXdpZHRoOjJweAogICAgc3R5bGUgQiBmaWxsOiM2MzY2ZjEsc3Ryb2tlOiM0ZjQ2ZTUsY29sb3I6I2ZmZixzdHJva2Utd2lkdGg6MnB4CiAgICBzdHlsZSBDIGZpbGw6IzYzNjZmMSxzdHJva2U6IzRmNDZlNSxjb2xvcjojZmZmLHN0cm9rZS13aWR0aDoycHg?theme=dark&bgColor=0d1117" alt="tab-bridge sync diagram" />

<br />

[**Getting Started**](#-getting-started) · [**API**](#-api-reference) · [**React**](#%EF%B8%8F-react) · [**Zustand**](#-zustand) · [**Jotai**](#-jotai) · [**Redux**](#-redux) · [**DevTools**](#-devtools) · [**Next.js**](#-nextjs) · [**Architecture**](#-architecture) · [**Examples**](#-examples) · [**Live Demo**](https://serbi2012.github.io/tab-bridge/)

</div>

<br />

## Why tab-bridge?

> When users open your app in multiple tabs, things break — **stale data**, **duplicated WebSocket connections**, **conflicting writes**.

**tab-bridge** solves all of this with a single function call:

```ts
const sync = createTabSync({ initial: { theme: 'light', count: 0 } });
```

Every tab now shares the same state. One tab is automatically elected as leader. You can call functions across tabs like they're local. **No server needed.**

<br />

### ✨ Feature Highlights

<table>
<tr>
<td width="50%" valign="top">

#### ⚡ State Sync
LWW conflict resolution with batched broadcasts and custom merge strategies

#### 👑 Leader Election
Bully algorithm with heartbeat monitoring and automatic failover

#### 📡 Cross-Tab RPC
Fully typed arguments, Promise-based calls with `callAll` broadcast support

#### 🔄 Atomic Transactions
`transaction()` for safe multi-key updates with abort support

</td>
<td width="50%" valign="top">

#### ⚛️ React Hooks
7 hooks built on `useSyncExternalStore` — zero-tear concurrent rendering

#### 🛡️ Middleware Pipeline
Intercept, validate, and transform state changes before they're applied

#### 💾 State Persistence
Survive page reloads with key whitelisting and custom storage backends

#### 🐻 Zustand / Jotai / Redux
First-class integrations — `tabSync`, `atomWithTabSync`, `tabSyncEnhancer`

#### 🔧 DevTools Panel
Floating `<TabSyncDevTools />` with state inspection, tab list, and event log

#### 📦 Zero Dependencies
Native browser APIs only, ~4KB gzipped, fully tree-shakable

</td>
</tr>
</table>

<br />

---

<br />

## 📦 Getting Started

```bash
npm install tab-bridge
```

```ts
import { createTabSync } from 'tab-bridge';

const sync = createTabSync({
  initial: { theme: 'light', count: 0 },
});

// Read & write — synced to all tabs instantly
sync.get('theme');          // 'light'
sync.set('theme', 'dark'); // → every tab updates

// Subscribe to changes
const off = sync.on('count', (value, meta) => {
  console.log(`count is now ${value} (${meta.isLocal ? 'local' : 'remote'})`);
});

// Leader election — automatic
sync.onLeader(() => {
  const ws = new WebSocket('wss://api.example.com');
  return () => ws.close(); // cleanup when leadership is lost
});

// Cross-tab RPC
sync.handle('double', (n: number) => n * 2);
const result = await sync.call('leader', 'double', 21); // 42
```

<br />

---

<br />

## 📖 API Reference

### `createTabSync<TState, TRPCMap>(options?)`

The single entry point. Returns a fully-typed `TabSyncInstance`.

```ts
const sync = createTabSync<MyState>({
  initial: { theme: 'light', count: 0 },
  channel: 'my-app',
  debug: true,
});
```

<details>
<summary><b>📋 Full Options Table</b></summary>

<br />

| Option | Type | Default | Description |
|:-------|:-----|:--------|:------------|
| `initial` | `TState` | `{}` | Initial state before first sync |
| `channel` | `string` | `'tab-sync'` | Channel name — only matching tabs communicate |
| `transport` | `'broadcast-channel'` \| `'local-storage'` | auto | Force a specific transport layer |
| `merge` | `(local, remote, key) => value` | LWW | Custom conflict resolution |
| `leader` | `boolean` \| `LeaderOptions` | `true` | Leader election config |
| `debug` | `boolean` | `false` | Enable colored console logging |
| `persist` | `PersistOptions` \| `boolean` | `false` | State persistence config |
| `middlewares` | `Middleware[]` | `[]` | Middleware pipeline |
| `onError` | `(error: Error) => void` | noop | Global error callback |

</details>

<br />

### Instance Methods

<details open>
<summary><b>📊 State</b></summary>

<br />

```ts
sync.get('theme')                       // Read single key
sync.getAll()                           // Read full state (stable reference)
sync.set('theme', 'dark')              // Write single key → broadcasts to all tabs
sync.patch({ theme: 'dark', count: 5 }) // Write multiple keys in one broadcast

// Atomic multi-key update — return null to abort
sync.transaction((state) => {
  if (state.count >= 100) return null;  // abort
  return { count: state.count + 1, lastUpdated: Date.now() };
});
```

</details>

<details open>
<summary><b>🔔 Subscriptions</b></summary>

<br />

```ts
const off = sync.on('count', (value, meta) => { /* ... */ });
off(); // unsubscribe

sync.once('theme', (value) => console.log('Theme changed:', value));

sync.onChange((state, changedKeys, meta) => { /* ... */ });

sync.select(
  (state) => state.items.filter(i => i.done).length,
  (doneCount) => updateBadge(doneCount),
);

// Debounced derived state — callback fires at most once per 200ms
sync.select(
  (state) => state.items.length,
  (count) => analytics.track('item_count', count),
  { debounce: 200 },
);
```

</details>

<details open>
<summary><b>👑 Leader Election</b></summary>

<br />

```ts
sync.isLeader()                // → boolean
sync.getLeader()               // → TabInfo | null

sync.onLeader(() => {
  const ws = new WebSocket('wss://...');
  return () => ws.close();     // Cleanup on resign
});

const leader = await sync.waitForLeader(); // Promise-based
```

</details>

<details open>
<summary><b>📋 Tab Registry</b></summary>

<br />

```ts
sync.id                        // This tab's UUID
sync.getTabs()                 // → TabInfo[]
sync.getTabCount()             // → number

sync.onTabChange((tabs) => {
  console.log(`${tabs.length} tabs open`);
});
```

</details>

<details open>
<summary><b>📡 Cross-Tab RPC</b></summary>

<br />

```ts
sync.handle('getServerTime', () => ({
  iso: new Date().toISOString(),
}));

const { iso } = await sync.call('leader', 'getServerTime');
const result  = await sync.call(tabId, 'compute', payload, 10_000);

// Broadcast RPC to ALL other tabs and collect responses
const results = await sync.callAll('getStatus');
// results: Array<{ tabId: string; result?: T; error?: string }>
```

</details>

<details open>
<summary><b>♻️ Lifecycle</b></summary>

<br />

```ts
sync.ready      // false after destroy
sync.destroy()  // graceful shutdown, safe to call multiple times
```

</details>

<br />

---

<br />

## 🔷 Typed RPC

Define an RPC contract and get **full end-to-end type inference** — arguments, return types, and method names are all checked at compile time:

```ts
interface MyRPC {
  getTime: { args: void;                     result: { iso: string } };
  add:     { args: { a: number; b: number }; result: number };
  search:  { args: string;                   result: string[] };
}

const sync = createTabSync<MyState, MyRPC>({
  initial: { count: 0 },
});

sync.handle('add', ({ a, b }) => a + b);          // args are typed
const { iso } = await sync.call('leader', 'getTime'); // result is typed
const results = await sync.call(tabId, 'search', 'query'); // string[]
```

<br />

---

<br />

## 🛡️ Middleware

Intercept, validate, and transform state changes before they're applied:

```ts
const sync = createTabSync({
  initial: { name: '', age: 0 },
  middlewares: [
    {
      name: 'validator',
      onSet({ key, value, previousValue, meta }) {
        if (key === 'age' && (value as number) < 0)  return false;   // reject
        if (key === 'name') return { value: String(value).trim() };  // transform
      },
      afterChange(key, value, meta) {
        analytics.track('state_change', { key, source: meta.sourceTabId });
      },
      onDestroy() { /* cleanup */ },
    },
  ],
});
```

<img src="https://mermaid.ink/img/Z3JhcGggTFIKICAgIEFbInNldChhZ2UsIC01KSJdIC0tPiBCe01pZGRsZXdhcmUgUGlwZWxpbmV9CiAgICBCIC0tPnwiYWdlIDwgMCByZWplY3QifCBDWyJCbG9ja2VkIl0KICAgIERbInNldChuYW1lLCBBbGljZSkiXSAtLT4gQgogICAgQiAtLT58InRyaW0ifCBFWyJBbGljZSJdCiAgICBzdHlsZSBBIGZpbGw6I2Y1OWUwYixzdHJva2U6I2Q5NzcwNixjb2xvcjojZmZmCiAgICBzdHlsZSBEIGZpbGw6I2Y1OWUwYixzdHJva2U6I2Q5NzcwNixjb2xvcjojZmZmCiAgICBzdHlsZSBCIGZpbGw6IzYzNjZmMSxzdHJva2U6IzRmNDZlNSxjb2xvcjojZmZmCiAgICBzdHlsZSBDIGZpbGw6I2VmNDQ0NCxzdHJva2U6I2RjMjYyNixjb2xvcjojZmZmCiAgICBzdHlsZSBFIGZpbGw6IzIyYzU1ZSxzdHJva2U6IzE2YTM0YSxjb2xvcjojZmZm?theme=dark&bgColor=0d1117" alt="middleware pipeline diagram" />

<br />

---

<br />

## 💾 Persistence

State survives page reloads automatically:

```ts
// Simple — persist everything to localStorage
createTabSync({ initial: { ... }, persist: true });

// Advanced — fine-grained control
createTabSync({
  initial: { theme: 'light', tempData: null },
  persist: {
    key: 'my-app:state',
    include: ['theme'],        // only persist these keys
    debounce: 200,             // debounce writes (ms)
    storage: sessionStorage,   // custom storage backend
  },
});
```

<br />

---

<br />

## ⚛️ React

First-class React integration built on `useSyncExternalStore` for **zero-tear concurrent rendering**.

```tsx
import {
  TabSyncProvider, useTabSync, useTabSyncValue, useTabSyncSelector,
  useIsLeader, useTabs, useLeaderInfo, useTabSyncActions,
} from 'tab-bridge/react';
```

<br />

<details open>
<summary><b><code>TabSyncProvider</code> — Context Provider</b></summary>

<br />

```tsx
<TabSyncProvider options={{ initial: { count: 0 }, channel: 'app' }}>
  <App />
</TabSyncProvider>
```

</details>

<details open>
<summary><b><code>useTabSync()</code> — All-in-one hook</b></summary>

<br />

```tsx
function Counter() {
  const { state, set, isLeader, tabs } = useTabSync<MyState>();

  return (
    <div>
      <h2>Count: {state.count}</h2>
      <button onClick={() => set('count', state.count + 1)}>+1</button>
      <p>{isLeader ? '👑 Leader' : 'Follower'} · {tabs.length} tabs</p>
    </div>
  );
}
```

</details>

<details open>
<summary><b><code>useTabSyncValue(key)</code> — Single key, minimal re-renders</b></summary>

<br />

```tsx
function ThemeDisplay() {
  const theme = useTabSyncValue<MyState, 'theme'>('theme');
  return <div className={`app ${theme}`}>Current theme: {theme}</div>;
}
```

</details>

<details open>
<summary><b><code>useTabSyncSelector(selector)</code> — Derived state with memoization</b></summary>

<br />

```tsx
function DoneCount() {
  const count = useTabSyncSelector<MyState, number>(
    (state) => state.todos.filter(t => t.done).length,
  );
  return <span className="badge">{count} done</span>;
}
```

</details>

<details open>
<summary><b><code>useIsLeader()</code> — Leadership status</b></summary>

<br />

```tsx
function LeaderIndicator() {
  const isLeader = useIsLeader();
  if (!isLeader) return null;
  return <span className="badge badge-leader">Leader Tab</span>;
}
```

</details>

<details open>
<summary><b><code>useTabs()</code> — Active tab list</b></summary>

<br />

```tsx
function TabList() {
  const tabs = useTabs();
  return <p>{tabs.length} tab(s) open</p>;
}
```

</details>

<details open>
<summary><b><code>useLeaderInfo()</code> — Leader tab info</b></summary>

<br />

```tsx
function LeaderDisplay() {
  const leader = useLeaderInfo();
  if (!leader) return <p>No leader yet</p>;
  return <p>Leader: {leader.id}</p>;
}
```

</details>

<details open>
<summary><b><code>useTabSyncActions()</code> — Write-only (no re-renders)</b></summary>

<br />

```tsx
function IncrementButton() {
  const { set, patch, transaction } = useTabSyncActions<MyState>();
  return <button onClick={() => set('count', prev => prev + 1)}>+1</button>;
}
```

Components using only `useTabSyncActions` **never re-render** due to state changes — perfect for write-only controls.

</details>

<br />

---

<br />

## 🐻 Zustand

One-line integration for [Zustand](https://github.com/pmndrs/zustand) stores — all tabs stay in sync automatically.

```bash
npm install zustand
```

```ts
import { create } from 'zustand';
import { tabSync } from 'tab-bridge/zustand';

const useStore = create(
  tabSync(
    (set) => ({
      count: 0,
      theme: 'light',
      inc: () => set((s) => ({ count: s.count + 1 })),
      setTheme: (t: string) => set({ theme: t }),
    }),
    { channel: 'my-app' }
  )
);

// That's it — all tabs now share the same state.
// Functions (actions) are never synced, only data.
```

<details open>
<summary><b>📋 Middleware Options</b></summary>

<br />

| Option | Type | Default | Description |
|:-------|:-----|:--------|:------------|
| `channel` | `string` | `'tab-sync-zustand'` | Channel name for cross-tab communication |
| `include` | `string[]` | — | Only sync these keys (mutually exclusive with `exclude`) |
| `exclude` | `string[]` | — | Exclude these keys from syncing (mutually exclusive with `include`) |
| `merge` | `(local, remote, key) => value` | LWW | Custom conflict resolution |
| `transport` | `'broadcast-channel'` \| `'local-storage'` | auto | Force a specific transport |
| `debug` | `boolean` | `false` | Enable debug logging |
| `onError` | `(error) => void` | — | Error callback |
| `onSyncReady` | `(instance) => void` | — | Access the underlying `TabSyncInstance` for RPC/leader features |

</details>

<details>
<summary><b>🔑 Selective Key Sync</b></summary>

<br />

```ts
const useStore = create(
  tabSync(
    (set) => ({
      count: 0,
      theme: 'light',
      localDraft: '',       // won't be synced
      inc: () => set((s) => ({ count: s.count + 1 })),
    }),
    {
      channel: 'my-app',
      exclude: ['localDraft'],   // keep this key local-only
    }
  )
);
```

</details>

<details>
<summary><b>🤝 Works with Zustand <code>persist</code></b></summary>

<br />

Compose with Zustand's `persist` middleware — order doesn't matter:

```ts
import { persist } from 'zustand/middleware';

const useStore = create(
  persist(
    tabSync(
      (set) => ({
        count: 0,
        inc: () => set((s) => ({ count: s.count + 1 })),
      }),
      { channel: 'my-app' }
    ),
    { name: 'my-store' }
  )
);
```

</details>

<details>
<summary><b>🚀 Advanced: Access tab-bridge Instance</b></summary>

<br />

Use `onSyncReady` to access the underlying `TabSyncInstance` for RPC, leader election, and other advanced features:

```ts
let syncInstance: TabSyncInstance | null = null;

const useStore = create(
  tabSync(
    (set) => ({ count: 0 }),
    {
      channel: 'my-app',
      onSyncReady: (instance) => {
        syncInstance = instance;

        instance.handle('getCount', () => useStore.getState().count);

        instance.onLeader(() => {
          console.log('This tab is now the leader');
          return () => console.log('Leadership lost');
        });
      },
    }
  )
);
```

</details>

<br />

---

<br />

## 🧪 Jotai

Synchronize individual [Jotai](https://jotai.org) atoms across browser tabs with zero boilerplate.

```bash
npm install tab-bridge jotai
```

### Quick Start

```ts
import { atomWithTabSync } from 'tab-bridge/jotai';

const countAtom = atomWithTabSync('count', 0, { channel: 'my-app' });
const themeAtom = atomWithTabSync('theme', 'light', { channel: 'my-app' });
```

Use them like regular atoms — `useAtom(countAtom)` works as expected. Changes are automatically synced to all tabs.

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `channel` | `string` | `'tab-sync-jotai'` | Channel name for cross-tab communication |
| `transport` | `'broadcast-channel' \| 'local-storage'` | auto-detect | Force a specific transport |
| `debug` | `boolean` | `false` | Enable debug logging |
| `onError` | `(error: Error) => void` | — | Error callback |
| `onSyncReady` | `(instance: TabSyncInstance) => void` | — | Access underlying instance |

### How It Works

Each atom creates its own `createTabSync` instance scoped to `${channel}:${key}`. The instance is created when the atom is first subscribed to and destroyed when the last subscriber unmounts.

### Derived Atoms

Derived atoms work out of the box:

```ts
import { atom } from 'jotai';

const doubledAtom = atom((get) => get(countAtom) * 2);
// Automatically updates when countAtom syncs from another tab
```

<br />

---

<br />

## 🏪 Redux

Synchronize your Redux (or Redux Toolkit) store across browser tabs via a **store enhancer**.

```bash
npm install tab-bridge redux       # or @reduxjs/toolkit
```

### Quick Start

```ts
import { configureStore } from '@reduxjs/toolkit';
import { tabSyncEnhancer } from 'tab-bridge/redux';

const store = configureStore({
  reducer: { counter: counterReducer, theme: themeReducer },
  enhancers: (getDefault) =>
    getDefault().concat(tabSyncEnhancer({ channel: 'my-app' })),
});
```

Every dispatch that changes state is automatically synced. Remote changes are merged via an internal `@@tab-bridge/MERGE` action — no reducer changes needed.

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `channel` | `string` | `'tab-sync-redux'` | Channel name |
| `include` | `string[]` | — | Only sync these top-level keys (slice names) |
| `exclude` | `string[]` | — | Exclude these top-level keys |
| `merge` | `(local, remote, key) => unknown` | LWW | Custom conflict resolution |
| `transport` | `'broadcast-channel' \| 'local-storage'` | auto-detect | Force transport |
| `debug` | `boolean` | `false` | Debug logging |
| `onError` | `(error: Error) => void` | — | Error callback |
| `onSyncReady` | `(instance: TabSyncInstance) => void` | — | Access underlying instance |

### Selective Sync

```ts
tabSyncEnhancer({
  channel: 'my-app',
  include: ['counter', 'settings'],  // only sync these slices
  // exclude: ['auth'],              // or exclude specific slices
})
```

### Design Decision: State-Based Sync

The enhancer diffs top-level state keys after each dispatch rather than replaying actions. This guarantees consistency regardless of reducer purity and works with any middleware stack.

<br />

---

<br />

## 🔧 DevTools

A floating development panel for inspecting tab-bridge state, tabs, and events in real time.

```tsx
import { TabSyncDevTools } from 'tab-bridge/react';

function App() {
  return (
    <TabSyncProvider options={{ initial: { count: 0 }, channel: 'app' }}>
      <MyApp />
      {process.env.NODE_ENV === 'development' && <TabSyncDevTools />}
    </TabSyncProvider>
  );
}
```

### Features

| Tab | Description |
|---|---|
| **State** | Live JSON view of current state + manual editing (textarea → Apply) |
| **Tabs** | Active tab list with leader badge and "you" indicator |
| **Log** | Real-time event stream — state changes, tab joins/leaves |

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `position` | `'bottom-right' \| 'bottom-left' \| 'top-right' \| 'top-left'` | `'bottom-right'` | Panel position |
| `defaultOpen` | `boolean` | `false` | Start expanded |

**Tree-shakeable** — if you never import `TabSyncDevTools`, it won't appear in your production bundle.

<br />

---

<br />

## 📘 Next.js

Using tab-bridge with **Next.js App Router**? Since tab-bridge relies on browser APIs, all usage must be in Client Components.

```tsx
// app/providers/tab-sync-provider.tsx
'use client';

import { TabSyncProvider } from 'tab-bridge/react';

export function AppTabSyncProvider({ children }: { children: React.ReactNode }) {
  return (
    <TabSyncProvider options={{ initial: { count: 0 }, channel: 'my-app' }}>
      {children}
    </TabSyncProvider>
  );
}
```

```tsx
// app/layout.tsx
import { AppTabSyncProvider } from './providers/tab-sync-provider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html><body>
      <AppTabSyncProvider>{children}</AppTabSyncProvider>
    </body></html>
  );
}
```

> **Full guide**: See [`docs/NEXTJS.md`](./docs/NEXTJS.md) for SSR safety patterns, hydration mismatch prevention, `useEffect` initialization, and Zustand integration with Next.js.

<br />

---

<br />

## 🚨 Error Handling

Structured errors with error codes for precise `catch` handling:

```ts
import { TabSyncError, ErrorCode } from 'tab-bridge';

try {
  await sync.call('leader', 'getData');
} catch (err) {
  if (err instanceof TabSyncError) {
    switch (err.code) {
      case ErrorCode.RPC_TIMEOUT:    // call timed out
      case ErrorCode.RPC_NO_LEADER:  // no leader elected yet
      case ErrorCode.RPC_NO_HANDLER: // method not registered on target
      case ErrorCode.DESTROYED:      // instance was destroyed
    }
  }
}

// Global error handler
createTabSync({ onError: (err) => Sentry.captureException(err) });
```

<br />

---

<br />

## 🏗️ Architecture

<div align="center">

<img src="https://mermaid.ink/img/Z3JhcGggVEIKICAgIHN1YmdyYXBoIEFQSVsiUHVibGljIEFQSSAtIGNyZWF0ZVRhYlN5bmMiXQogICAgICAgIFNNWyJTdGF0ZSBNYW5hZ2VyIl0KICAgICAgICBMRVsiTGVhZGVyIEVsZWN0aW9uIl0KICAgICAgICBSUENbIlJQQyBIYW5kbGVyIl0KICAgIGVuZAogICAgc3ViZ3JhcGggQ09SRVsiQ29yZSBMYXllciJdCiAgICAgICAgVFJbIlRhYiBSZWdpc3RyeSJdCiAgICAgICAgTVdbIk1pZGRsZXdhcmUgUGlwZWxpbmUiXQogICAgZW5kCiAgICBzdWJncmFwaCBUUkFOU1BPUlRbIlRyYW5zcG9ydCBMYXllciJdCiAgICAgICAgQkNbIkJyb2FkY2FzdENoYW5uZWwiXQogICAgICAgIExTWyJsb2NhbFN0b3JhZ2UiXQogICAgZW5kCiAgICBTTSAtLT4gVFIKICAgIExFIC0tPiBUUgogICAgUlBDIC0tPiBUUgogICAgVFIgLS0-IE1XCiAgICBNVyAtLT4gQkMKICAgIE1XIC0tPiBMUwogICAgc3R5bGUgQVBJIGZpbGw6IzRmNDZlNSxzdHJva2U6IzQzMzhjYSxjb2xvcjojZmZmLHN0cm9rZS13aWR0aDoycHgKICAgIHN0eWxlIENPUkUgZmlsbDojN2MzYWVkLHN0cm9rZTojNmQyOGQ5LGNvbG9yOiNmZmYsc3Ryb2tlLXdpZHRoOjJweAogICAgc3R5bGUgVFJBTlNQT1JUIGZpbGw6IzI1NjNlYixzdHJva2U6IzFkNGVkOCxjb2xvcjojZmZmLHN0cm9rZS13aWR0aDoycHg?theme=dark&bgColor=0d1117" alt="architecture diagram" />

</div>

<br />

### How State Sync Works

<img src="https://mermaid.ink/img/c2VxdWVuY2VEaWFncmFtCiAgICBwYXJ0aWNpcGFudCBBIGFzIFRhYiBBIExlYWRlcgogICAgcGFydGljaXBhbnQgQkMgYXMgQnJvYWRjYXN0Q2hhbm5lbAogICAgcGFydGljaXBhbnQgQiBhcyBUYWIgQgogICAgcGFydGljaXBhbnQgQyBhcyBUYWIgQwogICAgQS0-PkE6IHNldCB0aGVtZSBkYXJrCiAgICBOb3RlIG92ZXIgQTogTG9jYWwgc3RhdGUgdXBkYXRlZAogICAgQS0-PkJDOiBTVEFURV9VUERBVEUKICAgIEJDLS0-PkI6IG1lc3NhZ2UKICAgIEJDLS0-PkM6IG1lc3NhZ2UKICAgIEItPj5COiBBcHBseSArIG5vdGlmeQogICAgQy0-PkM6IEFwcGx5ICsgbm90aWZ5?theme=dark&bgColor=0d1117" alt="state sync sequence diagram" />

### How Leader Election Works

<img src="https://mermaid.ink/img/c2VxdWVuY2VEaWFncmFtCiAgICBwYXJ0aWNpcGFudCBBIGFzIFRhYiBBIG9sZGVzdAogICAgcGFydGljaXBhbnQgQiBhcyBUYWIgQgogICAgcGFydGljaXBhbnQgQyBhcyBUYWIgQyBuZXdlc3QKICAgIE5vdGUgb3ZlciBBLEM6IExlYWRlciBUYWIgQSBjbG9zZXMKICAgIEItPj5COiAzIG1pc3NlZCBoZWFydGJlYXRzCiAgICBCLT4-QzogTEVBREVSX0NMQUlNCiAgICBDLT4-QzogVGFiIEIgaXMgb2xkZXIgeWllbGQKICAgIE5vdGUgb3ZlciBCOiBXYWl0IDMwMG1zCiAgICBCLT4-QzogTEVBREVSX0FDSwogICAgTm90ZSBvdmVyIEI6IFRhYiBCIGlzIG5vdyBsZWFkZXIKICAgIEItPj5DOiBMRUFERVJfSEVBUlRCRUFU?theme=dark&bgColor=0d1117" alt="leader election sequence diagram" />

<br />

---

<br />

## 🔧 Advanced

<details>
<summary><b>🔌 Custom Transport Layer</b></summary>

<br />

```ts
import { createChannel } from 'tab-bridge';

createTabSync({ transport: 'local-storage' });

const channel = createChannel('my-channel', 'broadcast-channel');
```

</details>

<details>
<summary><b>🔢 Protocol Versioning</b></summary>

<br />

All messages include a `version` field. The library automatically ignores messages from incompatible protocol versions, enabling **safe rolling deployments** — old and new tabs can coexist without errors.

```ts
import { PROTOCOL_VERSION } from 'tab-bridge';
console.log(PROTOCOL_VERSION); // 1
```

</details>

<details>
<summary><b>🐛 Debug Mode</b></summary>

<br />

```ts
createTabSync({ debug: true });
```

Outputs colored, structured logs:

```
[tab-sync:a1b2c3d4] → STATE_UPDATE { theme: 'dark' }
[tab-sync:a1b2c3d4] ← LEADER_CLAIM { createdAt: 1708900000 }
[tab-sync:a1b2c3d4] ♛ Became leader
```

</details>

<details>
<summary><b>🧩 Exported Internals</b></summary>

<br />

For library authors or advanced use cases, all internal modules are exported:

```ts
import {
  StateManager, TabRegistry, LeaderElection, RPCHandler,
  Emitter, createMessage, generateTabId, monotonic,
} from 'tab-bridge';
```

</details>

<br />

---

<br />

## 💡 Examples

### 🎯 Interactive Demos

Try these demos live — open multiple tabs to see real-time synchronization in action:

| Demo | Description | Features |
|:-----|:-----------|:---------|
| [**Collaborative Editor**](https://serbi2012.github.io/tab-bridge/collaborative-editor.html) | Multi-tab real-time text editing | State Sync, Typing Indicators |
| [**Shopping Cart**](https://serbi2012.github.io/tab-bridge/shopping-cart.html) | Cart synced across all tabs + persistent | State Sync, Persistence |
| [**Leader Dashboard**](https://serbi2012.github.io/tab-bridge/leader-dashboard.html) | Only leader fetches data, followers use RPC | Leader Election, RPC, callAll |
| [**Full Feature Demo**](https://serbi2012.github.io/tab-bridge/) | All features in one page | Everything |

### Code Examples

<details>
<summary><b>🔐 Shared Authentication State</b></summary>

<br />

```ts
const auth = createTabSync({
  initial: { user: null, token: null },
  channel: 'auth',
  persist: { include: ['token'] },
});

auth.on('user', (user) => {
  if (user) showDashboard(user);
  else      redirectToLogin();
});

function logout() {
  auth.patch({ user: null, token: null }); // logout everywhere
}
```

</details>

<details>
<summary><b>🌐 Single WebSocket Connection (Leader Pattern)</b></summary>

<br />

<img src="https://mermaid.ink/img/Z3JhcGggTFIKICAgIFNlcnZlclsiU2VydmVyIl0gPC0tPnxXZWJTb2NrZXR8IEFbIlRhYiBBIExlYWRlciJdCiAgICBBIC0tPnxzdGF0ZSBzeW5jfCBCWyJUYWIgQiJdCiAgICBBIC0tPnxzdGF0ZSBzeW5jfCBDWyJUYWIgQyJdCiAgICBzdHlsZSBTZXJ2ZXIgZmlsbDojMDU5NjY5LHN0cm9rZTojMDQ3ODU3LGNvbG9yOiNmZmYKICAgIHN0eWxlIEEgZmlsbDojNGY0NmU1LHN0cm9rZTojNDMzOGNhLGNvbG9yOiNmZmYKICAgIHN0eWxlIEIgZmlsbDojNjM2NmYxLHN0cm9rZTojNGY0NmU1LGNvbG9yOiNmZmYKICAgIHN0eWxlIEMgZmlsbDojNjM2NmYxLHN0cm9rZTojNGY0NmU1LGNvbG9yOiNmZmY?theme=dark&bgColor=0d1117" alt="websocket leader pattern diagram" />

```ts
const sync = createTabSync({
  initial: { messages: [] as Message[] },
});

sync.onLeader(() => {
  const ws = new WebSocket('wss://chat.example.com');

  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    sync.set('messages', [...sync.get('messages'), msg]);
  };

  return () => ws.close(); // cleanup on leadership loss
});
```

</details>

<details>
<summary><b>🔔 Cross-Tab Notifications</b></summary>

<br />

```ts
interface NotifyRPC {
  notify: {
    args: { title: string; body: string };
    result: void;
  };
}

const sync = createTabSync<{}, NotifyRPC>({ channel: 'notifications' });

sync.onLeader(() => {
  sync.handle('notify', ({ title, body }) => {
    new Notification(title, { body });
  });
  return () => {};
});

await sync.call('leader', 'notify', {
  title: 'New Message',
  body: 'You have 3 unread messages',
});
```

</details>

<details>
<summary><b>🛒 React — Shopping Cart Sync</b></summary>

<br />

```tsx
interface CartState {
  items: Array<{ id: string; name: string; qty: number }>;
  total: number;
}

function Cart() {
  const { state, set } = useTabSync<CartState>();

  const itemCount = useTabSyncSelector<CartState, number>(
    (s) => s.items.reduce((sum, i) => sum + i.qty, 0),
  );

  return (
    <div>
      <h2>Cart ({itemCount} items)</h2>
      {state.items.map(item => (
        <div key={item.id}>
          {item.name} × {item.qty}
        </div>
      ))}
    </div>
  );
}
```

</details>

<br />

---

<br />

## 🌐 Browser Support

| | Browser | Version | Transport |
|:--|:--------|:--------|:----------|
| 🟢 | Chrome | 54+ | `BroadcastChannel` |
| 🟠 | Firefox | 38+ | `BroadcastChannel` |
| 🔵 | Safari | 15.4+ | `BroadcastChannel` |
| 🔷 | Edge | 79+ | `BroadcastChannel` |
| ⚪ | Older browsers | — | `localStorage` (auto-fallback) |

<br />

---

<br />

<div align="center">

<h3>📄 License</h3>

MIT © [serbi2012](https://github.com/serbi2012)

<br />

**If this library helped you, consider giving it a ⭐**

<br />

<a href="https://github.com/serbi2012/tab-bridge">
  <img src="https://img.shields.io/badge/GitHub-tab--bridge-4f46e5?style=for-the-badge&logo=github&logoColor=white" alt="GitHub" />
</a>
&nbsp;
<a href="https://www.npmjs.com/package/tab-bridge">
  <img src="https://img.shields.io/badge/npm-tab--bridge-cb3837?style=for-the-badge&logo=npm&logoColor=white" alt="npm" />
</a>

<br />
<br />

</div>
