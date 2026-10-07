import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsNumber } from 'class-validator';

export class BulkDeleteDto {
  @ApiProperty({ type: [Number], description: 'IDs of the rows to delete' })
  @IsArray()
  @ArrayNotEmpty()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  ids: number[];
}
