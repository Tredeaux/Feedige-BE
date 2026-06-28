import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiAuthErrors } from '../common/api-auth-errors.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ROLES } from '../auth/roles';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuditService } from './audit.service';
import { PaginatedAuditDto } from './dto/audit-log.dto';
import { ListAuditQueryDto } from './dto/list-audit.query.dto';

@ApiTags('audit')
@ApiBearerAuth()
@ApiAuthErrors()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.ADMIN, ROLES.TRIAGE)
@Controller({ path: 'audit-logs', version: '1' })
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'List audit log entries (paginated, filterable)' })
  @ApiOkResponse({ type: PaginatedAuditDto })
  list(@Query() query: ListAuditQueryDto): Promise<PaginatedAuditDto> {
    return this.audit.list(query);
  }

  @Get('actions')
  @ApiOperation({ summary: 'Distinct action names for filtering' })
  @ApiOkResponse({ type: [String] })
  actions(): Promise<string[]> {
    return this.audit.distinctActions();
  }
}
