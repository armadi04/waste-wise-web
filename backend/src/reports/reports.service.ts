import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository, SelectQueryBuilder } from 'typeorm';
import { BaseService } from '../common/services/base.service';
import type { AuthenticatedUser } from '../auth/interfaces/auth-request.interface';
import { MediaService } from '../media/media.service';
import type { Media } from '../media/entities/media.entity';
import {
  BUSINESS_TIME_ZONE,
  businessDateInputToISO,
  parseCalendarDate,
} from '../common/utils/business-time';
import { ClassificationService } from './classification.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { ReportQueryDto } from './dto/report-query.dto';
import { ReportStatsDto } from './dto/report-stats.dto';
import {
  ClassificationStatus,
  Report,
  ReportStatus,
  WasteCategory,
} from './entities/report.entity';
import { assertStatusTransition } from './report-status';

const REPORT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const SORTABLE_COLUMNS = new Set([
  'createdAt',
  'updatedAt',
  'status',
  'predictedCategory',
  'confidence',
  'description',
]);

@Injectable()
export class ReportsService extends BaseService<Report> {
  constructor(
    @InjectRepository(Report)
    private readonly reports: Repository<Report>,
    private readonly mediaService: MediaService,
    private readonly classification: ClassificationService,
  ) {
    super(reports, 'Report', ['description']);
  }

  async listReports(actor: AuthenticatedUser, query: ReportQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const builder = this.scopedBuilder(actor, query);
    this.applyFilters(builder, actor, query);

    const sort = SORTABLE_COLUMNS.has(query.sort ?? '')
      ? query.sort!
      : 'createdAt';
    const direction = query.direction?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    builder
      .orderBy(`report.${sort}`, direction)
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await builder.getManyAndCount();
    return {
      data,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit),
      },
    };
  }

  async findOneForActor(actor: AuthenticatedUser, id: number): Promise<Report> {
    const report = await this.reports.findOne({
      where: { id },
      relations: { reporter: true, media: true },
    });
    if (!report) throw new NotFoundException(`Report #${id} not found`);
    this.assertCanRead(actor, report);
    return report;
  }

  async createForActor(
    actor: AuthenticatedUser,
    dto: CreateReportDto,
    ipAddress?: string | null,
  ): Promise<Report> {
    const media = await this.assertUsableMedia(actor, dto.mediaId);
    const classification = await this.classification.classify(media);
    const report = await super.create({
      reporterId: actor.userId,
      mediaId: media.id,
      description: dto.description,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      status: ReportStatus.PENDING,
      predictedCategory: classification.category,
      confidence: classification.confidence,
      modelVersion: classification.modelVersion,
      classificationStatus: classification.status,
      classificationError: classification.errorCode,
    });
    const view = await this.findOneForActor(actor, report.id);
    this.recordAudit(
      actor,
      'report.created',
      view.id,
      `Created report #${view.id}`,
      {
        mediaId: view.mediaId,
        classificationStatus: view.classificationStatus,
        predictedCategory: view.predictedCategory,
      },
      ipAddress,
    );
    return view;
  }

  async updateForActor(
    actor: AuthenticatedUser,
    id: number,
    dto: UpdateReportDto,
    ipAddress?: string | null,
  ): Promise<Report> {
    const report = await this.findOneForActor(actor, id);
    this.assertCanUpdate(actor, report);

    const changes: UpdateReportDto & {
      predictedCategory?: WasteCategory | null;
      confidence?: number | null;
      modelVersion?: string | null;
      classificationStatus?: ClassificationStatus;
      classificationError?: string | null;
    } = {};

    if (dto.description !== undefined) changes.description = dto.description;
    if (dto.latitude !== undefined) changes.latitude = dto.latitude;
    if (dto.longitude !== undefined) changes.longitude = dto.longitude;

    let reclassified = false;
    if (dto.mediaId !== undefined && dto.mediaId !== report.mediaId) {
      const media = await this.assertUsableMedia(actor, dto.mediaId);
      const classification = await this.classification.classify(media);
      changes.mediaId = media.id;
      changes.predictedCategory = classification.category;
      changes.confidence = classification.confidence;
      changes.modelVersion = classification.modelVersion;
      changes.classificationStatus = classification.status;
      changes.classificationError = classification.errorCode;
      reclassified = true;
    }

    await super.update(id, changes);
    const view = await this.findOneForActor(actor, id);
    this.recordAudit(
      actor,
      'report.updated',
      id,
      `Updated report #${id}`,
      {
        mediaId: view.mediaId,
        reclassified,
        classificationStatus: view.classificationStatus,
      },
      ipAddress,
    );
    return view;
  }

  async removeForActor(
    actor: AuthenticatedUser,
    id: number,
    ipAddress?: string | null,
  ): Promise<void> {
    const report = await this.findOneForActor(actor, id);
    this.assertCanDelete(actor, report);
    await super.remove(id);
    this.recordAudit(
      actor,
      'report.deleted',
      id,
      `Deleted report #${id}`,
      { status: report.status, mediaId: report.mediaId },
      ipAddress,
    );
  }

  async updateStatusForActor(
    actor: AuthenticatedUser,
    id: number,
    status: ReportStatus,
    ipAddress?: string | null,
  ): Promise<Report> {
    const report = await this.findOneForActor(actor, id);
    const from = report.status;
    assertStatusTransition(from, status);
    await super.update(id, { status });
    const view = await this.findOneForActor(actor, id);
    this.recordAudit(
      actor,
      'report.status_updated',
      id,
      `Changed report #${id} status from ${from} to ${status}`,
      { from, to: status },
      ipAddress,
    );
    return view;
  }

  async statsForActor(actor: AuthenticatedUser): Promise<ReportStatsDto> {
    const scope = this.scopeWhere(actor);
    const statusRows = await this.reports
      .createQueryBuilder('report')
      .select('report.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('report.deletedAt IS NULL')
      .andWhere(this.scopeSql(actor), this.scopeParams(actor))
      .groupBy('report.status')
      .getRawMany<{ status: ReportStatus; count: string }>();

    const categoryRows = await this.reports
      .createQueryBuilder('report')
      .select('report.predictedCategory', 'category')
      .addSelect('COUNT(*)', 'count')
      .where('report.deletedAt IS NULL')
      .andWhere(this.scopeSql(actor), this.scopeParams(actor))
      .groupBy('report.predictedCategory')
      .getRawMany<{ category: WasteCategory | null; count: string }>();

    const recentReports = await this.reports.find({
      where: scope,
      relations: { reporter: true, media: true },
      order: { createdAt: 'DESC' },
      take: 5,
    });

    const byStatus = new Map(
      statusRows.map((row) => [row.status, Number(row.count)]),
    );
    const byCategory = new Map(
      categoryRows.map((row) => [row.category, Number(row.count)]),
    );
    const pending = byStatus.get(ReportStatus.PENDING) ?? 0;
    const inProgress = byStatus.get(ReportStatus.IN_PROGRESS) ?? 0;
    const completed = byStatus.get(ReportStatus.COMPLETED) ?? 0;
    const rejected = byStatus.get(ReportStatus.REJECTED) ?? 0;

    return {
      total: pending + inProgress + completed + rejected,
      pending,
      inProgress,
      completed,
      rejected,
      byCategory: {
        organic: byCategory.get(WasteCategory.ORGANIC_WASTE) ?? 0,
        plastic: byCategory.get(WasteCategory.PLASTIC_WASTE) ?? 0,
        paper: byCategory.get(WasteCategory.PAPER_WASTE) ?? 0,
        unclassified: byCategory.get(null) ?? 0,
      },
      recentReports,
    };
  }

  private scopedBuilder(
    actor: AuthenticatedUser,
    query: ReportQueryDto,
  ): SelectQueryBuilder<Report> {
    const builder = this.reports
      .createQueryBuilder('report')
      .leftJoinAndSelect('report.reporter', 'reporter')
      .leftJoinAndSelect('report.media', 'media')
      .where('report.deletedAt IS NULL');

    if (this.canReadAll(actor)) {
      if (query.reporterId !== undefined)
        builder.andWhere('report.reporterId = :reporterId', {
          reporterId: query.reporterId,
        });
    } else {
      builder.andWhere('report.reporterId = :actorId', {
        actorId: actor.userId,
      });
    }
    return builder;
  }

  private applyFilters(
    builder: SelectQueryBuilder<Report>,
    actor: AuthenticatedUser,
    query: ReportQueryDto,
  ): void {
    if (query.status)
      builder.andWhere('report.status = :status', { status: query.status });
    if (query.category)
      builder.andWhere('report.predictedCategory = :category', {
        category: query.category,
      });

    const from = this.dayStart(query.from);
    if (from) builder.andWhere('report.createdAt >= :from', { from });
    const to = this.dayEndExclusive(query.to);
    if (to) builder.andWhere('report.createdAt < :to', { to });

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      if (this.canReadAll(actor)) {
        builder.andWhere(
          '(report.description ILIKE :term OR reporter.fullname ILIKE :term OR reporter.email ILIKE :term)',
          { term },
        );
      } else {
        builder.andWhere('report.description ILIKE :term', { term });
      }
    }
  }

  private dayStart(value?: string): Date | null {
    if (!value) return null;
    const date = parseCalendarDate(value.slice(0, 10));
    if (!Number.isFinite(date.getTime()))
      throw new BadRequestException('Invalid from date');
    return new Date(
      businessDateInputToISO(
        `${value.slice(0, 10)}T00:00:00`,
        BUSINESS_TIME_ZONE,
      ),
    );
  }

  private dayEndExclusive(value?: string): Date | null {
    if (!value) return null;
    const date = parseCalendarDate(value.slice(0, 10));
    if (!Number.isFinite(date.getTime()))
      throw new BadRequestException('Invalid to date');
    const next = new Date(date.getTime() + 86_400_000);
    return new Date(
      businessDateInputToISO(
        `${next.toISOString().slice(0, 10)}T00:00:00`,
        BUSINESS_TIME_ZONE,
      ),
    );
  }

  private scopeWhere(actor: AuthenticatedUser): FindOptionsWhere<Report> {
    return this.canReadAll(actor) ? {} : { reporterId: actor.userId };
  }

  private scopeSql(actor: AuthenticatedUser): string {
    return this.canReadAll(actor) ? '1 = 1' : 'report.reporterId = :actorId';
  }

  private scopeParams(actor: AuthenticatedUser): Record<string, number> {
    return this.canReadAll(actor) ? {} : { actorId: actor.userId };
  }

  private async assertUsableMedia(
    actor: AuthenticatedUser,
    mediaId: number,
  ): Promise<Media> {
    const media = await this.mediaService.findOne(mediaId);
    if (media.userId !== actor.userId)
      throw new ForbiddenException('You do not have access to this media');
    if (!media.mimetype.startsWith('image/'))
      throw new BadRequestException('Report photo must be an image');
    if (media.size !== null && media.size > REPORT_IMAGE_MAX_BYTES)
      throw new BadRequestException('Report photo must be 5 MB or smaller');
    return media;
  }

  private recordAudit(
    actor: AuthenticatedUser,
    action: string,
    reportId: number,
    summary: string,
    metadata: Record<string, unknown>,
    ipAddress?: string | null,
  ): void {
    this.eventEmitter?.emit('audit.record', {
      action,
      actorId: actor.userId,
      actorEmail: actor.email,
      subjectType: 'report',
      subjectId: reportId,
      summary,
      metadata,
      ipAddress: ipAddress ?? null,
    });
  }

  private canReadAll(actor: AuthenticatedUser): boolean {
    return actor.permissions.includes('reports.read.all');
  }

  private canUpdateAll(actor: AuthenticatedUser): boolean {
    return actor.permissions.includes('reports.update.all');
  }

  private canDeleteAll(actor: AuthenticatedUser): boolean {
    return actor.permissions.includes('reports.delete.all');
  }

  private assertCanRead(actor: AuthenticatedUser, report: Report): void {
    if (this.canReadAll(actor)) return;
    if (report.reporterId !== actor.userId)
      throw new ForbiddenException('You do not have access to this report');
  }

  private assertCanUpdate(actor: AuthenticatedUser, report: Report): void {
    if (this.canUpdateAll(actor)) return;
    if (!actor.permissions.includes('reports.update.own'))
      throw new ForbiddenException('You cannot update reports');
    if (report.reporterId !== actor.userId)
      throw new ForbiddenException('You do not have access to this report');
    if (report.status !== ReportStatus.PENDING)
      throw new BadRequestException('Only pending reports can be updated');
  }

  private assertCanDelete(actor: AuthenticatedUser, report: Report): void {
    if (this.canDeleteAll(actor)) return;
    if (!actor.permissions.includes('reports.delete.own'))
      throw new ForbiddenException('You cannot delete reports');
    if (report.reporterId !== actor.userId)
      throw new ForbiddenException('You do not have access to this report');
    if (report.status !== ReportStatus.PENDING)
      throw new BadRequestException('Only pending reports can be deleted');
  }
}
