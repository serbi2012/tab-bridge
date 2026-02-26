type Handler<T = void> = T extends void ? () => void : (data: T) => void;

/**
 * Minimal, fully typed event emitter.
 *
 * ```ts
 * const bus = new Emitter<{ click: { x: number }; close: void }>();
 * bus.on('click', ({ x }) => console.log(x));
 * bus.emit('click', { x: 42 });
 * ```
 */
export class Emitter<TEvents extends Record<string, unknown>> {
  private readonly _handlers = new Map<keyof TEvents, Set<Handler<never>>>();

  on<K extends keyof TEvents>(event: K, handler: Handler<TEvents[K]>): () => void {
    let set = this._handlers.get(event);
    if (!set) {
      set = new Set();
      this._handlers.set(event, set);
    }
    set.add(handler as Handler<never>);
    return () => {
      set!.delete(handler as Handler<never>);
    };
  }

  once<K extends keyof TEvents>(event: K, handler: Handler<TEvents[K]>): () => void {
    const off = this.on(event, ((...args: unknown[]) => {
      off();
      (handler as Function)(...args);
    }) as Handler<TEvents[K]>);
    return off;
  }

  emit<K extends keyof TEvents>(
    ...args: TEvents[K] extends void ? [event: K] : [event: K, data: TEvents[K]]
  ): void {
    const [event, data] = args;
    const set = this._handlers.get(event);
    if (!set) return;
    for (const handler of set) {
      (handler as Function)(data);
    }
  }

  listenerCount<K extends keyof TEvents>(event: K): number {
    return this._handlers.get(event)?.size ?? 0;
  }

  removeAll(event?: keyof TEvents): void {
    if (event) {
      this._handlers.delete(event);
    } else {
      this._handlers.clear();
    }
  }
}
