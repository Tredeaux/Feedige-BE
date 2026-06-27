import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
}
