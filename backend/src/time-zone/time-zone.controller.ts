import {
  Body,
  Controller,
  Get,
  Header,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOkResponse,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/jwt-auth.guard';
import type { IAuthRequest } from '@/auth/interfaces/auth-request.interface';
import { TimeZoneService } from './time-zone.service';
import {
  TimeZonePreferenceDto,
  PreviewTimeDto,
  TimeZoneConfigResponseDto,
  TimeZonePreferenceResponseDto,
  TimePreviewResponseDto,
} from './dto/time-zone.dto';

@ApiTags('Time zones')
@Controller('time-zone')
export class TimeZoneController {
  constructor(private readonly time: TimeZoneService) {}
  @ApiOkResponse({ type: TimeZoneConfigResponseDto })
  @Get('config')
  config() {
    return this.time.config();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ type: TimeZonePreferenceResponseDto })
  @Header('Cache-Control', 'no-store')
  @Get('preferences')
  preferences(@Req() req: IAuthRequest) {
    return this.time.preferences(req.user.userId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ type: TimeZonePreferenceResponseDto })
  @Header('Cache-Control', 'no-store')
  @Patch('preferences')
  update(@Req() req: IAuthRequest, @Body() dto: TimeZonePreferenceDto) {
    return this.time.updatePreferences(req.user.userId, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiCreatedResponse({ type: TimePreviewResponseDto })
  @Header('Cache-Control', 'no-store')
  @Post('preview')
  preview(@Body() dto: PreviewTimeDto) {
    return this.time.preview(dto.localDateTime, dto.timeZone);
  }
}
