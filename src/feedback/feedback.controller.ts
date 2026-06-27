import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ROLES } from '../auth/roles';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { PaginatedFeedbackDto } from './dto/feedback-list.dto';
import { FeedbackResponseDto } from './dto/feedback-response.dto';
import { ListFeedbackQueryDto } from './dto/list-feedback.query.dto';
import { FeedbackService } from './feedback.service';

@ApiTags('feedback')
@Controller({ path: 'feedback', version: '1' })
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a piece of product feedback' })
  @ApiCreatedResponse({ type: FeedbackResponseDto })
  create(@Body() dto: CreateFeedbackDto): Promise<FeedbackResponseDto> {
    return this.feedbackService.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.TRIAGE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List feedback for triage (paginated)' })
  @ApiOkResponse({ type: PaginatedFeedbackDto })
  list(@Query() query: ListFeedbackQueryDto): Promise<PaginatedFeedbackDto> {
    return this.feedbackService.list(query);
  }
}
