import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Manual admin wallet adjustments are deduplicated by a caller-supplied key. */
export class AddWalletAdjustmentOperationKey1791170000000 implements MigrationInterface {
  name = 'AddWalletAdjustmentOperationKey1791170000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "portal_wallet_transactions" ADD "operationKey" character varying(120)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_portal_wallet_transactions_operation_key" ON "portal_wallet_transactions" ("operationKey")`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_portal_wallet_transactions_operation_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "portal_wallet_transactions" DROP COLUMN "operationKey"`,
    );
  }
}
