/** Read every page without relying on the server's configurable row cap.
 * Callers must apply authorization filters and a deterministic unique order.
 * Errors abort the response, never masquerade as a complete history. */
export async function readAllHistoryRows<T>(query: {
  range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
}): Promise<T[]> {
  const rows: T[] = []
  for (;;) {
    const { data, error } = await query.range(rows.length, rows.length + 499)
    if (error) throw error
    if (!data?.length) return rows
    rows.push(...data)
  }
}

/** Bound IN-filter URLs and paginate the children too (fills/ledger can exceed
 * the row cap even for a small batch of orders). */
export async function readHistoryByIds<T>(ids: string[], query: (batch: string[]) => {
  range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
}): Promise<{ data: T[]; error: null }> {
  const data: T[] = []
  for (let index = 0; index < ids.length; index += 100) {
    data.push(...await readAllHistoryRows(query(ids.slice(index, index + 100))))
  }
  return { data, error: null }
}
