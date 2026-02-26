import { createContext } from 'react';
import type { TabSyncInstance } from '../types';

// `any` is intentional: React Context is invariant, so a generic
// `TabSyncInstance<TState>` cannot be assigned to a concrete one.
// Consumers cast to their own state shape via hooks.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TabSyncContext = createContext<TabSyncInstance<any> | null>(null);
