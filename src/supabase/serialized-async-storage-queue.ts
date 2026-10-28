/** Test helper: serializes AsyncStorage operations in invocation order. */
export function createSerializedAsyncStorageQueue(backend: {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}) {
  let chain: Promise<void> = Promise.resolve();

  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = chain.then(operation);
    chain = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  return {
    getItem: (key: string) => enqueue(() => backend.getItem(key)),
    setItem: (key: string, value: string) => enqueue(() => backend.setItem(key, value)),
    removeItem: (key: string) => enqueue(() => backend.removeItem(key)),
  };
}
