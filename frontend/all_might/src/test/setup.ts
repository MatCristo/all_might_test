/* jsdom hands vitest a `localStorage` that carries none of the Storage methods,
   so any component that remembers something between sessions — the collapsed
   sidebar, dark mode — throws the moment it mounts. A real, in-memory Storage
   costs twelve lines and is closer to a browser than the stub it replaces. */
class MemoryStorage implements Storage {
    private entries = new Map<string, string>();

    get length() { return this.entries.size; }
    key(index: number) { return [...this.entries.keys()][index] ?? null; }
    getItem(key: string) { return this.entries.get(key) ?? null; }
    setItem(key: string, value: string) { this.entries.set(key, String(value)); }
    removeItem(key: string) { this.entries.delete(key); }
    clear() { this.entries.clear(); }
}

for (const name of ['localStorage', 'sessionStorage'] as const) {
    Object.defineProperty(window, name, { value: new MemoryStorage(), writable: true });
    Object.defineProperty(globalThis, name, { value: window[name], writable: true });
}

/* react-pro-sidebar measures the rail, and jsdom has no layout to measure with.
   A no-op observer is enough: nothing here asserts on a size. */
if (!('ResizeObserver' in globalThis)) {
    class NoopResizeObserver implements ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
    }

    Object.defineProperty(globalThis, 'ResizeObserver', { value: NoopResizeObserver, writable: true });
}
