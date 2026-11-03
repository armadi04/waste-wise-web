import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { ACCOUNT_STATUS_VALUES } from '../account-status';
import type { AccountStatus } from '../account-status';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationParamsDto } from '@/common/dto/pagination-params.dto';
import { RegisterMethodEnum } from '../register-method.enum';
import type { CreatedInPreset } from '@/common/helpers/created-in-range';

export class UsersQueryDto extends PaginationParamsDto {
  @ApiPropertyOptional({ enum: ACCOUNT_STATUS_VALUES })
  @IsOptional()
  @IsIn([...ACCOUNT_STATUS_VALUES])
  accountStatus?: AccountStatus;
  @ApiPropertyOptional({
    enum: ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'],
  })
  @IsOptional()
  @IsIn(['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura'])
  timeZone?: string;

  @ApiPropertyOptional({
    enum: ['today', '7d', '1m', '3m'],
    description:
      'Creation window in the selected report timezone, default Asia/Jakarta; 1m and 3m use 30 and 90 days.',
  })
  @IsOptional()
  @IsIn(['today', '7d', '1m', '3m'])
  createdIn?: CreatedInPreset;

  @ApiPropertyOptional({
    enum: RegisterMethodEnum,
    description: 'Method used to first create the account.',
  })
  @IsOptional()
  @IsEnum(RegisterMethodEnum)
  registerMethod?: RegisterMethodEnum;
}
