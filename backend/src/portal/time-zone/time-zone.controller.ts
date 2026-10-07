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
import { TimeZoneService } from '@/portal/time-zone/time-zone.service';
import {
  TimeZonePreferenceDto,
  PreviewTimeDto,
  TimeZoneConfigResponseDto,
  TimeZonePreferenceResponseDto,
  TimePreviewResponseDto,
} from '@/portal/time-zone/dto/time-zone.dto';
@ApiTags('Time zones')
@Controller('portal')
export class TimeZoneController {
  constructor(private readonly time: TimeZoneService) {}
  @ApiOkResponse({ type: TimeZoneConfigResponseDto })
  @Get('time/config')
  config() {
    return this.time.config();
  }
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ type: TimeZonePreferenceResponseDto })
  @Header('Cache-Control', 'no-store')
  @Get('me/preferences')
  preferences(@Req() req: IAuthRequest) {
    return this.time.preferences(req.user.userId);
  }
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOkResponse({ type: TimeZonePreferenceResponseDto })
  @Header('Cache-Control', 'no-store')
  @Patch('me/preferences')
  update(@Req() req: IAuthRequest, @Body() dto: TimeZonePreferenceDto) {
    return this.time.updatePreferences(req.user.userId, dto);
  }
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiCreatedResponse({ type: TimePreviewResponseDto })
  @Header('Cache-Control', 'no-store')
  @Post('time/preview')
  preview(@Body() dto: PreviewTimeDto) {
    return this.time.preview(dto.localDateTime, dto.timeZone);
  }
}
