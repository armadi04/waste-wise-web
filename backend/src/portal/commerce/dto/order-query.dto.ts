import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class OrderQueryDto {
  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: 100000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;

  @ApiPropertyOptional({
    enum: ['all', 'Pending', 'Paid', 'Cancelled', 'Refunded'],
  })
  @IsOptional()
  @IsIn(['all', 'Pending', 'Paid', 'Cancelled', 'Refunded'])
  filter: 'all' | 'Pending' | 'Paid' | 'Cancelled' | 'Refunded' = 'all';
}
