# Relon CRM — Claude Code Instructions

## Project Overview
A multi-tenant B2B SaaS CRM for construction/services companies. Two-tier architecture:
- **Backend**: NestJS + Prisma + PostgreSQL (Neon), at `backend/`
- **Frontend**: Next.js 16 (App Router), at `frontend/`
- **DB**: Neon PostgreSQL — always use `npm run prisma:*` scripts, never global `npx prisma`

---

## Agent & Subagent Usage

### Always use subagents for codebase exploration
Never explore the codebase directly in the main context. Always delegate to a subagent:
- **Codebase exploration / mapping**: use `subagent_type: feature-dev:code-explorer` or `codebase-explorer`
- **Architecture / planning**: use `subagent_type: feature-dev:code-architect` or `Plan`
- **Quick targeted search** (single known file/symbol): Glob or Grep directly is fine

<!-- ### Always use agents for large implementation tasks
Any task touching more than 2–3 files, or requiring both backend + frontend changes, must be delegated to an implementation agent:
- **Full-stack features**: `subagent_type: voltagent-core-dev:fullstack-developer`
- **Backend-only**: `subagent_type: voltagent-core-dev:backend-developer`
- **Frontend-only**: `subagent_type: voltagent-core-dev:frontend-developer` -->

### Use MCP plugins where available
When working with third-party services, prefer their MCP plugin over writing raw API calls manually:
- **Stripe**: use the Stripe MCP for creating products, prices, and inspecting webhook events
- Check available MCPs with `ToolSearch` before implementing any external service integration

### Pattern
1. **Explore** (subagent) → understand what exists
2. **Plan** (subagent or inline for small tasks) → design the approach
3. **Implement** (agent) → write the code
4. **Verify** — always run `npm run typecheck` on both sides after implementation

---

## Key Commands

```bash
# Backend (run from backend/)
cd backend && npm install
npm run prisma:generate    # regenerate Prisma client after schema changes
npm run prisma:deploy      # apply pending migrations (production/CI)
npm run prisma:migrate     # create + apply migration (dev only, needs TTY)
npm run prisma:seed        # seed demo data
npm run typecheck          # must pass before committing

# Frontend (run from frontend/)
cd frontend && npm install
npm run typecheck          # must pass before committing
```

Always verify **zero TypeScript errors** on both sides after any change.

---

## Frontend Standards

### UI Components — shadcn/ui ONLY
This project uses **shadcn/ui (New York style)** with Tailwind CSS. Every UI element must use the shadcn component — never a raw HTML equivalent.

| Need | Use | Never use |
|------|-----|-----------|
| Dropdown / select | `<Select>` + `<SelectTrigger>` + `<SelectContent>` + `<SelectItem>` | `<select>` |
| Button | `<Button variant="...">` | `<button>` |
| Text input | `<Input>` | `<input>` |
| Textarea | `<Textarea>` | `<textarea>` |
| Checkbox | `<Checkbox>` | `<input type="checkbox">` |
| Modal / overlay | `<Dialog>` + `<DialogContent>` | `<div>` overlay hacks |
| Notification | `toast()` from `sonner` | `alert()` |
| Loading skeleton | `<Skeleton>` | custom CSS shimmer |
| Progress bar | `<Progress>` | custom `<div>` |
| Tabs | `<Tabs>` + `<TabsList>` + `<TabsTrigger>` + `<TabsContent>` | custom tab state |
| Badge / chip | `<Badge>` | styled `<span>` |
| Tooltip | `<Tooltip>` + `<TooltipContent>` | `title` attribute |
| Collapsible | `<Collapsible>` | toggle state + conditional render |

Available components in `frontend/components/ui/`:
`alert-dialog`, `alert`, `avatar`, `badge`, `button`, `calendar`, `card`, `checkbox`, `collapsible`, `data-table`, `date-picker`, `date-range-picker`, `dialog`, `dropdown-menu`, `form`, `input`, `label`, `popover`, `progress`, `scroll-area`, `select`, `separator`, `sheet`, `sidebar`, `skeleton`, `sonner`, `table`, `tabs`, `textarea`, `tooltip`

### Form Pattern (react-hook-form + shadcn Form)
Always use `<Form>`, `<FormField>`, `<FormItem>`, `<FormLabel>`, `<FormControl>`, `<FormMessage>` wrappers. For Select inside a form:

```tsx
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

<FormField
  control={form.control}
  name="fieldName"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Label</FormLabel>
      <Select onValueChange={field.onChange} value={field.value} disabled={isLoading}>
        <FormControl>
          <SelectTrigger>
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          <SelectItem value="foo">Foo</SelectItem>
        </SelectContent>
      </Select>
      <FormMessage />
    </FormItem>
  )}
/>
```

### Styling Rules
- **Tailwind CSS only** — no inline `style={{}}` except for dynamic values (e.g. chart colors, percentage widths)
- **CSS variables** for theming — use `text-muted-foreground`, `bg-background`, `border-border`, etc.
- **Conditional classes** — always use `cn()` from `@/lib/utils`, not string concatenation
- **Fonts**: body = `font-sans` (Inter), headings = `font-display` (Sora)
- **Brand gold accent**: `#b8873a` — used for CTAs, highlights
- **Chart colors**: `['#b8873a', '#4f9cf9', '#22c55e', '#f59e0b', '#a78bfa', '#f43f5e', '#06b6d4']`

### Data Fetching
- Use `@tanstack/react-query` (`useQuery`, `useMutation`) for all server state
- Query keys follow the pattern: `['resource-name', filters]`
- API calls live in `frontend/lib/api/` — add new endpoints there, not inline in components

### File / Folder Conventions
- Pages: `frontend/app/(dashboard)/[route]/page.tsx` — thin wrappers that render a View component
- View components: `frontend/components/[domain]/[Domain]View.tsx`
- Shared UI: `frontend/components/ui/` (shadcn only)
- Types: `frontend/lib/types.ts`
- API clients: `frontend/lib/api/client.ts` (main), `auth-client.ts`, `dashboard.ts`, `reports.ts`
- Hooks: `frontend/hooks/`
- Auth context: `frontend/contexts/auth-context.tsx`

### Modular Code Architecture — CRITICAL
**Always write modular code.** Never put all functionality into a single large file. Break components and services into focused, single-responsibility files:

**For Components:**
- Create a folder for the feature: `frontend/components/[domain]/[FeatureName]/`
- Split into sub-components: `Header.tsx`, `Content.tsx`, `Footer.tsx`, `Dialog.tsx`, etc.
- Keep each file under 300 lines for readability and maintainability
- Export from an `index.ts` for clean imports: `export { Header } from './Header'; export { Content } from './Content';`
- Parent component imports: `import { Header, Content } from './[FeatureName]';`

**For Hooks:**
- One hook per file: `frontend/hooks/useFetch.ts`, `useValidation.ts`, `useNotification.ts`
- Custom hooks are small, focused, and reusable

**For Services/Utils:**
- Break large services into domain-specific files: `frontend/lib/utils/format.ts`, `validation.ts`, `transform.ts`
- Each file handles one concern
- Export small, composable functions

**Anti-pattern (❌ Never do this):**
- 1000+ line component files with mixed concerns
- Everything in `[DomainView].tsx` — UI, forms, logic, data fetching all together
- Multiple unrelated features in the same file

**Pattern (✅ Do this):**
```
frontend/components/leads/
├── LeadsView.tsx (thin parent, <100 lines)
├── LeadsList.tsx
├── LeadsFilters.tsx
├── LeadTable.tsx
├── EditLeadDialog.tsx
├── DeleteConfirmation.tsx
└── index.ts
```

Similar approach for backend: each controller, service, and module stays focused on a single feature.

---

## Backend Standards

### Multi-Tenancy — Critical Rule
**Every** database query on a tenant-scoped model MUST include `organizationId` in the `where` clause. Models that are tenant-scoped: `User`, `Lead`, `LeadRep`, `Client`, `Project`, `Activity`, `File`, `Team`, `PipelineStage`, `RolePermission`, `AISettings`, `AuditLog`, `StageHistory`, `CostLog`, `ProjectStatusHistory`, `DropdownOption`, `ServiceType`.

`organizationId` comes from `user.organizationId` on the JWT (via `@CurrentUser()` decorator).

```typescript
// ✅ Correct
findAll(organizationId: string) {
  return this.prisma.lead.findMany({ where: { organizationId } });
}

// ❌ Wrong — never query without org scope
findAll() {
  return this.prisma.lead.findMany();
}
```

### Controller Pattern
```typescript
@Get()
@RequirePermissions('leads:read')
findAll(@CurrentUser() user: any) {
  return this.leadsService.findAll(user.organizationId);
}
```

- `@CurrentUser()` is at `src/auth/decorators/current-user.decorator.ts`
- `@RequirePermissions()` is from `src/permissions/permissions.guard.ts`
- `@Public()` is at `src/auth/decorators/public.decorator.ts` — use for unauthenticated endpoints
- Global `JwtAuthGuard` is applied in `AppModule` — all endpoints require auth unless marked `@Public()`

### DTO Validation
Use `class-validator` decorators on all DTOs. The global `ValidationPipe` has `whitelist: true` and `forbidNonWhitelisted: true` — any undeclared field in a DTO will be rejected.

> **Note:** When making fixes from a file, do **not** add fix numbers as comments in the code.

### Prisma Migrations (v7)
- **Never** use global `npx prisma` — always use `npm run prisma:*` scripts
- **Prisma v7 change**: `migrate dev` no longer auto-runs `prisma generate` or the seed script. After any migration, you must run `npm run prisma:generate` and `npm run prisma:seed` explicitly.
- For new columns with existing data: create migration manually in `prisma/migrations/[timestamp]_[name]/migration.sql` and apply with `npm run prisma:deploy` (not `migrate dev` — it requires interactive TTY)
- When adding NOT NULL columns: add as nullable first, backfill, then make NOT NULL
- After migration: always run `npm run prisma:generate`
- `prisma.config.ts` (at `backend/prisma.config.ts`) configures the schema path and uses `DIRECT_URL` (non-pooled) for migrations — required for Neon with PgBouncer

Applied migrations:
1. `20260221205119_init`
2. `20260224110441_add_executing_company`
3. `20260224120000_add_multi_tenancy`
4. `20260224130000_add_oauth_fields`
5. `20260224140000_add_paystack_fields`

### Module Structure
Each feature module follows: `[name].module.ts`, `[name].service.ts`, `[name].controller.ts`. Services contain business logic; controllers are thin routing layers only.

---

## Authentication & Authorization

### JWT Payload
```typescript
{ email, sub: userId, role, organizationId }
```

### Roles
`CEO` | `ADMIN` | `BDM` | `SALES` | `DESIGNER` | `QS`

CEO bypasses all permission checks. Other roles are checked via `RolePermission` table (per-org).

### OAuth Flow
- Existing user → issue JWT → redirect to `FRONTEND_URL/auth/callback?token=`
- New user → 15-min pending JWT → redirect to `FRONTEND_URL/auth/oauth-complete?pending_token=`
- Completion page collects `organizationName` → `POST /auth/oauth/complete`

---

## Billing Architecture

### Provider Routing
| Country | Provider | Currency |
|---------|----------|----------|
| GH | Paystack | GHS (₵) |
| NG | Paystack | NGN (₦) |
| KE | Paystack | KES (KSh) |
| ZA | Paystack | ZAR (R) |
| Everything else | Stripe | USD ($) |

Routing logic is in `BillingService.isPaystackOrg(org.country)`.

### Plan Tiers
| Plan | USD | GHS | Limits |
|------|-----|-----|--------|
| trial | free | free | 3 users, 10 leads, no AI |
| starter | $49/mo | ₵599/mo | 5 users, 100 leads, no AI |
| growth | $149/mo | ₵1,799/mo | 15 users, 500 leads, AI on |
| scale | $399/mo | ₵4,799/mo | unlimited, all features |

### Webhook Endpoints
- Stripe: `POST /billing/webhook` (raw body, `stripe-signature` header)
- Paystack: `POST /billing/webhook/paystack` (raw body, `x-paystack-signature` header, HMAC-SHA512)

---

## AI Architecture

### Provider Resolution (per-org)
`AiService` reads `AISettings` per org → decrypts API keys (AES-256-CBC) → instantiates provider with org key (falls back to env var). 5-minute cache.

### Supported Providers
`anthropic` (claude-sonnet-4-5) | `openai` (gpt-4o) | `gemini` (gemini-2.0-flash-exp)

### AI Features & Permissions
- Lead risk analysis: `POST /leads/:id/analyze`
- Email drafting: `POST /leads/:id/draft-email`
- Client health: `POST /clients/:id/health`
- Upsell strategy: `POST /clients/:id/upsell`
- Pipeline insights: `GET /dashboard/pipeline-insights`
- Executive summary: `POST /ai/executive-summary`
- Chat: `POST /ai/chat`

AI features are gated by `planInfo.limits.aiEnabled` (growth + scale only).

---

## Environment Variables

### Backend `.env` required keys
```
DATABASE_URL, DIRECT_URL
JWT_SECRET, JWT_EXPIRES_IN
RESEND_API_KEY, RESEND_FROM_EMAIL
FRONTEND_URL, CORS_ORIGIN
ENCRYPTION_KEY                          # AES-256 key for AI API key encryption
OPENAI_API_KEY, AI_DEFAULT_PROVIDER
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
STRIPE_PRICE_ID_STARTER/GROWTH/SCALE
PAYSTACK_SECRET_KEY, PAYSTACK_WEBHOOK_SECRET
PAYSTACK_PLAN_CODE_{PLAN}_{CURRENCY}    # e.g. PAYSTACK_PLAN_CODE_STARTER_GHS
GOOGLE_CLIENT_ID/SECRET, GOOGLE_CALLBACK_URL
MICROSOFT_CLIENT_ID/SECRET/TENANT_ID, MICROSOFT_CALLBACK_URL
```

### Frontend `.env.local`
```
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

---

## Demo Credentials
All seeded users have password: `Pass123$1`
- CEO: `ceo@relon.com`
- Admin: `admin@relon.com`
- BDM: `manager@relon.com` / `manager2@relon.com`
- Sales: `sales@relon.com` / `sales2@relon.com` / `sales3@relon.com`
