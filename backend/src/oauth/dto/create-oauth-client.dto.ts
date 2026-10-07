import { IsArray, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOAuthClientDto {
  @ApiProperty({ description: 'Human-readable name for the client.' })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({
    type: [String],
    description: 'Permission scopes this client may request.',
  })
  @IsArray()
  @IsString({ each: true })
  scopes: string[];
}
