import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class CreatePortalBookingDto {
  @ApiProperty({ example: 'jakarta-groove-collective-vol-4' })
  @IsString()
  @IsNotEmpty()
  eventSlug: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  slotId: number;

  @ApiProperty({ example: 'Raka Pratama' })
  @IsString()
  @IsNotEmpty()
  attendee: string;
}
