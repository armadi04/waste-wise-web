import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService, ApiInfo } from './app.service';

@ApiTags('Meta')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'API identity and documentation location' })
  @ApiOkResponse({
    type: ApiInfo,
    description:
      'API identity; use the health endpoint for dependency connectivity.',
  })
  getApiInfo(): ApiInfo {
    return this.appService.getApiInfo();
  }
}
