import {
  FOLLOW_TARGET_TYPES,
  type FollowTargetType,
} from '@/portal/customer/follow-target';
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class CreatePortalFollowDto {
  @ApiProperty({ enum: FOLLOW_TARGET_TYPES })
  @IsIn(FOLLOW_TARGET_TYPES)
  targetType: FollowTargetType;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  targetKey: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  targetName: string;

  @ApiProperty()
  @IsUrl({ require_tld: false })
  imageUrl: string;
}
