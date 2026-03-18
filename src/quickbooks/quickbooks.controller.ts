import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Body,
  Req,
  Res,
  Headers,
  RawBodyRequest,
} from '@nestjs/common';
import { Response } from 'express';
import { QuickBooksService } from './quickbooks.service';
import { QuickBooksSyncService } from './quickbooks-sync.service';
import { QuickBooksWebhookService } from './quickbooks-webhook.service';
import { QbCallbackDto } from './dto/qb-callback.dto';
import { QbCreateInvoiceDto } from './dto/qb-create-invoice.dto';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../permissions/permissions.decorator';

@Controller('quickbooks')
export class QuickBooksController {
  constructor(
    private readonly qbService: QuickBooksService,
    private readonly syncService: QuickBooksSyncService,
    private readonly webhookService: QuickBooksWebhookService,
  ) {}

  @Get('connect')
  @Permissions('settings:manage')
  connect(@CurrentUser() user: any, @Res() res: Response) {
    const url = this.qbService.getAuthorizationUrl(user.organizationId);
    return res.redirect(url);
  }

  @Get('callback')
  @Public()
  async callback(@Query() dto: QbCallbackDto, @Res() res: Response) {
    let organizationId: string | undefined;
    try {
      const decoded = JSON.parse(Buffer.from(dto.state ?? '', 'base64').toString());
      organizationId = decoded.organizationId;
    } catch {}

    if (!organizationId) {
      return res.redirect(
        `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/admin/quickbooks?error=invalid_state`,
      );
    }
    await this.qbService.handleCallback(dto, organizationId);
    return res.redirect(
      `${process.env.FRONTEND_URL ?? 'http://localhost:3000'}/admin/quickbooks?connected=true`,
    );
  }

  @Delete('disconnect')
  @Permissions('settings:manage')
  async disconnect(@CurrentUser() user: any) {
    await this.qbService.disconnect(user.organizationId);
    return { message: 'QuickBooks disconnected' };
  }

  @Get('status')
  @Permissions('settings:manage')
  async getStatus(@CurrentUser() user: any) {
    return this.qbService.getStatus(user.organizationId);
  }

  @Post('sync/clients')
  @Permissions('settings:manage')
  async syncClients(@CurrentUser() user: any) {
    const result = await this.syncService.syncClients(user.organizationId);
    await this.syncService.updateLastSyncAt(user.organizationId);
    return result;
  }

  @Post('sync/payments')
  @Permissions('settings:manage')
  async syncPayments(@CurrentUser() user: any) {
    return this.qbService.syncPayments(user.organizationId);
  }

  @Post('sync/expenses')
  @Permissions('settings:manage')
  async syncExpenses(@CurrentUser() user: any) {
    const result = await this.syncService.syncExpenses(user.organizationId, user.sub);
    await this.syncService.updateLastSyncAt(user.organizationId);
    return result;
  }

  @Post('sync/service-items')
  @Permissions('settings:manage')
  async syncServiceItems(@CurrentUser() user: any) {
    const result = await this.syncService.syncServiceItems(user.organizationId);
    await this.syncService.updateLastSyncAt(user.organizationId);
    return result;
  }

  @Get('sync/history')
  @Permissions('settings:manage')
  async getSyncHistory(
    @CurrentUser() user: any,
    @Query('limit') limit?: string,
  ) {
    return this.qbService.getSyncHistory(
      user.organizationId,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Post('invoices')
  @Permissions('quotes:edit')
  async createInvoice(
    @Body() dto: QbCreateInvoiceDto,
    @CurrentUser() user: any,
  ) {
    return this.qbService.createInvoiceFromQuote(dto.quoteId, user.organizationId);
  }

  @Post('webhook')
  @Public()
  async webhook(
    @Headers('intuit-signature') signature: string,
    @Req() req: RawBodyRequest<any>,
    @Body() body: any,
  ) {
    const rawBody = req.rawBody?.toString('utf-8') ?? JSON.stringify(body);
    await this.webhookService.handleWebhook(body, signature ?? '', rawBody);
    return { ok: true };
  }
}
