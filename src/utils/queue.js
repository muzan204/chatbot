// Bounded work, ordered per conversation; slow chats do not block other chats.
export class WorkQueue {
  constructor({ concurrency = 4, limit = 200, perKey = 50, onError = () => {} } = {}) {
    this.concurrency = concurrency;
    this.limit = limit;
    this.perKey = perKey;
    this.onError = onError;
    this.jobs = [];
    this.active = new Set();
    this.counts = new Map();
    this.waiters = [];
    this.closed = false;
  }
  get size() { return this.jobs.length + this.active.size; }
  add(key, run) {
    if (this.closed || this.size >= this.limit || (this.counts.get(key) || 0) >= this.perKey) return false;
    this.counts.set(key, (this.counts.get(key) || 0) + 1);
    this.jobs.push({ key, run });
    this.pump();
    return true;
  }
  pump() {
    while (this.active.size < this.concurrency) {
      const index = this.jobs.findIndex(job => !this.active.has(job.key));
      if (index < 0) break;
      const { key, run } = this.jobs.splice(index, 1)[0];
      this.active.add(key);
      Promise.resolve().then(run).catch(this.onError).finally(() => {
        this.active.delete(key);
        const left = this.counts.get(key) - 1;
        if (left) this.counts.set(key, left); else this.counts.delete(key);
        this.pump();
      });
    }
    if (!this.size) for (const resolve of this.waiters.splice(0)) resolve();
  }
  idle() { return this.size ? new Promise(resolve => this.waiters.push(resolve)) : Promise.resolve(); }
  close() { this.closed = true; return this.idle(); }
}

// Session events must never be discarded because a command queue is full.
export class SerialQueue {
  constructor(onError = () => {}) { this.pending = Promise.resolve(); this.onError = onError; }
  add(run) { this.pending = this.pending.then(run).catch(this.onError); return this.pending; }
  async idle() {
    let pending;
    do { pending = this.pending; await pending; } while (pending !== this.pending);
  }
}
