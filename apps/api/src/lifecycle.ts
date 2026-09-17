export type ShutdownDependencies = {
  drain: () => Promise<unknown>;
  force: () => Promise<unknown>;
  closeDatabase: () => Promise<unknown>;
  graceMs?: number;
};
export function createShutdown(dependencies: ShutdownDependencies): () => Promise<void> {
  let stopping: Promise<void> | undefined;
  return () => {
    stopping ??= (async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          dependencies.drain(),
          new Promise<void>((resolve, reject) => {
            timer = setTimeout(() => {
              dependencies.force().then(() => resolve(), reject);
            }, dependencies.graceMs ?? 10_000);
          }),
        ]);
      } finally {
        clearTimeout(timer);
        await dependencies.closeDatabase();
      }
    })();
    return stopping;
  };
}
