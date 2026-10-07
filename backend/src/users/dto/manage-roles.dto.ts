import { IsArray, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class ManageRolesDto {
  @IsArray()
  @IsNumber({}, { each: true })
  @Type(() => Number)
  roles: number[];
}
