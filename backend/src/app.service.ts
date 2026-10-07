import { Injectable } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { API_VERSION } from './config/api-routing';
import { SWAGGER_UI_PATH } from './config/swagger.config';

export class ApiInfo {
  @ApiProperty({ example: 'Nestplate API' })
  name: string;

  @ApiProperty({ example: API_VERSION })
  apiVersion: string;

  @ApiProperty({ example: SWAGGER_UI_PATH })
  docs: string;
}

@Injectable()
export class AppService {
  getApiInfo(): ApiInfo {
    return {
      name: 'Nestplate API',
      apiVersion: API_VERSION,
      docs: SWAGGER_UI_PATH,
    };
  }
}
