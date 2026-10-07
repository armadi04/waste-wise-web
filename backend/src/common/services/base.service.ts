import { NotFoundException, ConflictException, Inject } from '@nestjs/common';
import {
  Repository,
  FindManyOptions,
  ILike,
  In,
  ObjectLiteral,
  DeepPartial,
  FindOptionsWhere,
} from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { ApiProperty } from '@nestjs/swagger';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { toFindOptionsRelations } from '@/common/helpers/find-options.util';

export class PaginationMetaDto {
  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  lastPage: number;
}

export abstract class PaginatedResponseDto<T> {
  data: T[];

  @ApiProperty()
  meta: PaginationMetaDto;
}

export abstract class BaseService<T extends ObjectLiteral> {
  @Inject(EventEmitter2)
  protected readonly eventEmitter: EventEmitter2;

  protected constructor(
    protected readonly repository: Repository<T>,
    protected readonly entityName: string,
    protected readonly searchFields: string[] = [],
  ) {}

  async findAllPaginated(
    page: number = 1,
    limit: number = 10,
    search?: string,
    sort: string = 'createdAt',
    direction: string = 'DESC',
    relations: string[] = [],
    filters: FindOptionsWhere<T> = {},
  ) {
    const currentPage = Math.max(1, page);
    const skip = (currentPage - 1) * limit;

    const safeSort = this.safeSort(sort);

    const findOptions: FindManyOptions<T> = {
      skip,
      take: limit,
      order: {
        [safeSort]: direction.toUpperCase() === 'ASC' ? 'ASC' : 'DESC',
      } as FindManyOptions<T>['order'],
      relations: toFindOptionsRelations<T>(relations),
    };

    findOptions.where = this.listWhere(search, filters);

    const [data, total] = await this.repository.findAndCount(findOptions);

    return {
      data,
      meta: {
        total,
        page: +currentPage,
        lastPage: Math.ceil(total / limit),
      },
    };
  }

  async findAll(
    relations: string[] = [],
    options: FindManyOptions<T> = {},
  ): Promise<T[]> {
    return this.repository.find({
      ...options,
      relations: toFindOptionsRelations<T>(relations),
    });
  }

  protected listWhere(
    search?: string,
    filters: FindOptionsWhere<T> = {},
  ): FindOptionsWhere<T> | FindOptionsWhere<T>[] {
    if (!search || !this.searchFields.length) return filters;
    return this.searchFields.map((field) => ({
      ...filters,
      [field]: ILike(`%${search}%`),
    }));
  }

  protected safeSort(sort: string): string {
    const columns =
      this.repository.metadata?.columns?.map((column) => column.propertyName) ??
      [];
    return columns.length === 0 || columns.includes(sort)
      ? sort
      : columns.includes('createdAt')
        ? 'createdAt'
        : sort;
  }

  async findOne(id: number, relations: string[] = []): Promise<T> {
    const entity = await this.repository.findOne({
      where: { id: id as unknown } as FindOptionsWhere<T>,
      relations: toFindOptionsRelations<T>(relations),
    });
    if (!entity) {
      throw new NotFoundException(`${this.entityName} #${id} not found`);
    }
    return entity;
  }

  async create(dto: DeepPartial<T>): Promise<T> {
    try {
      const entity = this.repository.create(dto);
      const saved = await this.repository.save(entity);

      if (this.eventEmitter) {
        this.eventEmitter.emit('system.create', {
          title: `New ${this.entityName} Created`,
          message: `A new ${this.entityName} has been created.`,
          entity: saved,
        });
      }

      return saved;
    } catch (error) {
      this.handleDbError(error);
    }
  }

  async update(id: number, dto: QueryDeepPartialEntity<T>): Promise<T> {
    const preloadDto = {
      id,
      ...dto,
    } as unknown as DeepPartial<T>;

    const entity = await this.repository.preload(preloadDto);

    if (!entity) {
      throw new NotFoundException(`${this.entityName} #${id} not found`);
    }

    try {
      const saved = await this.repository.save(entity);

      if (this.eventEmitter) {
        this.eventEmitter.emit('system.update', {
          title: `${this.entityName} Updated`,
          message: `${this.entityName} #${id} has been updated.`,
          entity: saved,
        });
      }

      return saved;
    } catch (error) {
      this.handleDbError(error);
    }
  }

  async remove(id: number): Promise<void> {
    const entity = await this.findOne(id);
    await this.repository.softRemove(entity);

    if (this.eventEmitter) {
      this.eventEmitter.emit('system.delete', {
        title: `${this.entityName} Deleted`,
        message: `${this.entityName} #${id} has been deleted.`,
      });
    }
  }

  async removeMany(ids: number[]): Promise<{ deleted: number }> {
    const entities = await this.repository.find({
      where: { id: In(ids) } as unknown as FindOptionsWhere<T>,
    });

    if (entities.length) {
      await this.repository.softRemove(entities);

      if (this.eventEmitter) {
        this.eventEmitter.emit('system.delete', {
          title: `${this.entityName} Deleted`,
          message: `${entities.length} ${this.entityName}(s) have been deleted.`,
        });
      }
    }

    return { deleted: entities.length };
  }

  protected handleDbError(error: any): never {
    const dbError = error as { code?: string };
    if (dbError.code === '23505') {
      throw new ConflictException(`${this.entityName} already exists`);
    }
    throw error;
  }
}
