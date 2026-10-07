import { ObjectLiteral, FindOptionsRelations } from 'typeorm';

/**
 * Converts dot-separated relation paths into the nested object form TypeORM
 * expects. TypeORM 1.x dropped the `relations: string[]` shorthand — it now
 * reads the option with `Object.keys()`, so an array silently resolves to the
 * numeric indexes instead of the relation names.
 *
 * `['roles', 'roles.permissions']` becomes `{ roles: { permissions: true } }`.
 */
export function toFindOptionsRelations<T extends ObjectLiteral>(
  paths: string[] = [],
): FindOptionsRelations<T> {
  const relations: Record<string, unknown> = {};

  for (const path of paths) {
    let level = relations;

    path.split('.').forEach((segment, index, segments) => {
      const isLeaf = index === segments.length - 1;

      if (isLeaf) {
        // A parent already expanded into an object keeps its nested children.
        level[segment] ??= true;
        return;
      }

      if (level[segment] === true || level[segment] === undefined) {
        level[segment] = {};
      }
      level = level[segment] as Record<string, unknown>;
    });
  }

  return relations as FindOptionsRelations<T>;
}
