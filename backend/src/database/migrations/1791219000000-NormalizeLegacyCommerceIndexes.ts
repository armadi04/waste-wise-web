import type { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

const INDEXES = [
  {
    table: 'portal_bookings',
    columns: ['userId', 'slotId'],
    legacy: 'IDX_portal_bookings_user_slot',
    generated: 'IDX_b05ede3628ea44537636d75ef7',
    partial: 'UQ_portal_bookings_user_slot',
  },
  {
    table: 'portal_reviews',
    columns: ['userId', 'targetType', 'targetKey'],
    legacy: 'IDX_portal_reviews_user_target',
    generated: 'IDX_cd50e691ec9059e1c3e2d9b0e0',
    partial: 'UQ_portal_reviews_user_target',
  },
  {
    table: 'portal_booking_slots',
    columns: ['eventId', 'startsAt'],
    legacy: 'IDX_portal_booking_slots_event_startsAt',
    generated: 'IDX_f5b0c2c6953556480d4b00e78a',
    partial: 'UQ_portal_booking_slots_event_start',
  },
];

/**
 * Runs before the immutable partial-unique migration: historical migrations use
 * explicit index names, while schema sync used TypeORM-generated names.
 * Already-upgraded databases keep their partial indexes and only lose redundant
 * legacy global indexes, which would otherwise block deleted-key reuse.
 */
export class NormalizeLegacyCommerceIndexes1791219000000 implements MigrationInterface {
  name = 'NormalizeLegacyCommerceIndexes1791219000000';

  private validate(index: TableIndex, columns: string[], partial = false) {
    const predicate = index.where?.replace(/["()\s]/g, '').toLowerCase();
    if (
      !index.isUnique ||
      [...index.columnNames].sort().join(',') !==
        [...columns].sort().join(',') ||
      (partial ? predicate !== 'deletedatisnull' : Boolean(index.where))
    ) {
      throw new Error(`Unexpected definition for commerce index ${index.name}`);
    }
  }

  async up(queryRunner: QueryRunner): Promise<void> {
    const schema = await queryRunner.getCurrentSchema();
    if (!schema) throw new Error('Cannot resolve the active commerce schema');
    for (const item of INDEXES) {
      const table = await queryRunner.getTable(`${schema}.${item.table}`);
      if (!table) throw new Error(`Missing commerce table ${item.table}`);
      const legacy = table.indices.find((index) => index.name === item.legacy);
      const generated = table.indices.find(
        (index) => index.name === item.generated,
      );
      const partial = table.indices.find(
        (index) => index.name === item.partial,
      );
      if (legacy) this.validate(legacy, item.columns);
      if (generated) this.validate(generated, item.columns);
      if (partial) {
        this.validate(partial, item.columns, true);
        for (const index of [legacy, generated]) {
          if (index) await queryRunner.query(`DROP INDEX "${index.name}"`);
        }
        continue;
      }
      if (generated) {
        if (legacy) await queryRunner.query(`DROP INDEX "${item.legacy}"`);
      } else if (legacy) {
        await queryRunner.query(
          `ALTER INDEX "${item.legacy}" RENAME TO "${item.generated}"`,
        );
      } else {
        throw new Error(`Missing legacy unique index on ${item.table}`);
      }
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const schema = await queryRunner.getCurrentSchema();
    if (!schema) throw new Error('Cannot resolve the active commerce schema');
    for (const item of INDEXES) {
      const table = await queryRunner.getTable(`${schema}.${item.table}`);
      if (!table) throw new Error(`Missing commerce table ${item.table}`);
      // On an existing deployment this compatibility migration is applied last;
      // reverting it must not change the already-active partial uniqueness rule.
      if (table.indices.some((index) => index.name === item.partial)) continue;
      const generated = table.indices.find(
        (index) => index.name === item.generated,
      );
      if (
        generated &&
        !table.indices.some((index) => index.name === item.legacy)
      ) {
        this.validate(generated, item.columns);
        await queryRunner.query(
          `ALTER INDEX "${item.generated}" RENAME TO "${item.legacy}"`,
        );
      }
    }
  }
}
