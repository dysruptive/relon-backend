import { Controller, Post, Get, Body, Req, Headers, RawBodyRequest, UseGuards, Query } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { BillingService } from './billing.service';
import { PaystackBillingService } from './paystack-billing.service';

@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly paystackBillingService: PaystackBillingService,
  ) {}

  @Public()
  @Get('plans')
  getPlans(@Query('currency') currency?: string) {
    return this.billingService.getPlans(currency);
  }

  @UseGuards(JwtAuthGuard)
  @Get('current')
  getCurrentPlan(@CurrentUser() user: any) {
    return this.billingService.getCurrentPlan(user.organizationId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  createCheckout(
    @Body('planId') planId: string,
    @Body('interval') interval: 'month' | 'year' = 'month',
    @CurrentUser() user: any,
  ) {
    return this.billingService.createCheckoutSession(user.organizationId, planId, user.sub, interval);
  }

  @UseGuards(JwtAuthGuard)
  @Post('portal')
  createPortal(@CurrentUser() user: any) {
    return this.billingService.createPortalSession(user.organizationId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('cancel')
  cancelSubscription(@CurrentUser() user: any) {
    return this.billingService.cancelSubscription(user.organizationId);
  }

  // Stripe webhooks — NO JWT guard, raw body needed
  @Public()
  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    await this.billingService.handleWebhook(req.rawBody, signature);
    return { received: true };
  }

  // Paystack webhooks — NO JWT guard, raw body needed
  @Public()
  @Post('webhook/paystack')
  async handlePaystackWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-paystack-signature') signature: string,
  ) {
    await this.paystackBillingService.handleWebhook(req.rawBody, signature);
    return { received: true };
  }
}
