import { Injectable } from '@nestjs/common';

export interface ApiInfo {
  name: string;
  status: 'ok';
  version: string;
  environment: string;
  docs: string;
  timestamp: string;
  uptime: number;
}

@Injectable()
export class AppService {
  getApiInfo(): ApiInfo {
    return {
      name: 'Nestplate API',
      status: 'ok',
      version: process.env.npm_package_version ?? '0.0.0',
      environment: process.env.NODE_ENV ?? 'development',
      docs: '/api/docs',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    };
  }
}
