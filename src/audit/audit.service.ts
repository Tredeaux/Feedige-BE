import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginatedAuditDto } from './dto/audit-log.dto';
import { ListAuditQueryDto } from './dto/list-audit.query.dto';

export interface AuditEntry {
  action: string;
  userId?: string | null;
  feedbackId?: string | null;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  notes?: string;
}

/** Either the base Prisma client or a transaction client. */
type AuditClient = Pick<PrismaService, 'auditLog'> | Prisma.TransactionClient;

/**
 * Central, consistent writer for the append-only `audit_log`. Pass a transaction
 * client to record the audit atomically with the action it describes.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    entry: AuditEntry,
    client: AuditClient = this.prisma,
  ): Promise<void> {
    await client.auditLog.create({
      data: {
        action: entry.action,
        userId: entry.userId ?? null,
        feedbackId: entry.feedbackId ?? null,
        oldValue: entry.oldValue,
        newValue: entry.newValue,
        notes: entry.notes,
      },
    });
  }

  /** Paginated, filtered, searchable view of the audit log (newest first). */
  async list(query: ListAuditQueryDto): Promise<PaginatedAuditDto> {
    const { page, pageSize, action, userId, feedbackId, search, from, to } =
      query;

    const where: Prisma.AuditLogWhereInput = {
      ...(action ? { action } : {}),
      ...(userId ? { userId } : {}),
      ...(feedbackId ? { feedbackId } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { action: { contains: search, mode: 'insensitive' } },
              { notes: { contains: search, mode: 'insensitive' } },
              { user: { email: { contains: search, mode: 'insensitive' } } },
              { user: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          user: true,
          feedback: { select: { id: true, rawText: true } },
        },
      }),
    ]);

    return PaginatedAuditDto.from(rows, { page, pageSize, total });
  }

  /** Distinct action names, for populating a filter dropdown. */
  async distinctActions(): Promise<string[]> {
    const rows = await this.prisma.auditLog.findMany({
      distinct: ['action'],
      select: { action: true },
      orderBy: { action: 'asc' },
    });
    return rows.map((r) => r.action);
  }
}
