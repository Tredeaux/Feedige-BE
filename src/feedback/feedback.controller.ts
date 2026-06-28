import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { ApiAuthErrors } from '../common/api-auth-errors.decorator';
import { ErrorResponseDto } from '../common/dto/error-response.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { ROLES } from '../auth/roles';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { PaginatedFeedbackDto } from './dto/feedback-list.dto';
import { FeedbackResponseDto } from './dto/feedback-response.dto';
import { FeedbackStatsDto } from './dto/feedback-stats.dto';
import { ListFeedbackQueryDto } from './dto/list-feedback.query.dto';
import { UpdateFeedbackStatusDto } from './dto/update-status.dto';
import { FeedbackService } from './feedback.service';

@ApiTags('feedback')
@Controller({ path: 'feedback', version: '1' })
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a piece of product feedback' })
  @ApiCreatedResponse({ type: FeedbackResponseDto })
  @ApiBadRequestResponse({
    description: 'Validation failed',
    type: ErrorResponseDto,
  })
  create(@Body() dto: CreateFeedbackDto): Promise<FeedbackResponseDto> {
    return this.feedbackService.create(dto);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.TRIAGE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Aggregate analytics for the dashboard' })
  @ApiOkResponse({ type: FeedbackStatsDto })
  @ApiAuthErrors()
  stats(): Promise<FeedbackStatsDto> {
    return this.feedbackService.getStats();
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.TRIAGE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List feedback for triage (paginated)' })
  @ApiOkResponse({ type: PaginatedFeedbackDto })
  @ApiAuthErrors()
  list(@Query() query: ListFeedbackQueryDto): Promise<PaginatedFeedbackDto> {
    return this.feedbackService.list(query);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.TRIAGE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change a feedback item’s triage status' })
  @ApiOkResponse({ type: FeedbackResponseDto })
  @ApiAuthErrors()
  @ApiNotFoundResponse({
    description: 'Feedback not found',
    type: ErrorResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid id or status',
    type: ErrorResponseDto,
  })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFeedbackStatusDto,
    @Req() req: Request,
  ): Promise<FeedbackResponseDto> {
    const user = req.user as AuthenticatedUser;
    return this.feedbackService.updateStatus(id, dto.status, user.userId);
  }
}
