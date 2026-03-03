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
[![license](https://img.shields.io/github/license/serbi2012/tab-sync?style=for-the-badge&color=blue&logo=open-source-initiative&logoColor=white)](./LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/serbi2012/tab-sync?style=for-the-badge&color=yellow&logo=github&logoColor=white)](https://github.com/serbi2012/tab-sync)

<br />

```mermaid
graph LR
    A["<b>Tab A</b><br/>👑 Leader"] <-->|"realtime sync"| B["<b>Tab B</b><br/>Follower"]
    B <-->|"realtime sync"| C["<b>Tab C</b><br/>Follower"]
    A <-->|"realtime sync"| C

    style A fill:#4f46e5,stroke:#4338ca,color:#fff,stroke-width:2px
    style B fill:#6366f1,stroke:#4f46e5,color:#fff,stroke-width:2px
    style C fill:#6366f1,stroke:#4f46e5,color:#fff,stroke-width:2px
```

<br />

[**Getting Started**](#-getting-started) · [**API**](#-api-reference) · [**React**](#%EF%B8%8F-react) · [**Architecture**](#-architecture) · [**Examples**](#-examples)

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
Fully typed arguments, Promise-based calls with timeout handling

#### ⚛️ React Hooks
Built on `useSyncExternalStore` for zero-tear concurrent rendering

</td>
<td width="50%" valign="top">

#### 🛡️ Middleware Pipeline
Intercept, validate, and transform state changes before they're applied

#### 💾 State Persistence
Survive page reloads with key whitelisting and custom storage backends

#### 🔒 End-to-End Type Safety
Discriminated unions, full type inference, and generic constraints

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

```mermaid
graph LR
    A["set('age', -5)"] --> B{Middleware<br/>Pipeline}
    B -->|"age < 0 → reject"| C["❌ Blocked"]
    D["set('name', '  Alice  ')"] --> B
    B -->|"trim()"| E["✅ 'Alice'"]

    style A fill:#f59e0b,stroke:#d97706,color:#fff
    style D fill:#f59e0b,stroke:#d97706,color:#fff
    style B fill:#6366f1,stroke:#4f46e5,color:#fff
    style C fill:#ef4444,stroke:#dc2626,color:#fff
    style E fill:#22c55e,stroke:#16a34a,color:#fff
```

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
  TabSyncProvider, useTabSync, useTabSyncValue, useTabSyncSelector, useIsLeader,
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

```mermaid
graph TB
    subgraph API["🔌 Public API — createTabSync()"]
        SM["📊 State Manager<br/><i>get / set / patch / subscribe</i>"]
        LE["👑 Leader Election<br/><i>heartbeat / failover / resign</i>"]
        RPC["📡 RPC Handler<br/><i>call / handle / timeout</i>"]
    end

    subgraph CORE["⚙️ Core Layer"]
        TR["📋 Tab Registry<br/><i>tracks all active tabs</i>"]
        MW["🛡️ Middleware Pipeline<br/><i>intercept → validate → transform → apply</i>"]
    end

    subgraph TRANSPORT["📡 Transport Layer — auto-detect"]
        BC["⚡ BroadcastChannel<br/><i>primary, fast</i>"]
        LS["💾 localStorage<br/><i>fallback</i>"]
    end

    SM --> TR
    LE --> TR
    RPC --> TR
    TR --> MW
    MW --> BC
    MW --> LS

    style API fill:#4f46e5,stroke:#4338ca,color:#fff,stroke-width:2px
    style CORE fill:#7c3aed,stroke:#6d28d9,color:#fff,stroke-width:2px
    style TRANSPORT fill:#2563eb,stroke:#1d4ed8,color:#fff,stroke-width:2px
    style SM fill:#6366f1,stroke:#4f46e5,color:#fff
    style LE fill:#6366f1,stroke:#4f46e5,color:#fff
    style RPC fill:#6366f1,stroke:#4f46e5,color:#fff
    style TR fill:#8b5cf6,stroke:#7c3aed,color:#fff
    style MW fill:#8b5cf6,stroke:#7c3aed,color:#fff
    style BC fill:#3b82f6,stroke:#2563eb,color:#fff
    style LS fill:#3b82f6,stroke:#2563eb,color:#fff
```

</div>

<br />

### How State Sync Works

```mermaid
sequenceDiagram
    participant A as Tab A (Leader 👑)
    participant BC as BroadcastChannel
    participant B as Tab B
    participant C as Tab C

    A->>A: set('theme', 'dark')
    Note over A: Local state updated instantly
    A->>BC: STATE_UPDATE { theme: 'dark' }
    BC-->>B: 
    BC-->>C: 
    B->>B: Apply state + notify subscribers
    C->>C: Apply state + notify subscribers
```

### How Leader Election Works

```mermaid
sequenceDiagram
    participant A as Tab A (oldest)
    participant B as Tab B
    participant C as Tab C (newest)

    Note over A,C: Leader (Tab A) closes...
    A--xB: ❌ Heartbeat stops
    B->>B: 3 missed heartbeats → leader dead
    B->>C: LEADER_CLAIM
    C->>C: Tab B is older → yield
    Note over B: Waits 300ms for higher-priority claims
    B->>C: LEADER_ACK
    Note over B: 👑 Tab B is now leader
    B->>C: LEADER_HEARTBEAT (every 2s)
```

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

```mermaid
graph LR
    Server["🖥️ Server"] <-->|WebSocket| A["Tab A<br/>👑 Leader"]
    A -->|"state sync"| B["Tab B"]
    A -->|"state sync"| C["Tab C"]

    style Server fill:#059669,stroke:#047857,color:#fff
    style A fill:#4f46e5,stroke:#4338ca,color:#fff
    style B fill:#6366f1,stroke:#4f46e5,color:#fff
    style C fill:#6366f1,stroke:#4f46e5,color:#fff
```

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

<a href="https://github.com/serbi2012/tab-sync">
  <img src="https://img.shields.io/badge/GitHub-tab--bridge-4f46e5?style=for-the-badge&logo=github&logoColor=white" alt="GitHub" />
</a>
&nbsp;
<a href="https://www.npmjs.com/package/tab-bridge">
  <img src="https://img.shields.io/badge/npm-tab--bridge-cb3837?style=for-the-badge&logo=npm&logoColor=white" alt="npm" />
</a>

<br />
<br />

</div>
