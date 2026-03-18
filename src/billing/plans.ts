export const PLAN_LIMITS = {
  trial:   { maxUsers: 3,  maxLeads: 10,  maxClients: 5,   maxProjects: 5,   aiEnabled: false, reportsEnabled: false },
  starter: { maxUsers: 5,  maxLeads: 100, maxClients: 30,  maxProjects: 30,  aiEnabled: false, reportsEnabled: true },
  growth:  { maxUsers: 15, maxLeads: 500, maxClients: -1,  maxProjects: -1,  aiEnabled: true,  reportsEnabled: true },
  scale:   { maxUsers: -1, maxLeads: -1,  maxClients: -1,  maxProjects: -1,  aiEnabled: true,  reportsEnabled: true },
};

export const PLAN_META_USD = {
  trial:   { name: 'Trial',   price: 0,   currency: 'USD', interval: null,    description: '14-day free trial' },
  starter: { name: 'Starter', price: 49,  currency: 'USD', interval: 'month', description: 'For small teams' },
  growth:  { name: 'Growth',  price: 149, currency: 'USD', interval: 'month', description: 'For growing teams with AI' },
  scale:   { name: 'Scale',   price: 399, currency: 'USD', interval: 'month', description: 'Unlimited everything' },
};

export const PLAN_META_GHS = {
  trial:   { name: 'Trial',   price: 0,    currency: 'GHS', interval: null,    description: '14-day free trial' },
  starter: { name: 'Starter', price: 599,  currency: 'GHS', interval: 'month', description: 'For small teams' },
  growth:  { name: 'Growth',  price: 1799, currency: 'GHS', interval: 'month', description: 'For growing teams with AI' },
  scale:   { name: 'Scale',   price: 4799, currency: 'GHS', interval: 'month', description: 'Unlimited everything' },
};

// Paystack-supported countries mapped to currency
export const PAYSTACK_COUNTRIES: Record<string, string> = {
  GH: 'GHS',
  NG: 'NGN',
  ZA: 'ZAR',
  KE: 'KES',
};

// GHS pricing for Paystack-supported markets (Paystack amounts are in smallest unit: pesewas for GHS)
export const PLAN_META_BY_CURRENCY: Record<string, typeof PLAN_META_USD> = {
  USD: PLAN_META_USD,
  GHS: PLAN_META_GHS,
  NGN: { // Nigerian Naira prices
    trial:   { name: 'Trial',   price: 0,      currency: 'NGN', interval: null,    description: '14-day free trial' },
    starter: { name: 'Starter', price: 75000,  currency: 'NGN', interval: 'month', description: 'For small teams' },
    growth:  { name: 'Growth',  price: 220000, currency: 'NGN', interval: 'month', description: 'For growing teams with AI' },
    scale:   { name: 'Scale',   price: 599000, currency: 'NGN', interval: 'month', description: 'Unlimited everything' },
  },
  KES: {
    trial:   { name: 'Trial',   price: 0,     currency: 'KES', interval: null,    description: '14-day free trial' },
    starter: { name: 'Starter', price: 6500,  currency: 'KES', interval: 'month', description: 'For small teams' },
    growth:  { name: 'Growth',  price: 19500, currency: 'KES', interval: 'month', description: 'For growing teams with AI' },
    scale:   { name: 'Scale',   price: 52000, currency: 'KES', interval: 'month', description: 'Unlimited everything' },
  },
  ZAR: {
    trial:   { name: 'Trial',   price: 0,    currency: 'ZAR', interval: null,    description: '14-day free trial' },
    starter: { name: 'Starter', price: 899,  currency: 'ZAR', interval: 'month', description: 'For small teams' },
    growth:  { name: 'Growth',  price: 2799, currency: 'ZAR', interval: 'month', description: 'For growing teams with AI' },
    scale:   { name: 'Scale',   price: 7499, currency: 'ZAR', interval: 'month', description: 'Unlimited everything' },
  },
  // Default to USD for other currencies
};

export function getPlanMeta(currency: string) {
  return PLAN_META_BY_CURRENCY[currency] || PLAN_META_USD;
}

// Legacy export used by existing BillingService.getPlans()
export const PLAN_META = PLAN_META_USD;
