import {
  IsOptional,
  IsString,
  IsEnum,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '../entities/notification.entity';

export class CreateNotificationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  userId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetRole?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  actorId?: number;

  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  message: string;

  @ApiPropertyOptional({ enum: NotificationType })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  link?: string;
}

export class MarkReadDto {
  @ApiProperty()
  @IsBoolean()
  isRead: boolean;
}
