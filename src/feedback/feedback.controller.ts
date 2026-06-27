import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { FeedbackResponseDto } from './dto/feedback-response.dto';
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
}
