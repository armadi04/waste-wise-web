import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateOAuthClientDto } from './create-oauth-client.dto';

export class UpdateOAuthClientDto extends PartialType(CreateOAuthClientDto) {
  @ApiPropertyOptional({ description: 'Enable or disable the client.' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
