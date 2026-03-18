import { Controller, Post, Body, Get } from '@nestjs/common';
import { AiService } from './ai.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('executive-summary')
  async generateExecutiveSummary(
    @Body() body: { metrics: any; provider?: string },
    @CurrentUser() user: any,
  ) {
    return this.aiService.generateExecutiveSummary(
      body.metrics,
      user?.organizationId,
      body.provider,
    );
  }

  @Post('chat')
  async chat(
    @Body() body: { message: string; context: any; provider?: string },
    @CurrentUser() user: any,
  ) {
    return this.aiService.chat(
      body.message,
      body.context,
      user?.organizationId,
      body.provider,
    );
  }

  @Get('providers')
  getProviders() {
    return {
      available: this.aiService.getAvailableProviders(),
      default: this.aiService.getDefaultProvider(),
    };
  }
}
