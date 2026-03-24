export async function fetchAll<T>(
  // Supabase PostgREST query builders are Promise-like; keep typing permissive.
  queryFactory: (from: number, to: number) => Promise<{ data: T[] | null; error: any }> | any,
  pageSize: number = 1000
): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await queryFactory(from, to);
    if (error) throw error;
    const page: T[] = (data ?? []) as T[];
    out.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

