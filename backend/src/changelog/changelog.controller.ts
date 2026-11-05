import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChangelogService } from './changelog.service';
import type { ReleaseNotes } from './changelog.service';
import { ReleaseNotesDto } from './dto/release-notes.dto';

@ApiTags('Changelog')
@ApiBearerAuth()
@Controller('changelog')
// JwtAuthGuard only, no PermissionsGuard: release notes are for every signed-in
// user, which is why the sidebar entry carries no permission either.
@UseGuards(JwtAuthGuard)
export class ChangelogController {
  constructor(private readonly service: ChangelogService) {}

  @Get()
  @ApiOperation({ summary: 'Published release notes, newest first' })
  @ApiOkResponse({ type: [ReleaseNotesDto] })
  findAll(): Promise<Array<ReleaseNotes>> {
    return this.service.findAll();
  }
}
