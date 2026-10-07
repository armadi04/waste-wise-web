import { type MigrationInterface, type QueryRunner } from 'typeorm';
export class CommerceEventReceipts1791103000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['audit_logs', 'notifications']) {
      await queryRunner.query(`ALTER TABLE "${table}" ADD "eventId" varchar`);
      await queryRunner.query(
        `CREATE UNIQUE INDEX "UQ_${table}_commerce_event" ON "${table}" ("eventId")`,
      );
    }
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['audit_logs', 'notifications']) {
      await queryRunner.query(`DROP INDEX "UQ_${table}_commerce_event"`);
      await queryRunner.query(`ALTER TABLE "${table}" DROP "eventId"`);
    }
  }
}
