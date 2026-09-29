/**
 * DataTable — §11.3. Sortable, filterable, paginated.
 *
 * Pagination is always on, even on small demo sets: a 500-bed hospital roster
 * is not a client-side-filter-safe size, and a table that only works at demo
 * scale teaches the wrong pattern to whoever wires the real endpoint.
 */
import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from "./icons";
import { EmptyState, SearchInput, cx } from "./primitives";

export type Column<T> = {
  key: string;
  header: ReactNode;
  /** Cell renderer. */
  render: (row: T) => ReactNode;
  /** Sort key extractor. Omit to make the column unsortable. */
  sortBy?: (row: T) => string | number;
  width?: string;
  align?: "left" | "right";
  /** Hidden below 900px — use for secondary metadata. */
  secondary?: boolean;
};

export function DataTable<T>({
  rows, columns, getRowId, searchable, searchPlaceholder, searchFields, pageSize = 12,
  onRowClick, empty, toolbar, dense, caption,
}: {
  rows: T[];
  columns: Column<T>[];
  getRowId: (row: T) => string;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchFields?: (row: T) => string;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  empty?: { title: string; message: string; action?: ReactNode; icon?: ReactNode };
  toolbar?: ReactNode;
  dense?: boolean;
  caption?: string;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!q.trim() || !searchFields) return rows;
    const needle = q.toLowerCase();
    return rows.filter((r) => searchFields(r).toLowerCase().includes(needle));
  }, [rows, q, searchFields]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortBy) return filtered;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = col.sortBy!(a);
      const bv = col.sortBy!(b);
      if (av === bv) return 0;
      return (av > bv ? 1 : -1) * dir;
    });
  }, [filtered, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const slice = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);

  function toggleSort(key: string) {
    setPage(0);
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      {(searchable || toolbar) && (
        <div className="table-toolbar">
          {searchable && (
            <SearchInput
              value={q}
              onChange={(v) => { setQ(v); setPage(0); }}
              placeholder={searchPlaceholder ?? "Search"}
            />
          )}
          {toolbar}
        </div>
      )}

      {sorted.length === 0 ? (
        <EmptyState
          icon={empty?.icon}
          title={empty?.title ?? "Nothing to show"}
          message={empty?.message ?? (q ? `No rows match “${q}”.` : "There is no data for this view yet.")}
          action={empty?.action}
        />
      ) : (
        <div className="scroll-x">
          <table className={cx("data-table", dense && "is-dense")}>
            {caption && <caption className="visually-hidden">{caption}</caption>}
            <thead>
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    style={{ width: c.width, textAlign: c.align ?? "left" }}
                    className={cx(c.secondary && "col-secondary")}
                    aria-sort={sort?.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                  >
                    {c.sortBy ? (
                      <button type="button" className="th-sort" onClick={() => toggleSort(c.key)}>
                        {c.header}
                        {sort?.key === c.key
                          ? (sort.dir === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)
                          : <span className="th-sort-hint">↕</span>}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {slice.map((row) => (
                <tr
                  key={getRowId(row)}
                  className={cx(onRowClick && "is-clickable")}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={onRowClick ? (e) => { if (e.key === "Enter") onRowClick(row); } : undefined}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      style={{ textAlign: c.align ?? "left" }}
                      className={cx(c.secondary && "col-secondary")}
                    >
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sorted.length > pageSize && (
        <div className="table-pager">
          <span className="muted tnum" style={{ fontSize: 12.5 }}>
            {safePage * pageSize + 1}–{Math.min(sorted.length, (safePage + 1) * pageSize)} of {sorted.length}
          </span>
          <div className="row" style={{ gap: 6 }}>
            <button type="button" className="icon-btn" disabled={safePage === 0} onClick={() => setPage(safePage - 1)} aria-label="Previous page">
              <ChevronLeft size={15} />
            </button>
            <span className="tnum" style={{ fontSize: 12.5, minWidth: 54, textAlign: "center" }}>
              {safePage + 1} / {pageCount}
            </span>
            <button type="button" className="icon-btn" disabled={safePage >= pageCount - 1} onClick={() => setPage(safePage + 1)} aria-label="Next page">
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
