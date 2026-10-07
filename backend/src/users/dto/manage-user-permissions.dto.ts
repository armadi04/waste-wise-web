import { IsArray, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class ManageUserPermissionsDto {
  @IsArray()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  permissions: number[];
}
