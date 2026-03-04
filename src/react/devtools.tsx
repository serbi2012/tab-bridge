import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { TabInfo, ChangeMeta, TabSyncInstance } from '../types';
import { TabSyncContext } from './context';

// ── Types ───────────────────────────────────────────────────────────────────

export interface TabSyncDevToolsProps {
  /** Panel position on screen. @default 'bottom-right' */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  /** Start expanded. @default false */
  defaultOpen?: boolean;
}

interface LogEntry {
  id: number;
  time: number;
  kind: 'state' | 'tab' | 'leader';
  detail: string;
}

type PanelTab = 'state' | 'tabs' | 'log';

// ── Styles ──────────────────────────────────────────────────────────────────

const FONT = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

function containerStyle(
  position: NonNullable<TabSyncDevToolsProps['position']>,
): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'fixed',
    zIndex: 99999,
    fontFamily: FONT,
    fontSize: 12,
    color: '#e4e4e7',
    lineHeight: 1.5,
  };
  if (position.includes('bottom')) base.bottom = 8;
  else base.top = 8;
  if (position.includes('right')) base.right = 8;
  else base.left = 8;
  return base;
}

const PANEL: React.CSSProperties = {
  width: 380,
  maxHeight: 420,
  background: '#18181b',
  border: '1px solid #3f3f46',
  borderRadius: 8,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 8px 32px rgba(0,0,0,.45)',
};

const TOGGLE_BTN: React.CSSProperties = {
  background: '#18181b',
  color: '#a1a1aa',
  border: '1px solid #3f3f46',
  borderRadius: 6,
  padding: '4px 12px',
  cursor: 'pointer',
  fontFamily: FONT,
  fontSize: 11,
  marginBottom: 4,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const TAB_BAR: React.CSSProperties = {
  display: 'flex',
  borderBottom: '1px solid #3f3f46',
  background: '#27272a',
};

function tabBtnStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '6px 0',
    background: active ? '#18181b' : 'transparent',
    color: active ? '#fafafa' : '#a1a1aa',
    border: 'none',
    borderBottom: active ? '2px solid #6366f1' : '2px solid transparent',
    cursor: 'pointer',
    fontFamily: FONT,
    fontSize: 11,
    fontWeight: active ? 600 : 400,
  };
}

const BODY: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: 10,
};

const BADGE: React.CSSProperties = {
  display: 'inline-block',
  padding: '1px 5px',
  borderRadius: 4,
  fontSize: 10,
  fontWeight: 600,
  marginLeft: 6,
};

// ── Component ───────────────────────────────────────────────────────────────

/**
 * Floating dev-tools panel that visualises tab-bridge state, active tabs,
 * leader info, and an event log. Supports manual state editing.
 *
 * **Tree-shakeable** — if you never import `TabSyncDevTools`, it won't
 * appear in your production bundle.
 *
 * Must be used inside a `<TabSyncProvider>`.
 *
 * @example
 * ```tsx
 * {process.env.NODE_ENV === 'development' && <TabSyncDevTools />}
 * ```
 */
export function TabSyncDevTools({
  position = 'bottom-right',
  defaultOpen = false,
}: TabSyncDevToolsProps) {
  const instance = useContext(TabSyncContext) as TabSyncInstance<
    Record<string, unknown>
  > | null;

  const [is_open, setIsOpen] = useState(defaultOpen);
  const [active_tab, setActiveTab] = useState<PanelTab>('state');

  if (!instance) return null;

  return (
    <div style={containerStyle(position)}>
      <button
        type="button"
        style={TOGGLE_BTN}
        onClick={() => setIsOpen((v) => !v)}
      >
        <span style={{ color: '#6366f1', fontWeight: 700 }}>tab-bridge</span>
        <span>{is_open ? '\u25BC' : '\u25B2'}</span>
      </button>

      {is_open && (
        <div style={PANEL}>
          <div style={TAB_BAR}>
            {(['state', 'tabs', 'log'] as const).map((t) => (
              <button
                key={t}
                type="button"
                style={tabBtnStyle(active_tab === t)}
                onClick={() => setActiveTab(t)}
              >
                {t === 'state' ? 'State' : t === 'tabs' ? 'Tabs' : 'Log'}
              </button>
            ))}
          </div>
          <div style={BODY}>
            {active_tab === 'state' && <StatePanel instance={instance} />}
            {active_tab === 'tabs' && <TabsPanel instance={instance} />}
            {active_tab === 'log' && <LogPanel instance={instance} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ── State Panel ─────────────────────────────────────────────────────────────

function StatePanel({
  instance,
}: {
  instance: TabSyncInstance<Record<string, unknown>>;
}) {
  const [state, setState] = useState(() => instance.getAll());
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    return instance.onChange((s) => setState(s));
  }, [instance]);

  const startEdit = useCallback(() => {
    setDraft(JSON.stringify(state, null, 2));
    setError('');
    setEditing(true);
  }, [state]);

  const applyEdit = useCallback(() => {
    try {
      const parsed = JSON.parse(draft) as Record<string, unknown>;
      instance.patch(parsed);
      setEditing(false);
      setError('');
    } catch (e) {
      setError(String((e as Error).message));
    }
  }, [draft, instance]);

  if (editing) {
    return (
      <div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          style={{
            width: '100%',
            minHeight: 180,
            background: '#09090b',
            color: '#e4e4e7',
            border: '1px solid #3f3f46',
            borderRadius: 4,
            fontFamily: FONT,
            fontSize: 11,
            padding: 6,
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
        {error && (
          <div style={{ color: '#ef4444', fontSize: 11, marginTop: 4 }}>
            {error}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <button
            type="button"
            onClick={applyEdit}
            style={{
              ...TOGGLE_BTN,
              background: '#6366f1',
              color: '#fff',
              border: 'none',
              margin: 0,
            }}
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            style={{ ...TOGGLE_BTN, margin: 0 }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <pre
        style={{
          margin: 0,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          fontSize: 11,
          color: '#a5f3fc',
        }}
      >
        {JSON.stringify(state, null, 2)}
      </pre>
      <button
        type="button"
        onClick={startEdit}
        style={{ ...TOGGLE_BTN, marginTop: 8, margin: 0 }}
      >
        Edit State
      </button>
    </div>
  );
}

// ── Tabs Panel ──────────────────────────────────────────────────────────────

function TabsPanel({
  instance,
}: {
  instance: TabSyncInstance<Record<string, unknown>>;
}) {
  const [tabs, setTabs] = useState<TabInfo[]>(() => instance.getTabs());

  useEffect(() => {
    return instance.onTabChange((t) => setTabs(t));
  }, [instance]);

  return (
    <div>
      <div style={{ color: '#a1a1aa', marginBottom: 6, fontSize: 11 }}>
        {tabs.length} active tab{tabs.length !== 1 ? 's' : ''}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          style={{
            padding: '4px 6px',
            marginBottom: 4,
            background: tab.id === instance.id ? '#1e1b4b' : '#27272a',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 4,
          }}
        >
          <span
            style={{
              fontFamily: FONT,
              fontSize: 11,
              color: '#e4e4e7',
              wordBreak: 'break-all',
            }}
          >
            {tab.id.slice(0, 8)}
          </span>
          {tab.id === instance.id && (
            <span style={{ ...BADGE, background: '#6366f1', color: '#fff' }}>
              you
            </span>
          )}
          {tab.isLeader && (
            <span style={{ ...BADGE, background: '#f59e0b', color: '#000' }}>
              leader
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Log Panel ───────────────────────────────────────────────────────────────

const MAX_LOG = 200;
let next_log_id = 0;

function LogPanel({
  instance,
}: {
  instance: TabSyncInstance<Record<string, unknown>>;
}) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const bottom_ref = useRef<HTMLDivElement>(null);

  const push = useCallback((kind: LogEntry['kind'], detail: string) => {
    setEntries((prev) => {
      const entry: LogEntry = {
        id: ++next_log_id,
        time: Date.now(),
        kind,
        detail,
      };
      const next = [...prev, entry];
      return next.length > MAX_LOG ? next.slice(-MAX_LOG) : next;
    });
  }, []);

  useEffect(() => {
    const unsub_state = instance.onChange(
      (_state: Readonly<Record<string, unknown>>, keys: (string | number | symbol)[], meta: ChangeMeta) => {
        const src = meta.isLocal ? 'local' : `remote(${meta.sourceTabId.slice(0, 8)})`;
        push('state', `${String(keys.join(', '))} [${src}]`);
      },
    );
    const unsub_tabs = instance.onTabChange((tabs: TabInfo[]) => {
      push('tab', `${tabs.length} tabs`);
    });
    return () => {
      unsub_state();
      unsub_tabs();
    };
  }, [instance, push]);

  useEffect(() => {
    bottom_ref.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  const kind_color: Record<LogEntry['kind'], string> = {
    state: '#a5f3fc',
    tab: '#86efac',
    leader: '#fde68a',
  };

  return (
    <div style={{ maxHeight: 300, overflow: 'auto' }}>
      {entries.length === 0 && (
        <div style={{ color: '#71717a', fontSize: 11 }}>
          Waiting for events...
        </div>
      )}
      {entries.map((e) => (
        <div
          key={e.id}
          style={{ fontSize: 11, marginBottom: 2, display: 'flex', gap: 6 }}
        >
          <span style={{ color: '#71717a', flexShrink: 0 }}>
            {new Date(e.time).toLocaleTimeString()}
          </span>
          <span
            style={{
              color: kind_color[e.kind],
              fontWeight: 600,
              flexShrink: 0,
              width: 38,
            }}
          >
            {e.kind}
          </span>
          <span style={{ color: '#d4d4d8', wordBreak: 'break-all' }}>
            {e.detail}
          </span>
        </div>
      ))}
      <div ref={bottom_ref} />
    </div>
  );
}
