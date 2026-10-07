import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

/** Lucide icon keys the portal knows how to render for category lanes. */
export const CATEGORY_ICONS = [
  'utensils',
  'music',
  'armchair',
  'coffee',
  'beer',
  'film',
  'ticket',
  'sparkles',
  'moon',
  'gamepad',
  'shopping-bag',
  'dumbbell',
  'heart',
] as const;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreatePortalCouponCategoryDto {
  @ApiProperty({ maxLength: 80, description: 'Exact label stored on coupons' })
  @IsString()
  @Length(1, 80)
  name: string;

  @ApiPropertyOptional({
    maxLength: 80,
    description: 'Generated from name when omitted',
  })
  @IsOptional()
  @Matches(SLUG)
  @MaxLength(80)
  slug?: string;

  @ApiPropertyOptional({
    maxLength: 40,
    nullable: true,
    description: 'Short home lane label',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(40)
  label?: string | null;

  @ApiPropertyOptional({ maxLength: 240 })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  blurb?: string;

  @ApiPropertyOptional({ enum: CATEGORY_ICONS, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(CATEGORY_ICONS)
  icon?: string | null;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional({ default: false, description: 'Show as a home lane' })
  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdatePortalCouponCategoryDto extends PartialType(
  CreatePortalCouponCategoryDto,
) {}

export class CreatePortalCityDto {
  @ApiProperty({ maxLength: 100 })
  @IsString()
  @Length(1, 100)
  name: string;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @Matches(SLUG)
  @MaxLength(100)
  slug?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional({
    default: false,
    description: 'Pin to the top of pickers',
  })
  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdatePortalCityDto extends PartialType(CreatePortalCityDto) {}

export class PortalContentSectionDto {
  @ApiPropertyOptional({ maxLength: 60 })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  id?: string;

  @ApiPropertyOptional({ maxLength: 180 })
  @IsOptional()
  @IsString()
  @MaxLength(180)
  heading?: string;

  @ApiProperty({
    maxLength: 5000,
    description: 'Plain text; blank lines separate paragraphs',
  })
  @IsString()
  @MaxLength(5000)
  body: string;
}

export class SavePortalContentDto {
  @ApiProperty({ maxLength: 180 })
  @IsString()
  @Length(1, 180)
  title: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;

  @ApiPropertyOptional({ type: [PortalContentSectionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => PortalContentSectionDto)
  sections?: PortalContentSectionDto[];

  @ApiPropertyOptional({ type: Object, description: 'Key-specific settings' })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @ApiProperty()
  @IsBoolean()
  published: boolean;
}

export class PortalContentResponseDto {
  @ApiProperty() key: string;
  @ApiProperty() title: string;
  @ApiProperty() summary: string;
  @ApiProperty({ type: [PortalContentSectionDto] })
  sections: PortalContentSectionDto[];
  @ApiProperty({ type: Object }) data: Record<string, unknown>;
  @ApiProperty() updatedAt: Date;
}

export class PortalAdminContentDto extends PortalContentResponseDto {
  @ApiProperty() description: string;
  @ApiProperty() published: boolean;
  @ApiProperty({ description: 'False until an admin saves this key' })
  saved: boolean;
  @ApiProperty() maxSections: number;
  @ApiProperty({ enum: ['required', 'optional'] }) sectionHeading: string;
}

export class CreatePortalBroadcastDto {
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @Length(3, 120)
  title: string;

  @ApiProperty({ maxLength: 500 })
  @IsString()
  @Length(3, 500)
  message: string;

  @ApiPropertyOptional({
    maxLength: 255,
    description: 'Portal path such as /campaigns/x',
  })
  @IsOptional()
  @Matches(/^\/[^\s]*$/, {
    message: 'link must be a portal path starting with /',
  })
  @MaxLength(255)
  link?: string;

  @ApiPropertyOptional({
    enum: ['info', 'success', 'warning'],
    default: 'info',
  })
  @IsOptional()
  @IsIn(['info', 'success', 'warning'])
  type?: string;

  @ApiProperty({ enum: ['all', 'userIds'] })
  @IsIn(['all', 'userIds'])
  audience: 'all' | 'userIds';

  @ApiPropertyOptional({
    type: [Number],
    description: 'Required for audience userIds',
  })
  @ValidateIf((dto: CreatePortalBroadcastDto) => dto.audience === 'userIds')
  @IsArray()
  @ArrayMaxSize(1000)
  @IsInt({ each: true })
  @Min(1, { each: true })
  userIds?: number[];

  @ApiProperty({
    description: 'Stable unique key so a retried send is not duplicated',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(80)
  idempotencyKey: string;
}
