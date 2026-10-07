import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MediaBulkDeleteDto {
  @ApiProperty({ type: [Number], maxItems: 100 })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(2_147_483_647, { each: true })
  @Type(() => Number)
  ids: number[];
}
export class MediaDeletionResultDto {
  @ApiProperty()
  id: number;
  @ApiProperty({ enum: ['deleted', 'queued', 'already-deleted', 'failed'] })
  status: 'deleted' | 'queued' | 'already-deleted' | 'failed';
  @ApiPropertyOptional({ enum: ['NOT_FOUND', 'DELETE_FAILED'] })
  code?: 'NOT_FOUND' | 'DELETE_FAILED';
}
export class MediaBulkDeleteResultDto {
  @ApiProperty()
  deleted: number;
  @ApiProperty()
  queued: number;
  @ApiProperty()
  failed: number;
  @ApiProperty({ type: [MediaDeletionResultDto] })
  results: MediaDeletionResultDto[];
}
