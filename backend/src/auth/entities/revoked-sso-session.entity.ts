import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

// Append-only log of OIDC session ids (`sid`) revoked via back-channel logout.
// JwtStrategy rejects any token carrying a revoked sid, ending the session
// app-wide even though our own sessions are otherwise stateless JWTs.
@Entity('revoked_sso_sessions')
export class RevokedSsoSession {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Column({ name: 'sid', unique: true })
  sid: string;

  @Column({ name: 'sub', type: 'varchar', nullable: true })
  sub: string | null;

  @CreateDateColumn({ name: 'revokedAt', type: 'timestamptz', precision: 3 })
  revokedAt: Date;
}
