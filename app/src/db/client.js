// Module worker: the new URL(...) pattern lets Vite bundle the worker + its WASM.
const worker = new Worker(new URL('./worker.js', import.meta.url), {
  type: 'module',
});

let nextId = 1;
const pending = new Map();

worker.onmessage = (event) => {
  const { id, rows, error } = event.data;
  const resolver = pending.get(id);
  if (!resolver) return;
  pending.delete(id);
  if (error) resolver.reject(new Error(error));
  else resolver.resolve(rows);
};

// Run SQL in the worker; resolves with an array of row objects.
export function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, sql, params });
  });
}