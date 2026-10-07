# Adding a backend feature

Use `roles/` as the nearest working CRUD example; omit its access-grant logic for ordinary
resources. Services own domain writes, controllers own HTTP, DTOs own validation.

## 1. Entity and DTOs

Create `src/projects/entities/project.entity.ts`:

```ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('projects')
export class Project {
  @ApiProperty()
  @PrimaryGeneratedColumn({ name: 'id' })
  id: number;
  @ApiProperty()
  @Column({ name: 'name' })
  name: string;
  @ApiProperty()
  @CreateDateColumn({ name: 'createdAt', type: 'timestamptz', precision: 3 })
  createdAt: Date;
  @ApiProperty()
  @UpdateDateColumn({ name: 'updatedAt', type: 'timestamptz', precision: 3 })
  updatedAt: Date;
  @DeleteDateColumn({ name: 'deletedAt', type: 'timestamptz', precision: 3 })
  deletedAt: Date;
}
```

DTOs in `projects/dto/`:

```ts
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class CreateProjectDto {
  @ApiProperty()
  @IsString()
  @Length(1, 120)
  name: string;
}
export class UpdateProjectDto extends PartialType(CreateProjectDto) {}
```

Add indexes/constraints for actual requirements. Use explicit nullable database types.

## 2. Service and registration

`projects.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseService } from '@/common/services/base.service';
import { Project } from './entities/project.entity';

@Injectable()
export class ProjectsService extends BaseService<Project> {
  constructor(@InjectRepository(Project) repository: Repository<Project>) {
    super(repository, 'Project', ['name']);
  }
}
```

Create a `ProjectsModule` registering `TypeOrmModule.forFeature([Project])`, the service
and controller; import it into `AppModule`. Export providers only for consumers that need them.

## 3. HTTP and permissions

Copy the CRUD transport shape from `roles.controller.ts`:

- `@Controller('projects')`, Swagger tags/auth, and `@UseGuards(JwtAuthGuard, PermissionsGuard)`.
- GET list uses `PaginationParamsDto` and branches between paginated/unpaginated responses.
- GET/PATCH/DELETE ID uses an integer pipe and delegates to the service.
- POST/PATCH use create/update DTOs; DELETE delegates to soft-delete, not repository.delete.
- Advertise entity and paginated response DTOs through Swagger.
- Clear `*/projects*` cache after successful writes. Cache only caller-independent reads.
- Use service transactions for multi-row domain writes and emit existing event contracts for
  notifications/audit. No direct notification gateway or competing SMTP integration.

Add `projects.create/read/update/delete` to `PermissionType` and `SEEDED_PERMISSIONS`.
If visible in navigation, add `menu.projects` and synchronize the frontend menu/action gates.
Follow [permission sync](AUTH.md#permission-sync). Guards must actually read permission metadata.

## 4. Migration and contract

Generate and review a new migration; never alter the applied starter baseline:

```bash
bun run migration:generate src/database/migrations/AddProjects
bun run migration:run
bun run schema:check
bun run spec:generate
```

Use an intended development/disposable DB. Generate frontend API types next.
Add behavior tests under `test/unit/projects/` for validation, permissions and domain logic.
Required checks: lint, unit tests and build. E2E is opt-in.
