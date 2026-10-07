import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Body of `POST /oauth/token`. Only the `client_credentials` grant is supported.
 */
export class TokenRequestDto {
  @ApiProperty({ enum: ['client_credentials'] })
  @IsIn(['client_credentials'])
  grant_type: 'client_credentials';

  @ApiProperty()
  @IsString()
  client_id: string;

  @ApiProperty()
  @IsString()
  client_secret: string;

  @ApiPropertyOptional({
    description: "Space-delimited scopes to request (subset of the client's).",
  })
  @IsOptional()
  @IsString()
  scope?: string;
}
