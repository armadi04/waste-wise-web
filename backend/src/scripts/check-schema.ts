import { DataSource, getMetadataArgsStorage } from 'typeorm';
import { runScript } from './lib/script-runner';

const MIGRATIONS_TABLE = 'migrations';
const TABLE_NAME_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*$/;
const COLUMN_NAME_PATTERN = /^[a-z][A-Za-z0-9]*$/;

const JUNCTION_TABLES = [
  {
    table: 'user_roles',
    primaryKey: ['userId', 'roleId'],
    foreignKeys: [
      ['userId', 'users', 'id'],
      ['roleId', 'roles', 'id'],
    ],
    supportingIndexes: [['roleId']],
  },
  {
    table: 'user_permissions',
    primaryKey: ['userId', 'permissionId'],
    foreignKeys: [
      ['userId', 'users', 'id'],
      ['permissionId', 'permissions', 'id'],
    ],
    supportingIndexes: [['permissionId']],
  },
  {
    table: 'role_permissions',
    primaryKey: ['roleId', 'permissionId'],
    foreignKeys: [
      ['roleId', 'roles', 'id'],
      ['permissionId', 'permissions', 'id'],
    ],
    supportingIndexes: [['permissionId']],
  },
] as const;

type SchemaColumn = {
  table_name: string;
  column_name: string;
};

type SchemaIndex = {
  table_name: string;
  index_name: string;
  is_primary: boolean;
  columns: string[];
};

type SchemaIndexRow = {
  table_name: string;
  index_name: string;
  is_primary: boolean;
  column_name: string;
  column_position: number;
};

type SchemaForeignKey = {
  table_name: string;
  column_name: string;
  foreign_table: string;
  foreign_column: string;
};

const schemaKey = (table: string, columns: ReadonlyArray<string>) =>
  `${table}:${columns.join(',')}`;

function formatList(values: Iterable<string>): string {
  return [...values].sort().join(', ');
}

void runScript(
  async (app) => {
    const dataSource = app.get(DataSource);
    const entityMetadatas = dataSource.entityMetadatas.filter(
      (metadata) => metadata.tableName !== MIGRATIONS_TABLE,
    );
    const errors: Array<string> = [];

    const metadataTables = new Map<string, Set<string>>();
    for (const metadata of entityMetadatas) {
      if (!TABLE_NAME_PATTERN.test(metadata.tableName)) {
        errors.push(
          `Table "${metadata.tableName}" is not snake_case-compatible`,
        );
      }

      const columns = new Set<string>();
      for (const column of metadata.columns) {
        columns.add(column.databaseName);
        if (!COLUMN_NAME_PATTERN.test(column.databaseName)) {
          errors.push(
            `Column "${metadata.tableName}.${column.databaseName}" is not camelCase-compatible`,
          );
        }
      }
      metadataTables.set(metadata.tableName, columns);
    }

    const columnDecorators = getMetadataArgsStorage().columns;
    for (const column of columnDecorators) {
      if (!column.options?.name) {
        errors.push(
          `Column decorator "${String(column.target)}.${column.propertyName}" must set an explicit name`,
        );
      }
    }

    const databaseColumns = await dataSource.query<Array<SchemaColumn>>(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
       ORDER BY table_name, ordinal_position`,
    );
    const databaseTables = new Map<string, Set<string>>();
    for (const column of databaseColumns) {
      if (column.table_name === MIGRATIONS_TABLE) continue;
      const columns =
        databaseTables.get(column.table_name) ?? new Set<string>();
      columns.add(column.column_name);
      databaseTables.set(column.table_name, columns);
    }
    const databaseColumnCount = [...databaseTables.values()].reduce(
      (total, columns) => total + columns.size,
      0,
    );

    const metadataTableNames = new Set(metadataTables.keys());
    const databaseTableNames = new Set(databaseTables.keys());
    const missingTables = [...metadataTableNames].filter(
      (table) => !databaseTableNames.has(table),
    );
    const extraTables = [...databaseTableNames].filter(
      (table) => !metadataTableNames.has(table),
    );
    if (missingTables.length) {
      errors.push(`Missing database tables: ${formatList(missingTables)}`);
    }
    if (extraTables.length) {
      errors.push(`Extra database tables: ${formatList(extraTables)}`);
    }

    for (const [table, expectedColumns] of metadataTables) {
      const actualColumns = databaseTables.get(table) ?? new Set<string>();
      const missingColumns = [...expectedColumns].filter(
        (column) => !actualColumns.has(column),
      );
      const extraColumns = [...actualColumns].filter(
        (column) => !expectedColumns.has(column),
      );
      if (missingColumns.length) {
        errors.push(
          `Missing columns in ${table}: ${formatList(missingColumns)}`,
        );
      }
      if (extraColumns.length) {
        errors.push(`Extra columns in ${table}: ${formatList(extraColumns)}`);
      }
    }

    const junctionNames = JUNCTION_TABLES.map(({ table }) => table);
    const indexRows = await dataSource.query<Array<SchemaIndexRow>>(
      `SELECT table_class.relname AS table_name,
              index_class.relname AS index_name,
              index_data.indisprimary AS is_primary,
              attribute.attname AS column_name,
              key_position.ordinality AS column_position
       FROM pg_index index_data
       JOIN pg_class table_class ON table_class.oid = index_data.indrelid
       JOIN pg_class index_class ON index_class.oid = index_data.indexrelid
       JOIN unnest(index_data.indkey) WITH ORDINALITY AS key_position(attnum, ordinality)
         ON true
       JOIN pg_attribute attribute
         ON attribute.attrelid = table_class.oid
        AND attribute.attnum = key_position.attnum
       WHERE table_class.relnamespace = 'public'::regnamespace
         AND table_class.relname = ANY($1)
       ORDER BY table_name, index_name, column_position`,
      [junctionNames],
    );
    const indexMap = new Map<string, SchemaIndex>();
    for (const row of indexRows) {
      const key = `${row.table_name}:${row.index_name}`;
      const index = indexMap.get(key) ?? {
        table_name: row.table_name,
        index_name: row.index_name,
        is_primary: row.is_primary,
        columns: [],
      };
      index.columns[row.column_position - 1] = row.column_name;
      indexMap.set(key, index);
    }
    const indexes = [...indexMap.values()];

    const foreignKeys = await dataSource.query<Array<SchemaForeignKey>>(
      `SELECT source.table_name,
              source.column_name,
              target.table_name AS foreign_table,
              target.column_name AS foreign_column
       FROM information_schema.table_constraints constraints
       JOIN information_schema.key_column_usage source
         ON source.constraint_name = constraints.constraint_name
        AND source.table_schema = constraints.table_schema
       JOIN information_schema.constraint_column_usage target
         ON target.constraint_name = constraints.constraint_name
        AND target.table_schema = constraints.table_schema
       WHERE constraints.constraint_type = 'FOREIGN KEY'
         AND constraints.table_schema = 'public'
         AND constraints.table_name = ANY($1)`,
      [junctionNames],
    );

    for (const junction of JUNCTION_TABLES) {
      const primaryKey = indexes.some(
        (index) =>
          index.table_name === junction.table &&
          index.is_primary &&
          schemaKey(index.table_name, index.columns) ===
            schemaKey(junction.table, junction.primaryKey),
      );
      if (!primaryKey) {
        errors.push(
          `Missing composite primary key on ${junction.table}(${junction.primaryKey.join(', ')})`,
        );
      }

      for (const [
        column,
        foreignTable,
        foreignColumn,
      ] of junction.foreignKeys) {
        const foreignKey = foreignKeys.some(
          (key) =>
            key.table_name === junction.table &&
            key.column_name === column &&
            key.foreign_table === foreignTable &&
            key.foreign_column === foreignColumn,
        );
        if (!foreignKey) {
          errors.push(
            `Missing foreign key ${junction.table}.${column} -> ${foreignTable}.${foreignColumn}`,
          );
        }
      }

      for (const columns of junction.supportingIndexes) {
        const supportingIndex = indexes.some(
          (index) =>
            index.table_name === junction.table &&
            !index.is_primary &&
            schemaKey(index.table_name, index.columns) ===
              schemaKey(junction.table, columns),
        );
        if (!supportingIndex) {
          errors.push(
            `Missing supporting index on ${junction.table}(${columns.join(', ')})`,
          );
        }
      }
    }

    if (errors.length) {
      throw new Error(
        `Schema convention check failed:\n- ${errors.join('\n- ')}`,
      );
    }

    console.log(
      `Schema convention check passed: ${metadataTables.size} tables, ${databaseColumnCount} columns`,
    );
  },
  { skipMigrations: true, synchronize: false },
);
