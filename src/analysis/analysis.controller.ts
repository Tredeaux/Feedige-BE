import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { ROLES } from '../auth/roles';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AnalysisService } from './analysis.service';
import { AnalysisResponseDto } from './dto/analysis-response.dto';

@ApiTags('analysis')
@Controller({ path: 'feedback', version: '1' })
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  @Post(':id/analyze')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.TRIAGE)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Run AI analysis on a feedback item (triage/admin)',
  })
  @ApiCreatedResponse({ type: AnalysisResponseDto })
  analyze(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<AnalysisResponseDto> {
    const user = req.user as AuthenticatedUser;
    return this.analysisService.analyzeFeedback(id, user.userId);
  }
}
