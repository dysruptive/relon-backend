import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BillingService } from './billing.service';
import { PrismaService } from '../database/prisma.service';
import { PaystackBillingService } from './paystack-billing.service';
import { EmailService } from '../email/email.service';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrisma = {
  organization: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  user: {
    count: jest.fn().mockResolvedValue(1),
    findFirst: jest.fn(),
  },
  lead: { count: jest.fn().mockResolvedValue(0) },
  client: { count: jest.fn().mockResolvedValue(0) },
  project: { count: jest.fn().mockResolvedValue(0) },
};

const mockConfig = {
  get: jest.fn((key: string) => {
    const env: Record<string, string> = {
      STRIPE_SECRET_KEY: 'sk_test_stub',
      STRIPE_WEBHOOK_SECRET: 'whsec_test_stub',
      FRONTEND_URL: 'http://localhost:3000',
      STRIPE_PRICE_ID_STARTER: 'price_starter',
      STRIPE_PRICE_ID_GROWTH: 'price_growth',
      STRIPE_PRICE_ID_SCALE: 'price_scale',
    };
    return env[key] ?? undefined;
  }),
};

const mockEmail = { sendPaymentFailedEmail: jest.fn().mockResolvedValue(undefined) };
const mockPaystack = {};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BillingService — Stripe webhook handler', () => {
  let service: BillingService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: PaystackBillingService, useValue: mockPaystack },
        { provide: EmailService, useValue: mockEmail },
      ],
    }).compile();

    service = module.get(BillingService);
  });

  // Accessing private stripe instance requires casting
  function stubWebhook(payload: object, mockStripe: object) {
    (service as any).stripe = {
      webhooks: {
        constructEvent: jest.fn().mockReturnValue(payload),
      },
      ...mockStripe,
    };
  }

  describe('invoice.paid handler', () => {
    it('sets planStatus to active when org is past_due', async () => {
      const org = { id: 'org-1', planStatus: 'past_due' };
      mockPrisma.organization.findFirst.mockResolvedValueOnce(org);

      stubWebhook(
        {
          type: 'invoice.paid',
          data: { object: { customer: 'cus_123' } },
        },
        {},
      );

      await service.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockPrisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ planStatus: 'active' }),
        }),
      );
    });

    it('does nothing when org is already active', async () => {
      const org = { id: 'org-1', planStatus: 'active' };
      mockPrisma.organization.findFirst.mockResolvedValueOnce(org);

      stubWebhook(
        {
          type: 'invoice.paid',
          data: { object: { customer: 'cus_123' } },
        },
        {},
      );

      await service.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockPrisma.organization.update).not.toHaveBeenCalled();
    });
  });

  describe('customer.subscription.updated — status mapping', () => {
    async function testStatusMapping(stripeStatus: string, expectedPlanStatus: string) {
      // handleWebhook calls findUnique once to get existingOrg for pastDueSince tracking
      mockPrisma.organization.findUnique
        .mockResolvedValueOnce({ id: 'org-1', planStatus: 'active', pastDueSince: null });

      stubWebhook(
        {
          type: 'customer.subscription.updated',
          data: {
            object: {
              status: stripeStatus,
              metadata: { organizationId: 'org-1', planId: 'growth' },
            },
          },
        },
        {},
      );

      await service.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockPrisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ planStatus: expectedPlanStatus }),
        }),
      );
    }

    it('maps active → active', () => testStatusMapping('active', 'active'));
    it('maps past_due → past_due', () => testStatusMapping('past_due', 'past_due'));
    it('maps canceled → cancelled', () => testStatusMapping('canceled', 'cancelled'));
    it('maps unpaid → suspended (not active!)', () => testStatusMapping('unpaid', 'suspended'));
    it('maps incomplete → past_due', () => testStatusMapping('incomplete', 'past_due'));
    it('maps unknown_status → suspended (safe default)', () =>
      testStatusMapping('some_unknown_status', 'suspended'));
  });

  describe('invoice.payment_failed handler', () => {
    it('sets planStatus to past_due and notifies CEO', async () => {
      const org = { id: 'org-1' };
      const ceo = { email: 'ceo@example.com', name: 'CEO' };
      mockPrisma.organization.findFirst.mockResolvedValueOnce(org);
      mockPrisma.user.findFirst.mockResolvedValueOnce(ceo);

      stubWebhook(
        {
          type: 'invoice.payment_failed',
          data: { object: { customer: 'cus_123' } },
        },
        {},
      );

      await service.handleWebhook(Buffer.from('{}'), 'sig');

      expect(mockPrisma.organization.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { planStatus: 'past_due' } }),
      );
      expect(mockEmail.sendPaymentFailedEmail).toHaveBeenCalledWith(
        ceo.email,
        ceo.name,
      );
    });
  });
});

describe('BillingService — plan limits', () => {
  let service: BillingService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: PaystackBillingService, useValue: mockPaystack },
        { provide: EmailService, useValue: mockEmail },
      ],
    }).compile();
    service = module.get(BillingService);
  });

  it('returns allowed=false when lead count >= limit', async () => {
    // Use mockResolvedValue (permanent) to override any leaked queue state
    mockPrisma.organization.findUnique.mockResolvedValue({ plan: 'trial' });
    mockPrisma.lead.count.mockResolvedValue(10); // trial limit is 10

    const result = await service.checkPlanLimit('org-1', 'leads');
    expect(result.allowed).toBe(false);
    expect(result.current).toBe(10);
    expect(result.limit).toBe(10);
  });

  it('returns allowed=true for unlimited plans (scale)', async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({ plan: 'scale' });

    const result = await service.checkPlanLimit('org-1', 'leads');
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(-1);
  });
});
