import { IsArray, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class ManagePermissionsDto {
  @IsArray()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  permissions: number[];
}
