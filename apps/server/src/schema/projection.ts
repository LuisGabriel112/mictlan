interface ViewCollection<View> {
  get(id: string): View | undefined;
  set(id: string, view: View): unknown;
  keys(): IterableIterator<string>;
  delete(id: string): unknown;
}

export function syncFields<View extends object>(view: View, fields: Partial<View>): void {
  for (const key of Object.keys(fields) as (keyof View)[]) {
    if (view[key] !== fields[key]) view[key] = fields[key]!;
  }
}

export function syncCollection<Source extends { id: string }, View>(
  collection: ViewCollection<View>, sources: readonly Source[],
  create: () => View, synchronize: (view: View, source: Source) => void,
): void {
  const retained = new Set(sources.map(({ id }) => id));
  for (const source of sources) {
    const existing = collection.get(source.id);
    const view = existing ?? create();
    synchronize(view, source);
    if (existing === undefined) collection.set(source.id, view);
  }
  for (const id of collection.keys()) {
    if (!retained.has(id)) collection.delete(id);
  }
}
