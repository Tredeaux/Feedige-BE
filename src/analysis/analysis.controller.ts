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
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { ApiAuthErrors } from '../common/api-auth-errors.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
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
  @ApiAuthErrors()
  @ApiBadRequestResponse({ description: 'Invalid id', type: ErrorResponseDto })
  @ApiNotFoundResponse({
    description: 'Feedback not found',
    type: ErrorResponseDto,
  })
  @ApiUnprocessableEntityResponse({
    description: 'The AI returned output that failed validation',
    type: ErrorResponseDto,
  })
  @ApiServiceUnavailableResponse({
    description: 'AI analysis is not configured (no OPENAI_API_KEY)',
    type: ErrorResponseDto,
  })
  analyze(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ): Promise<AnalysisResponseDto> {
    const user = req.user as AuthenticatedUser;
    return this.analysisService.analyzeFeedback(id, user.userId);
  }
}
