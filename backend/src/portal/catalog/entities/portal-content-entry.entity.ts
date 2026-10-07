import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface PortalContentSection {
  id: string;
  heading: string;
  body: string;
}

/**
 * Editable portal copy (legal pages, home blocks, help contact, status notice).
 * Allowed keys and the shape of `data` are fixed by the content registry.
 * Sections are plain text; the portal renders them without HTML.
 */
@Entity('portal_content_entries')
export class PortalContentEntry {
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;

  @Index('IDX_portal_content_entries_key', { unique: true })
  @Column({ name: 'key', type: 'varchar', length: 80 })
  key: string;

  @Column({ name: 'title', type: 'varchar', length: 180 })
  title: string;

  @Column({ name: 'summary', type: 'varchar', length: 500, default: '' })
  summary: string;

  @Column({ name: 'sections', type: 'jsonb', default: () => "'[]'" })
  sections: PortalContentSection[];

  @Column({ name: 'data', type: 'jsonb', default: () => "'{}'" })
  data: Record<string, unknown>;

  @Column({ name: 'published', type: 'boolean', default: false })
  published: boolean;

  @Column({ name: 'updatedById', type: 'int', nullable: true })
  updatedById: number | null;

  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz', precision: 3 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamptz', precision: 3 })
  updatedAt: Date;
}
