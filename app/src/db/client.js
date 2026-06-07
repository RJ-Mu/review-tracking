const worker = new Worker(new URL('./worker.js', import.meta.url), {
  type: 'module',
});

let nextId = 1;
const pending = new Map();

worker.onmessage = (event) => {
  const { id, rows, changes, error } = event.data;
  const resolver = pending.get(id);
  if (!resolver) return;
  pending.delete(id);
  if (error) resolver.reject(new Error(error));
  else resolver.resolve({ rows, changes });
};

function send(sql, params = []) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, sql, params });
  });
}

// Returns an array of row objects (use for SELECT and INSERT ... RETURNING).
export async function query(sql, params = []) {
  return (await send(sql, params)).rows;
}

// Returns the number of rows changed (use for UPDATE / DELETE).
export async function execute(sql, params = []) {
  return (await send(sql, params)).changes;
}