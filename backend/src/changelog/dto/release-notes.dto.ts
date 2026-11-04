import { ApiProperty } from '@nestjs/swagger';
import type { ReleaseNotes } from '../changelog.service';

export class ReleaseNotesDto implements ReleaseNotes {
  @ApiProperty({ example: '1.4.0' })
  version: string;

  @ApiProperty({ description: 'Release body in Markdown' })
  notes: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  publishedAt: string | null;

  @ApiProperty({ description: 'Release page URL' })
  url: string;
}
