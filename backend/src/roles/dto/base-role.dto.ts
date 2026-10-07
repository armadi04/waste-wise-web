import { IsString, IsOptional, IsArray, IsNumber } from 'class-validator';

export class BaseRoleDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsArray()
  @IsNumber({}, { each: true })
  @IsOptional()
  permissions?: number[];
}
