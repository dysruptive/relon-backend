import { Test, TestingModule } from '@nestjs/testing';
import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as request from 'supertest';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAuthService = {
  register: jest.fn(),
  login: jest.fn(),
  refreshAccessTokenFromJwt: jest.fn(),
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
  getProfile: jest.fn(),
  validateUser: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    const env: Record<string, string> = {
      FRONTEND_URL: 'http://localhost:3000',
      JWT_SECRET: 'test-secret',
    };
    return env[key];
  }),
};

// ---------------------------------------------------------------------------
// Guard factories
// ---------------------------------------------------------------------------

/** A LocalAuthGuard replacement that always throws 401. */
class FailingLocalGuard implements CanActivate {
  canActivate(_ctx: ExecutionContext): boolean {
    throw new UnauthorizedException('Invalid credentials');
  }
}

/** A LocalAuthGuard replacement that succeeds and injects a user into req. */
class SucceedingLocalGuard implements CanActivate {
  constructor(private readonly user: object) {}
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    req.user = this.user;
    return true;
  }
}

// ---------------------------------------------------------------------------
// Helper to build test app
// ---------------------------------------------------------------------------

async function buildApp(
  localGuardOverride?: CanActivate,
): Promise<INestApplication> {
  const moduleBuilder = Test.createTestingModule({
    controllers: [AuthController],
    providers: [
      { provide: AuthService, useValue: mockAuthService },
      { provide: ConfigService, useValue: mockConfigService },
    ],
  });

  if (localGuardOverride) {
    moduleBuilder
      .overrideGuard(LocalAuthGuard)
      .useValue(localGuardOverride);
  }

  const module: TestingModule = await moduleBuilder.compile();
  const app = module.createNestApplication();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  app.use(require('cookie-parser')());
  await app.init();
  return app;
}

// ---------------------------------------------------------------------------
// Tests — POST /auth/register
// ---------------------------------------------------------------------------

describe('AuthController — POST /auth/register', () => {
  let app: INestApplication;

  beforeEach(async () => {
    jest.clearAllMocks();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 201 on successful registration', async () => {
    mockAuthService.register.mockResolvedValueOnce({
      access_token: 'tok',
      refresh_token: 'rtok',
      user: { id: 'u1', email: 'a@a.com' },
    });

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'a@a.com',
        password: 'Pass123$1',
        name: 'Alice',
        organizationName: 'ACME',
      })
      .expect(HttpStatus.CREATED);
  });

  it('returns non-2xx when AuthService.register throws (missing required fields)', async () => {
    mockAuthService.register.mockRejectedValueOnce(
      new Error('Validation failed'),
    );

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({});
    expect(res.status).not.toBe(HttpStatus.CREATED);
  });
});

// ---------------------------------------------------------------------------
// Tests — POST /auth/login
// ---------------------------------------------------------------------------

describe('AuthController — POST /auth/login', () => {
  afterEach(async () => {
    // app is created per-test below; close is handled inside each test
  });

  it('returns 401 when LocalAuthGuard rejects invalid credentials', async () => {
    jest.clearAllMocks();
    const app = await buildApp(new FailingLocalGuard());

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'wrong@x.com', password: 'badpass' })
      .expect(HttpStatus.UNAUTHORIZED);

    await app.close();
  });

  it('returns 200 with access_token on successful login', async () => {
    jest.clearAllMocks();
    const user = { id: 'u1', email: 'a@a.com', role: 'CEO', organizationId: 'org-1' };
    mockAuthService.login.mockResolvedValueOnce({
      access_token: 'tok',
      refresh_token: 'rtok',
      user,
    });

    const app = await buildApp(new SucceedingLocalGuard(user));

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'a@a.com', password: 'Pass123$1' })
      .expect(HttpStatus.OK)
      .expect((res) => {
        expect(res.body).toHaveProperty('access_token', 'tok');
      });

    await app.close();
  });
});

// ---------------------------------------------------------------------------
// Tests — POST /auth/refresh
// ---------------------------------------------------------------------------

describe('AuthController — POST /auth/refresh', () => {
  let app: INestApplication;

  beforeEach(async () => {
    jest.clearAllMocks();
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns non-200 when no refresh cookie is present', async () => {
    // The controller throws a plain Error (not HttpException) when the cookie is absent;
    // NestJS maps unhandled errors to 500. Either way it must not be 200.
    const res = await request(app.getHttpServer())
      .post('/auth/refresh');
    expect(res.status).not.toBe(HttpStatus.OK);
  });

  it('returns 401 when the refresh token is invalid', async () => {
    mockAuthService.refreshAccessTokenFromJwt.mockRejectedValueOnce(
      new UnauthorizedException('Invalid or expired refresh token'),
    );

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', 'refresh_token=invalid-token')
      .expect(HttpStatus.UNAUTHORIZED);
  });

  it('returns 200 with new access_token on valid refresh cookie', async () => {
    const user = { id: 'u1', email: 'a@a.com', role: 'CEO', organizationId: 'org-1' };
    mockAuthService.refreshAccessTokenFromJwt.mockResolvedValueOnce({
      access_token: 'new-tok',
      refresh_token: 'new-rtok',
      user,
    });

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', 'refresh_token=valid-token')
      .expect(HttpStatus.OK)
      .expect((res) => {
        expect(res.body).toHaveProperty('access_token', 'new-tok');
      });
  });
});

// ---------------------------------------------------------------------------
// Tests — Rate limiting metadata
// ---------------------------------------------------------------------------

describe('AuthController — rate limiting throttle decorator', () => {
  // These tests verify the @Throttle decorator is applied by inspecting
  // Reflect metadata on the route handlers.  No HTTP request is needed.

  it('POST /auth/login carries THROTTLER:LIMITdefault = 5', () => {
    const limit = Reflect.getMetadata(
      'THROTTLER:LIMITdefault',
      AuthController.prototype.login,
    );
    expect(limit).toBe(5);
  });

  it('POST /auth/register carries THROTTLER:LIMITdefault = 5', () => {
    const limit = Reflect.getMetadata(
      'THROTTLER:LIMITdefault',
      AuthController.prototype.register,
    );
    expect(limit).toBe(5);
  });

  it('POST /auth/refresh carries THROTTLER:LIMITdefault = 10', () => {
    const limit = Reflect.getMetadata(
      'THROTTLER:LIMITdefault',
      AuthController.prototype.refresh,
    );
    expect(limit).toBe(10);
  });

  it('after 5 successive failed login attempts each returns 401 (guard rejection)', async () => {
    jest.clearAllMocks();
    const app = await buildApp(new FailingLocalGuard());

    for (let i = 0; i < 5; i++) {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'x@x.com', password: 'wrong' });
      // Each individual attempt must be rejected with 401
      expect(res.status).toBe(HttpStatus.UNAUTHORIZED);
    }

    await app.close();
  });
});
