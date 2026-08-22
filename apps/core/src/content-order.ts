import { queryAll, run, type FoliyoDb } from "./db.js";

/** Preserve an explicit ID list when hydrating library rows. */
export function orderRowsByIds<T extends { id: unknown }>(
  rows: T[],
  ids: string[],
): T[] {
  if (!ids.length) return [];
  const byId = new Map(rows.map((row) => [String(row.id), row]));
  return ids.map((id) => byId.get(id)).filter((row): row is T => row != null);
}

/** Sort library IDs by each row's sort_order (stable tie-break on id). */
export async function sortIdsByLibraryOrder(
  db: FoliyoDb,
  table: string,
  ids: string[],
): Promise<string[]> {
  if (ids.length <= 1) return ids;
  const rows = await queryAll<{ id: string; sort_order: number }>(
    db,
    `SELECT id, sort_order FROM ${table} WHERE id IN (${ids.map(() => "?").join(",")}) AND deleted_at IS NULL`,
    ids,
  );
  rows.sort(
    (a, b) => a.sort_order - b.sort_order || String(a.id).localeCompare(String(b.id)),
  );
  const ordered = rows.map((row) => row.id);
  for (const id of ids) {
    if (!ordered.includes(id)) ordered.push(id);
  }
  return ordered;
}

export async function fetchRowsInIdOrder(
  db: FoliyoDb,
  table: string,
  ids: string[],
): Promise<Record<string, unknown>[]> {
  if (!ids.length) return [];
  const rows = await queryAll<Record<string, unknown>>(
    db,
    `SELECT * FROM ${table} WHERE id IN (${ids.map(() => "?").join(",")}) AND deleted_at IS NULL`,
    ids,
  );
  return orderRowsByIds(rows, ids);
}

type JunctionFetch = {
  junctionTable: string;
  parentColumn: string;
  parentId: string;
  itemColumn: string;
  libraryTable: string;
  /** portfolio/resume junction tables for projects, experience, education. */
  junctionSort: boolean;
};

/** Load selected library rows in library list order. */
export async function fetchJunctionLibraryRows(
  db: FoliyoDb,
  spec: JunctionFetch,
): Promise<Record<string, unknown>[]> {
  const libraryAlias = "lib";
  const junctionAlias = "j";
  const orderBy = `${libraryAlias}.sort_order, ${libraryAlias}.id`;

  return queryAll<Record<string, unknown>>(
    db,
    `SELECT ${libraryAlias}.* FROM ${spec.libraryTable} ${libraryAlias}
     INNER JOIN ${spec.junctionTable} ${junctionAlias}
       ON ${junctionAlias}.${spec.itemColumn} = ${libraryAlias}.id
     WHERE ${junctionAlias}.${spec.parentColumn} = ?
       AND ${libraryAlias}.deleted_at IS NULL
     ORDER BY ${orderBy}`,
    [spec.parentId],
  );
}

const ORDERED_LIBRARY_TABLES = [
  {
    libraryTable: "projects",
    portfolioJunction: "portfolio_projects",
    resumeJunction: "resume_projects",
    itemColumn: "project_id",
  },
  {
    libraryTable: "experience",
    portfolioJunction: "portfolio_experience",
    resumeJunction: "resume_experience",
    itemColumn: "experience_id",
  },
  {
    libraryTable: "education",
    portfolioJunction: "portfolio_education",
    resumeJunction: "resume_education",
    itemColumn: "education_id",
  },
] as const;

/** After library reorder, keep folio/resume junction order in sync. */
export async function syncJunctionSortFromLibrary(
  db: FoliyoDb,
  libraryTable: (typeof ORDERED_LIBRARY_TABLES)[number]["libraryTable"],
): Promise<void> {
  const spec = ORDERED_LIBRARY_TABLES.find((entry) => entry.libraryTable === libraryTable);
  if (!spec) return;

  for (const junctionTable of [spec.portfolioJunction, spec.resumeJunction]) {
    await run(
      db,
      `UPDATE ${junctionTable}
       SET sort_order = COALESCE(
         (SELECT sort_order FROM ${spec.libraryTable} WHERE id = ${junctionTable}.${spec.itemColumn}),
         0
       )`,
    );
  }
}

export async function orderedJunctionIds(
  db: FoliyoDb,
  junctionTable: string,
  parentColumn: string,
  parentId: string,
  itemColumn: string,
  libraryTable: string,
  _junctionSort = false,
): Promise<string[]> {
  const rows = await queryAll<Record<string, string>>(
    db,
    `SELECT ${itemColumn} AS id FROM ${junctionTable} WHERE ${parentColumn} = ?`,
    [parentId],
  );
  return sortIdsByLibraryOrder(
    db,
    libraryTable,
    rows.map((row) => row.id),
  );
}
