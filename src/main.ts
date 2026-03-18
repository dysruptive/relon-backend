// Sentry must be initialized before any other imports
import './instrument';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { exec } from 'child_process';
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');
import { Logger } from 'nestjs-pino';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  try {
    // Validate required env vars on startup
    // Critical: server cannot function without these
    const criticalEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'ENCRYPTION_KEY'];
    const missingCritical = criticalEnvVars.filter(k => !process.env[k]);
    if (missingCritical.length > 0) {
      console.error(`Missing critical environment variables: ${missingCritical.join(', ')}`);
      process.exit(1);
    }
    // Warn (not fatal) about missing optional-but-important vars
    const warnEnvVars = ['RESEND_API_KEY', 'FRONTEND_URL', 'STRIPE_SECRET_KEY'];
    const missingWarn = warnEnvVars.filter(k => !process.env[k] || process.env[k]?.startsWith('your-'));
    if (missingWarn.length > 0) {
      console.warn(`WARNING: The following env vars are not configured: ${missingWarn.join(', ')}`);
    }

    console.log('Starting Relon CRM Backend...');
    console.log(`Node environment: ${process.env.NODE_ENV || 'development'}`);

    const app = await NestFactory.create(AppModule, {
      bufferLogs: true,
      rawBody: true,
    });
    app.useLogger(app.get(Logger));

    // Cookie parser (required for httpOnly JWT cookies)
    app.use(cookieParser());

    // Security headers
    app.use(helmet());

    // Enable CORS for the Next.js frontend
    // CORS_ORIGIN supports comma-separated values, e.g. "https://app.example.com,https://staging.example.com"
    const envOrigins = process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map((o) =>
          o.trim().replace(/\/$/, '')
        )
      : [];

    const allowedOrigins = [
      // Only allow localhost in non-production environments
      ...(process.env.NODE_ENV !== 'production' ? ['http://localhost:3000'] : []),
      ...envOrigins,
    ];

    console.log(`CORS enabled for origins: ${allowedOrigins.join(', ')}`);

    app.enableCors({
      origin: (origin, callback) => {
        // Allow requests with no origin (health checks, server-to-server, curl)
        if (!origin) return callback(null, true);

        // Remove trailing slash from origin for comparison
        const normalizedOrigin = origin.replace(/\/$/, '');

        if (
          allowedOrigins.some(
            (allowed) => allowed === normalizedOrigin
          )
        ) {
          callback(null, true);
        } else {
          console.warn(`CORS blocked origin: ${origin}`);
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    });

    // Global exception filter — converts raw Error throws to proper HTTP responses
    app.useGlobalFilters(new AllExceptionsFilter());

    // Global validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      })
    );

    // API prefix
    app.setGlobalPrefix('api');

    // Swagger/OpenAPI — only in non-production to avoid exposing internals
    if (process.env.NODE_ENV !== 'production') {
      const config = new DocumentBuilder()
        .setTitle('Relon CRM API')
        .setDescription('Multi-tenant B2B SaaS CRM for construction/services companies')
        .setVersion('1.0')
        .addBearerAuth()
        .addCookieAuth('access_token')
        .addTag('auth', 'Authentication & session management')
        .addTag('leads', 'Lead pipeline management')
        .addTag('clients', 'Client account management')
        .addTag('projects', 'Project management')
        .addTag('dashboard', 'Dashboard metrics & analytics')
        .addTag('reports', 'Advanced reporting')
        .addTag('billing', 'Subscription & billing management')
        .addTag('admin', 'Admin & user management')
        .addTag('ai', 'AI-powered features')
        .addTag('notifications', 'Real-time notifications')
        .addTag('health', 'Health checks')
        .build();
      const document = SwaggerModule.createDocument(app, config);
      SwaggerModule.setup('api/docs', app, document, {
        swaggerOptions: { persistAuthorization: true },
      });
      console.log(`Swagger UI available at http://localhost:${process.env.PORT || 4000}/api/docs`);
    }

    // Graceful shutdown
    app.enableShutdownHooks();

    const port = process.env.PORT || 4000;
    const host = '0.0.0.0';

    console.log(`Attempting to bind to ${host}:${port}...`);
    await app.listen(port, host);

    console.log(`Relon CRM Backend started on http://${host}:${port}`);
    console.log(`API available at http://${host}:${port}/api`);

    // Run migrations asynchronously after port is bound so healthcheck can pass immediately
    runMigrationsAsync();
  } catch (error) {
    console.error('❌ Failed to start application:');
    console.error(error);
    process.exit(1);
  }
}

function runMigrationsAsync() {
  const prismaBin = path.join(__dirname, '..', 'node_modules', '.bin', 'prisma');
  const cmd = `"${prismaBin}" migrate deploy`;
  console.log('🔄 Running database migrations in background...');
  exec(cmd, { cwd: path.join(__dirname, '..'), timeout: 120000 }, (error, stdout, stderr) => {
    if (stdout) console.log(`[migrations] ${stdout.trim()}`);
    if (stderr) console.warn(`[migrations] ${stderr.trim()}`);
    if (error) {
      console.error(`[migrations] ❌ Migration failed (code ${error.code}): ${error.message}`);
    } else {
      console.log('[migrations] ✅ Migrations complete');
    }
  });
}

bootstrap();
