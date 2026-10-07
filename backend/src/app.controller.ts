import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService, type ApiInfo } from './app.service';

@ApiTags('Meta')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'API service metadata and health status' })
  getApiInfo(): ApiInfo {
    return this.appService.getApiInfo();
  }
}
