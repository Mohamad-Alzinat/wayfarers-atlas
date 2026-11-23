export class WebLuaBridgeAdapter {
  constructor() {
    this.worker = new Worker(new URL("./worker.js", import.meta.url));
    this.pending = new Map();
    this.id = 0;
    this.worker.onmessage = ({ data }) => {
      const promise = this.pending.get(data.id);
      if (!promise) return;
      this.pending.delete(data.id);
      data.error
        ? promise.reject(Error(data.error))
        : promise.resolve(data.result);
    };
    this.worker.onerror = (e) => {
      this.failure = e.message || "The Lua worker stopped.";
      for (const p of this.pending.values()) p.reject(Error(this.failure));
      this.pending.clear();
    };
  }
  calculate(request) {
    if (this.failure) return Promise.reject(Error(this.failure));
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, request });
    });
  }
}
