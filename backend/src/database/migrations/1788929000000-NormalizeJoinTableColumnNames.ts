import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeJoinTableColumnNames1788929000000 implements MigrationInterface {
  name = 'NormalizeJoinTableColumnNames1788929000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_roles" RENAME COLUMN "user_id" TO "userId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" RENAME COLUMN "role_id" TO "roleId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_permissions" RENAME COLUMN "user_id" TO "userId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_permissions" RENAME COLUMN "permission_id" TO "permissionId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permissions" RENAME COLUMN "role_id" TO "roleId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permissions" RENAME COLUMN "permission_id" TO "permissionId"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "role_permissions" RENAME COLUMN "permissionId" TO "permission_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permissions" RENAME COLUMN "roleId" TO "role_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_permissions" RENAME COLUMN "permissionId" TO "permission_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_permissions" RENAME COLUMN "userId" TO "user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" RENAME COLUMN "roleId" TO "role_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_roles" RENAME COLUMN "userId" TO "user_id"`,
    );
  }
}
