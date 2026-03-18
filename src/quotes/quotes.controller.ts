import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { QuotesService } from './quotes.service';
import { QuoteSettingsService } from './quote-settings.service';
import { PdfService } from './pdf.service';
import {
  CreateQuoteDto,
  UpdateQuoteDto,
  UpdateQuoteSettingsDto,
} from './dto/quotes.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../permissions/permissions.decorator';

@Controller('quotes')
export class QuotesController {
  constructor(
    private readonly quotesService: QuotesService,
    private readonly quoteSettingsService: QuoteSettingsService,
    private readonly pdfService: PdfService,
  ) {}

  @Get('settings')
  @Permissions('quotes:read')
  getSettings(@CurrentUser() user: any) {
    return this.quoteSettingsService.getSettings(user.organizationId);
  }

  @Patch('settings')
  @Permissions('quotes:edit')
  updateSettings(
    @Body() dto: UpdateQuoteSettingsDto,
    @CurrentUser() user: any,
  ) {
    return this.quoteSettingsService.updateSettings(user.organizationId, dto);
  }

  @Get()
  @Permissions('quotes:read')
  findAll(
    @CurrentUser() user: any,
    @Query('leadId') leadId?: string,
    @Query('clientId') clientId?: string,
    @Query('projectId') projectId?: string,
    @Query('status') status?: string,
  ) {
    return this.quotesService.findAll(user.organizationId, {
      leadId,
      clientId,
      projectId,
      status,
    });
  }

  @Get(':id/pdf')
  @Permissions('quotes:read')
  async downloadPdf(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const buffer = await this.pdfService.generateQuotePdf(
      id,
      user.organizationId,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="quote-${id}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get(':id/scope-pdf')
  @Permissions('quotes:read')
  async downloadScopePdf(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const buffer = await this.pdfService.generateScopePdf(
      id,
      user.organizationId,
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="scope-${id}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get(':id')
  @Permissions('quotes:read')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.quotesService.findOne(id, user.organizationId);
  }

  @Post()
  @Permissions('quotes:create')
  create(@Body() dto: CreateQuoteDto, @CurrentUser() user: any) {
    return this.quotesService.create(dto, user.id, user.organizationId);
  }

  @Patch(':id')
  @Permissions('quotes:edit')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateQuoteDto,
    @CurrentUser() user: any,
  ) {
    return this.quotesService.update(id, dto, user.organizationId);
  }

  @Delete(':id')
  @Permissions('quotes:delete')
  delete(@Param('id') id: string, @CurrentUser() user: any) {
    return this.quotesService.delete(id, user.organizationId);
  }

  @Post(':id/send')
  @Permissions('quotes:send')
  send(@Param('id') id: string, @CurrentUser() user: any) {
    return this.quotesService.send(id, user.organizationId);
  }

  @Post(':id/accept')
  @Permissions('quotes:edit')
  accept(@Param('id') id: string, @CurrentUser() user: any) {
    return this.quotesService.accept(id, user.organizationId);
  }

  @Post(':id/reject')
  @Permissions('quotes:edit')
  reject(@Param('id') id: string, @CurrentUser() user: any) {
    return this.quotesService.reject(id, user.organizationId);
  }
}
