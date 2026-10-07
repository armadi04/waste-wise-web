import { IsUnique } from '../../common/validators/is-unique.validator';
import { Role } from '../entities/role.entity';
import { BaseRoleDto } from './base-role.dto';

export class CreateRoleDto extends BaseRoleDto {
  @IsUnique(Role)
  declare name: string;
}
