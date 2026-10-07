import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SwitchRoleDto {
  @ApiProperty({
    description: 'Name of the role to act as',
    example: 'admin',
  })
  @IsString()
  @IsNotEmpty()
  role: string;
}
