import { PartialType } from '@nestjs/mapped-types';
import { BaseRoleDto } from './base-role.dto';

export class UpdateRoleDto extends PartialType(BaseRoleDto) {}
