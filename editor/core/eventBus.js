// eventBus.js — minimal publish/subscribe.
export class EventBus {
    constructor() {
        this.handlers = new Map();
    }
    on(name, fn) {
        if (!this.handlers.has(name)) this.handlers.set(name, new Set());
        this.handlers.get(name).add(fn);
        return () => this.off(name, fn);
    }
    off(name, fn) {
        const set = this.handlers.get(name);
        if (set) set.delete(fn);
    }
    emit(name, ...args) {
        const set = this.handlers.get(name);
        if (set) for (const fn of [...set]) fn(...args);
    }
}
