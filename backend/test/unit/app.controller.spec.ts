import { API_VERSION } from '../../src/config/api-routing';
import { SWAGGER_UI_PATH } from '../../src/config/swagger.config';
import { Test, TestingModule } from '@nestjs/testing';
import { describe, it, expect, beforeEach } from 'bun:test';
import { AppController } from '../../src/app.controller';
import { AppService } from '../../src/app.service';
import { UsersService } from '../../src/users/users.service';
import { RolesService } from '../../src/roles/roles.service';
import { PermissionsService } from '../../src/permissions/permissions.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: UsersService, useValue: {} },
        { provide: RolesService, useValue: {} },
        { provide: PermissionsService, useValue: {} },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('returns exactly the API identity fields from shared configuration', () => {
      const info = appController.getApiInfo();
      expect(info).toEqual({
        name: 'Nestplate API',
        apiVersion: API_VERSION,
        docs: SWAGGER_UI_PATH,
      });
    });
  });
});
