---
name: full-stack-scaffold
description: >
  Generate complete full-stack project scaffolding for React + Node.js + PostgreSQL
  applications. Includes frontend, backend, database, auth, testing, CI/CD,
  Docker, and documentation templates.
  Not for: mobile apps, serverless architectures, or non-JavaScript stacks.
---

# Full-Stack Scaffold Skill

This skill generates production-ready full-stack project scaffolding. It covers
every layer of the application from database schema to deployment configuration.
The generated scaffold follows industry best practices and is designed to be
immediately runnable with a single `docker-compose up` command.

## Prerequisites

Before invoking this skill, ensure the following tools are available in the
host environment. The skill will validate their presence before proceeding.

- Node.js >= 18.0.0
- npm >= 9.0.0 or yarn >= 1.22.0 or pnpm >= 8.0.0
- Docker >= 24.0.0
- Docker Compose >= 2.20.0
- PostgreSQL client (psql) >= 15.0
- Git >= 2.40.0
- OpenSSL for certificate generation

## Output Format

The skill outputs a directory tree with the following top-level structure:

```
<project-name>/
  frontend/          # React or Next.js application
  backend/           # Express or Fastify API server
  database/          # SQL migrations and seed files
  docker/            # Dockerfiles and compose configs
  .github/           # GitHub Actions workflows
  .gitlab/           # GitLab CI configuration
  docs/              # Generated API docs and README
  scripts/           # Utility and deployment scripts
  .vscode/           # Editor configuration
  .husky/            # Git hooks
```

---

## Step 1: Project Initialization and Directory Structure

Create the root project directory with all necessary subdirectories and
initialize the monorepo structure. This step also sets up the workspace
configuration for the chosen package manager.

```bash
mkdir -p {{project-name}}
cd {{project-name}}

# Create all top-level directories
mkdir -p frontend/src/{components,hooks,pages,utils,styles,assets,context,services}
mkdir -p frontend/public
mkdir -p frontend/tests/{unit,integration,e2e}
mkdir -p backend/src/{routes,controllers,models,middleware,services,utils,validators}
mkdir -p backend/tests/{unit,integration,e2e}
mkdir -p database/{migrations,seeds,scripts}
mkdir -p docker/{nginx,postgres,redis}
mkdir -p .github/workflows
mkdir -p .gitlab
mkdir -p docs/{api,architecture,deployment}
mkdir -p scripts/{deploy,db,monitoring}
mkdir -p .vscode
mkdir -p .husky

# Initialize root package.json for monorepo workspaces
cat > package.json << 'ROOTPKG'
{
  "name": "{{project-name}}",
  "version": "0.1.0",
  "private": true,
  "workspaces": ["frontend", "backend"],
  "scripts": {
    "dev": "concurrently \"npm run dev:frontend\" \"npm run dev:backend\"",
    "dev:frontend": "npm -w frontend run dev",
    "dev:backend": "npm -w backend run dev",
    "build": "npm -w frontend run build && npm -w backend run build",
    "test": "npm -w frontend run test && npm -w backend run test",
    "lint": "npm -w frontend run lint && npm -w backend run lint",
    "db:migrate": "npm -w backend run db:migrate",
    "db:seed": "npm -w backend run db:seed",
    "docker:up": "docker-compose up -d",
    "docker:down": "docker-compose down"
  },
  "devDependencies": {
    "concurrently": "^8.2.0"
  }
}
ROOTPKG

npm install
```

This creates a well-organized monorepo that can be managed with npm workspaces.
The concurrently package allows running frontend and backend dev servers in
parallel from a single terminal command.

---

## Step 2: Git Initialization and Configuration

Set up version control with a comprehensive .gitignore covering all layers
of the stack, and configure branch protection rules for the repository.

```bash
git init
git branch -M main

# Generate comprehensive .gitignore
cat > .gitignore << 'GITIGNORE'
# Dependencies
node_modules/
.pnp
.pnp.js

# Build outputs
frontend/build/
frontend/.next/
frontend/out/
backend/dist/
*.tsbuildinfo

# Environment files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
*.env

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
logs/
*.log

# OS files
.DS_Store
Thumbs.db

# IDE
.idea/
*.swp
*.swo
*~

# Test coverage
coverage/
.nyc_output/

# Docker volumes
docker/postgres/data/
docker/redis/data/

# Secrets and certificates
*.pem
*.key
*.cert
*.p12
secrets/
GITIGNORE

# Configure git attributes for consistent line endings
cat > .gitattributes << 'GITATTR'
* text=auto eol=lf
*.{cmd,[cC][mM][dD]} text eol=crlf
*.{bat,[bB][aA][tT]} text eol=crlf
*.png binary
*.jpg binary
*.gif binary
*.ico binary
*.woff binary
*.woff2 binary
GITATTR

git add -A
git commit -m "chore: initial project structure"
```

The gitignore covers Node.js dependencies, build artifacts, environment secrets,
OS-specific files, IDE configurations, test coverage output, and Docker volume
data. The gitattributes file ensures consistent line endings across platforms.

---

## Step 3: React Frontend Setup (Create React App Variant)

Initialize the React frontend with TypeScript, configure the development
environment, and set up the basic application shell with routing and state
management scaffolding.

```bash
cd frontend

cat > package.json << 'FRONTPKG'
{
  "name": "{{project-name}}-frontend",
  "version": "0.1.0",
  "private": true,
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "axios": "^1.6.0",
    "@tanstack/react-query": "^5.8.0",
    "zustand": "^4.4.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "@vitejs/plugin-react": "^4.2.0",
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.1.0",
    "@testing-library/jest-dom": "^6.1.0",
    "@testing-library/user-event": "^14.5.0"
  },
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src --ext .ts,.tsx"
  }
}
FRONTPKG

# TypeScript configuration for the frontend
cat > tsconfig.json << 'TSCONFIG'
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@hooks/*": ["src/hooks/*"],
      "@utils/*": ["src/utils/*"],
      "@services/*": ["src/services/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
TSCONFIG

# Vite configuration with proxy to backend
cat > vite.config.ts << 'VITECONFIG'
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@utils': path.resolve(__dirname, './src/utils'),
      '@services': path.resolve(__dirname, './src/services'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
VITECONFIG

npm install
```

The frontend uses Vite for fast development builds, React Router for navigation,
TanStack Query for server state management, and Zustand for client state. Path
aliases are configured for cleaner imports throughout the application.

---

## Step 4: Next.js Frontend Variant

If the user selects Next.js instead of plain React, this alternative step
configures a Next.js application with App Router, server components, and
built-in API route support.

```bash
cd frontend

npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git

# Additional Next.js dependencies
npm install @tanstack/react-query zustand axios next-auth @next-auth/prisma-adapter

# Next.js configuration with security headers and image domains
cat > next.config.js << 'NEXTCONFIG'
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['localhost', '{{project-domain}}'],
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: 'http://localhost:4000/api/v1/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
NEXTCONFIG
```

The Next.js variant includes security headers by default, image optimization
configuration, and API rewrites to proxy backend requests during development.
NextAuth is pre-installed for authentication integration.

---

## Step 5: Express Backend Setup

Initialize the Express.js backend with TypeScript, structured routing,
middleware stack, and database connection pooling.

```bash
cd backend

cat > package.json << 'BACKPKG'
{
  "name": "{{project-name}}-backend",
  "version": "0.1.0",
  "private": true,
  "dependencies": {
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "morgan": "^1.10.0",
    "compression": "^1.7.4",
    "express-rate-limit": "^7.1.0",
    "pg": "^8.11.0",
    "pg-pool": "^3.6.0",
    "redis": "^4.6.0",
    "jsonwebtoken": "^9.0.0",
    "bcryptjs": "^2.4.3",
    "passport": "^0.7.0",
    "passport-jwt": "^4.0.1",
    "passport-google-oauth20": "^2.0.0",
    "joi": "^17.11.0",
    "winston": "^3.11.0",
    "dotenv": "^16.3.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/cors": "^2.8.0",
    "@types/morgan": "^1.9.0",
    "@types/compression": "^1.7.0",
    "@types/pg": "^8.10.0",
    "@types/jsonwebtoken": "^9.0.0",
    "@types/bcryptjs": "^2.4.0",
    "@types/passport": "^1.0.0",
    "@types/passport-jwt": "^4.0.0",
    "@types/passport-google-oauth20": "^2.0.0",
    "@types/uuid": "^9.0.0",
    "typescript": "^5.3.0",
    "tsx": "^4.6.0",
    "vitest": "^1.0.0",
    "supertest": "^6.3.0",
    "@types/supertest": "^2.0.0",
    "nodemon": "^3.0.0"
  },
  "scripts": {
    "dev": "nodemon --exec tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src --ext .ts",
    "db:migrate": "tsx database/scripts/migrate.ts",
    "db:seed": "tsx database/scripts/seed.ts",
    "db:reset": "tsx database/scripts/reset.ts"
  }
}
BACKPKG

# Backend TypeScript configuration
cat > tsconfig.json << 'TSCONFIG'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "baseUrl": ".",
    "paths": {
      "@routes/*": ["src/routes/*"],
      "@controllers/*": ["src/controllers/*"],
      "@models/*": ["src/models/*"],
      "@middleware/*": ["src/middleware/*"],
      "@services/*": ["src/services/*"],
      "@utils/*": ["src/utils/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
TSCONFIG

# Main application entry point with full middleware stack
cat > src/index.ts << 'ENTRYPOINT'
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { healthRouter } from './routes/health';
import { authRouter } from './routes/auth';
import { apiRouter } from './routes/api';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({ origin: config.corsOrigins, credentials: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Request processing
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Routes
app.use('/health', healthRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/v1', apiRouter);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(config.port, () => {
  logger.info(`Server running on port ${config.port} in ${config.env} mode`);
});

export default app;
ENTRYPOINT

npm install
```

The Express backend includes helmet for security headers, CORS configuration,
rate limiting, request compression, structured logging with Winston, and a
layered middleware stack. The entry point is designed for both direct execution
and test imports.

---

## Step 6: Fastify Backend Variant

Alternative backend setup using Fastify for projects that need higher
throughput and built-in schema validation.

```bash
cd backend

npm install fastify @fastify/cors @fastify/helmet @fastify/rate-limit \
  @fastify/compress @fastify/swagger @fastify/swagger-ui @fastify/jwt \
  @fastify/cookie @fastify/session @fastify/multipart

cat > src/index.ts << 'FASTIFY_ENTRY'
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import compress from '@fastify/compress';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import jwt from '@fastify/jwt';
import { config } from './config';
import { healthRoutes } from './routes/health';
import { authRoutes } from './routes/auth';
import { apiRoutes } from './routes/api';

const fastify = Fastify({
  logger: {
    level: config.logLevel,
    transport: config.env === 'development'
      ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss Z' } }
      : undefined,
  },
});

async function bootstrap() {
  await fastify.register(helmet);
  await fastify.register(cors, { origin: config.corsOrigins, credentials: true });
  await fastify.register(rateLimit, { max: 100, timeWindow: '15 minutes' });
  await fastify.register(compress);
  await fastify.register(jwt, { secret: config.jwtSecret });

  await fastify.register(swagger, {
    openapi: {
      info: { title: '{{project-name}} API', version: '0.1.0' },
      servers: [{ url: `http://localhost:${config.port}` }],
    },
  });
  await fastify.register(swaggerUi, { routePrefix: '/docs' });

  await fastify.register(healthRoutes, { prefix: '/health' });
  await fastify.register(authRoutes, { prefix: '/api/v1/auth' });
  await fastify.register(apiRoutes, { prefix: '/api/v1' });

  await fastify.listen({ port: config.port, host: '0.0.0.0' });
}

bootstrap().catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
FASTIFY_ENTRY
```

Fastify provides automatic JSON schema validation, built-in Swagger documentation
generation, and significantly better throughput than Express for JSON-heavy APIs.
The plugin registration pattern keeps the bootstrap clean and testable.

---

## Step 7: PostgreSQL Database Schema and Migrations

Set up the database schema with a migration system, including tables for users,
sessions, roles, and an audit log. Each migration is timestamped and idempotent.

```bash
# Migration runner script
cat > database/scripts/migrate.ts << 'MIGRATE'
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { config } from '../../backend/src/config';

const pool = new Pool({ connectionString: config.databaseUrl });

async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const executed = await pool.query('SELECT name FROM _migrations ORDER BY id');
  const executedNames = new Set(executed.rows.map(r => r.name));

  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    if (executedNames.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
      await pool.query('COMMIT');
      console.log(`Migrated: ${file}`);
    } catch (err) {
      await pool.query('ROLLBACK');
      console.error(`Failed: ${file}`, err);
      process.exit(1);
    }
  }
  await pool.end();
}

runMigrations();
MIGRATE

# Initial migration: users and roles
cat > database/migrations/001_create_users.sql << 'MIGRATION1'
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM ('admin', 'editor', 'viewer');
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended', 'pending_verification');

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255),
  display_name VARCHAR(100) NOT NULL,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'viewer',
  status user_status NOT NULL DEFAULT 'pending_verification',
  email_verified BOOLEAN DEFAULT FALSE,
  last_login_at TIMESTAMP WITH TIME ZONE,
  login_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_role ON users(role);

CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_sessions_expires ON user_sessions(expires_at);

CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(255),
  details JSONB,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_created ON audit_log(created_at);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
MIGRATION1
```

The migration system tracks which files have been executed, runs them in order,
and wraps each in a transaction for atomicity. The initial schema includes UUID
primary keys, enum types for roles and status, session management, and a JSONB
audit log for compliance tracking.

---

## Step 8: Redis Cache Configuration

Configure Redis for session caching, rate limiting state, and general-purpose
key-value caching with connection pooling and automatic reconnection.

```bash
cat > backend/src/services/cache.ts << 'CACHE'
import { createClient, RedisClientType } from 'redis';
import { config } from '../config';
import { logger } from '../utils/logger';

let client: RedisClientType;

export async function initCache(): Promise<RedisClientType> {
  client = createClient({
    url: config.redisUrl,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          logger.error('Redis: max reconnection attempts reached');
          return new Error('Max reconnection attempts');
        }
        return Math.min(retries * 100, 3000);
      },
    },
  });

  client.on('error', (err) => logger.error('Redis error:', err));
  client.on('connect', () => logger.info('Redis connected'));
  client.on('reconnecting', () => logger.warn('Redis reconnecting'));

  await client.connect();
  return client;
}

export async function getCache(key: string): Promise<string | null> {
  return client.get(key);
}

export async function setCache(key: string, value: string, ttlSeconds = 3600): Promise<void> {
  await client.setEx(key, ttlSeconds, value);
}

export async function deleteCache(key: string): Promise<void> {
  await client.del(key);
}

export async function invalidatePattern(pattern: string): Promise<void> {
  const keys = await client.keys(pattern);
  if (keys.length > 0) {
    await client.del(keys);
  }
}

export function getClient(): RedisClientType {
  return client;
}
CACHE
```

The Redis service provides a singleton client with automatic reconnection,
structured logging of connection events, TTL-based caching, and pattern-based
cache invalidation for when related data changes.

---

## Step 9: Authentication - JWT and Refresh Tokens

Implement JWT-based authentication with access and refresh token pairs,
secure token rotation, and password hashing with bcrypt.

```bash
cat > backend/src/services/auth.ts << 'AUTH'
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { pool } from './database';
import { logger } from '../utils/logger';

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateTokenPair(userId: string, role: string): TokenPair {
  const accessToken = jwt.sign(
    { sub: userId, role, type: 'access' },
    config.jwtSecret,
    { expiresIn: ACCESS_TOKEN_EXPIRY, issuer: '{{project-name}}' }
  );

  const refreshToken = jwt.sign(
    { sub: userId, type: 'refresh', jti: uuidv4() },
    config.jwtRefreshSecret,
    { expiresIn: REFRESH_TOKEN_EXPIRY, issuer: '{{project-name}}' }
  );

  return { accessToken, refreshToken, expiresIn: 900 };
}

export async function rotateRefreshToken(oldRefreshToken: string): Promise<TokenPair> {
  const decoded = jwt.verify(oldRefreshToken, config.jwtRefreshSecret) as jwt.JwtPayload;

  const session = await pool.query(
    'SELECT * FROM user_sessions WHERE user_id = $1 AND token_hash = $2 AND expires_at > NOW()',
    [decoded.sub, hashToken(oldRefreshToken)]
  );

  if (session.rows.length === 0) {
    logger.warn(`Refresh token reuse detected for user ${decoded.sub}`);
    await pool.query('DELETE FROM user_sessions WHERE user_id = $1', [decoded.sub]);
    throw new Error('Token reuse detected - all sessions invalidated');
  }

  const user = await pool.query('SELECT id, role FROM users WHERE id = $1 AND status = $2', [decoded.sub, 'active']);
  if (user.rows.length === 0) throw new Error('User not found or inactive');

  const tokens = generateTokenPair(user.rows[0].id, user.rows[0].role);

  await pool.query('UPDATE user_sessions SET token_hash = $1, expires_at = $2 WHERE user_id = $3 AND token_hash = $4', [
    hashToken(tokens.refreshToken),
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    decoded.sub,
    hashToken(oldRefreshToken),
  ]);

  return tokens;
}

function hashToken(token: string): string {
  return require('crypto').createHash('sha256').update(token).digest('hex');
}
AUTH
```

This implements refresh token rotation with reuse detection. If a previously
used refresh token is presented, all sessions for that user are invalidated
as a security measure. Tokens are stored as SHA-256 hashes in the database.

---

## Step 10: OAuth Integration (Google, GitHub)

Configure Passport.js strategies for Google and GitHub OAuth login with
account linking support for existing email addresses.

```bash
cat > backend/src/services/oauth.ts << 'OAUTH'
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { config } from '../config';
import { pool } from './database';
import { generateTokenPair } from './auth';
import { logger } from '../utils/logger';

passport.use(new GoogleStrategy({
    clientID: config.google.clientId,
    clientSecret: config.google.clientSecret,
    callbackURL: `${config.baseUrl}/api/v1/auth/google/callback`,
    scope: ['profile', 'email'],
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      if (!email) return done(new Error('No email in Google profile'));

      let user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

      if (user.rows.length === 0) {
        user = await pool.query(
          `INSERT INTO users (email, display_name, avatar_url, email_verified, status)
           VALUES ($1, $2, $3, true, 'active') RETURNING *`,
          [email, profile.displayName, profile.photos?.[0]?.value]
        );
        logger.info(`New user created via Google OAuth: ${email}`);
      } else if (!user.rows[0].email_verified) {
        await pool.query(
          'UPDATE users SET email_verified = true, status = $1 WHERE id = $2',
          ['active', user.rows[0].id]
        );
      }

      const tokens = generateTokenPair(user.rows[0].id, user.rows[0].role);
      done(null, { user: user.rows[0], tokens });
    } catch (err) {
      done(err as Error);
    }
  }
));

export { passport };
OAUTH

cat > backend/src/routes/auth.ts << 'AUTHROUTES'
import { Router } from 'express';
import { passport } from '../services/oauth';
import { register, login, refreshToken, logout } from '../controllers/authController';
import { validateBody } from '../middleware/validate';
import { registerSchema, loginSchema } from '../validators/authSchemas';

export const authRouter = Router();

authRouter.post('/register', validateBody(registerSchema), register);
authRouter.post('/login', validateBody(loginSchema), login);
authRouter.post('/refresh', refreshToken);
authRouter.post('/logout', logout);

authRouter.get('/google', passport.authenticate('google', { session: false }));
authRouter.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login?error=oauth' }),
  (req, res) => {
    const { tokens } = req.user as any;
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${tokens.accessToken}`);
  }
);
AUTHROUTES
```

The OAuth implementation supports automatic account linking when a user signs
in with Google using an email that already exists in the system. New users
created through OAuth are automatically verified and activated.

---

## Step 11: Unit Testing Setup

Configure the testing framework with utilities for database fixtures,
API request helpers, and authentication mocking.

```bash
cat > backend/tests/setup.ts << 'TESTSETUP'
import { Pool } from 'pg';
import { beforeAll, afterAll, afterEach } from 'vitest';

let testPool: Pool;

beforeAll(async () => {
  testPool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  await testPool.query('BEGIN');
});

afterEach(async () => {
  await testPool.query('SAVEPOINT test_savepoint');
});

afterAll(async () => {
  await testPool.query('ROLLBACK');
  await testPool.end();
});

export { testPool };
TESTSETUP

cat > backend/tests/helpers/factory.ts << 'FACTORY'
import { v4 as uuidv4 } from 'uuid';
import { hashPassword } from '../../src/services/auth';

export async function createTestUser(overrides = {}) {
  const defaults = {
    id: uuidv4(),
    email: `test-${uuidv4()}@example.com`,
    password: 'TestPassword123!',
    display_name: 'Test User',
    role: 'viewer',
    status: 'active',
    email_verified: true,
  };
  const user = { ...defaults, ...overrides };
  user.password_hash = await hashPassword(user.password);
  return user;
}

export function createTestProject(overrides = {}) {
  return {
    id: uuidv4(),
    name: `Test Project ${Date.now()}`,
    description: 'A test project for unit testing',
    ...overrides,
  };
}
FACTORY

cat > backend/tests/unit/auth.test.ts << 'AUTHTEST'
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, generateTokenPair } from '../../src/services/auth';

describe('Authentication Service', () => {
  describe('hashPassword', () => {
    it('should hash a password with bcrypt', async () => {
      const hash = await hashPassword('TestPassword123!');
      expect(hash).toBeDefined();
      expect(hash).not.toBe('TestPassword123!');
      expect(hash.startsWith('$2a$') || hash.startsWith('$2b$')).toBe(true);
    });

    it('should produce different hashes for the same password', async () => {
      const hash1 = await hashPassword('TestPassword123!');
      const hash2 = await hashPassword('TestPassword123!');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should verify a correct password', async () => {
      const hash = await hashPassword('TestPassword123!');
      const result = await verifyPassword('TestPassword123!', hash);
      expect(result).toBe(true);
    });

    it('should reject an incorrect password', async () => {
      const hash = await hashPassword('TestPassword123!');
      const result = await verifyPassword('WrongPassword456!', hash);
      expect(result).toBe(false);
    });
  });

  describe('generateTokenPair', () => {
    it('should generate access and refresh tokens', () => {
      const tokens = generateTokenPair('user-id-123', 'viewer');
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.expiresIn).toBe(900);
    });
  });
});
AUTHTEST
```

The test setup uses transaction-based isolation: each test suite runs inside
a transaction that is rolled back after all tests complete, ensuring no test
data persists between runs and no interference between test files.

---

## Step 12: Integration Testing Configuration

Set up integration tests that exercise the API endpoints with a real database
connection and verify the full request-response cycle.

```bash
cat > backend/tests/integration/auth.integration.test.ts << 'INTTEST'
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../../src/index';
import { testPool } from '../setup';
import { createTestUser } from '../helpers/factory';

describe('Auth API Integration', () => {
  let testUser: any;

  beforeAll(async () => {
    testUser = await createTestUser();
    await testPool.query(
      'INSERT INTO users (id, email, password_hash, display_name, role, status, email_verified) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [testUser.id, testUser.email, testUser.password_hash, testUser.display_name, testUser.role, testUser.status, testUser.email_verified]
    );
  });

  describe('POST /api/v1/auth/login', () => {
    it('should return tokens for valid credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testUser.email, password: testUser.password });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
    });

    it('should return 401 for invalid password', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testUser.email, password: 'wrong-password' });

      expect(res.status).toBe(401);
    });

    it('should return 400 for missing fields', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testUser.email });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/auth/register', () => {
    it('should create a new user and return tokens', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'NewPassword123!',
          displayName: 'New User',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('accessToken');
    });

    it('should reject duplicate email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: testUser.email,
          password: 'AnotherPass123!',
          displayName: 'Duplicate User',
        });

      expect(res.status).toBe(409);
    });
  });
});
INTTEST
```

Integration tests use the actual Express app instance imported directly,
with supertest handling HTTP assertions. The test database is configured via
a separate environment variable to prevent accidental data loss in development
or production databases.

---

## Step 13: End-to-End Testing with Playwright

Configure Playwright for browser-based end-to-end tests covering critical
user flows like registration, login, and dashboard navigation.

```bash
cd frontend

npm install -D @playwright/test
npx playwright install chromium

cat > playwright.config.ts << 'PWCONFIG'
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['json', { outputFile: 'test-results.json' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
  ],
  webServer: [
    {
      command: 'npm run dev',
      port: 3000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'cd ../backend && npm run dev',
      port: 4000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
PWCONFIG

cat > tests/e2e/auth.spec.ts << 'E2EAUTH'
import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should register a new user', async ({ page }) => {
    await page.goto('/register');
    await page.fill('[data-testid="email"]', 'e2e-test@example.com');
    await page.fill('[data-testid="password"]', 'E2ePassword123!');
    await page.fill('[data-testid="display-name"]', 'E2E Tester');
    await page.click('[data-testid="register-button"]');
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="welcome-message"]')).toContainText('E2E Tester');
  });

  test('should login with existing credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'e2e-test@example.com');
    await page.fill('[data-testid="password"]', 'E2ePassword123!');
    await page.click('[data-testid="login-button"]');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'wrong@example.com');
    await page.fill('[data-testid="password"]', 'WrongPass123!');
    await page.click('[data-testid="login-button"]');
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
  });
});
E2EAUTH
```

Playwright is configured to test across Chromium, Firefox, and mobile Chrome
viewports. The web server configuration automatically starts both frontend and
backend servers before running tests, and captures traces on first retry for
debugging flaky tests.

---

## Step 14: Docker Configuration

Create multi-stage Dockerfiles for production-optimized builds and a
docker-compose configuration that orchestrates all services.

```bash
# Frontend Dockerfile with multi-stage build
cat > docker/Dockerfile.frontend << 'DKRFRONT'
FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY frontend/package*.json ./
RUN npm ci --only=production

FROM base AS build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

FROM nginx:alpine AS production
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
DKRFRONT

# Backend Dockerfile with multi-stage build
cat > docker/Dockerfile.backend << 'DKRBACK'
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache dumb-init

FROM base AS deps
COPY backend/package*.json ./
RUN npm ci --only=production

FROM base AS build
COPY backend/package*.json ./
RUN npm ci
COPY backend/ .
RUN npm run build

FROM base AS production
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY backend/package*.json ./
USER node
EXPOSE 4000
CMD ["dumb-init", "node", "dist/index.js"]
DKRBACK

# Nginx configuration for frontend
cat > docker/nginx/default.conf << 'NGINXCONF'
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://backend:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
}
NGINXCONF

# Docker Compose for full stack
cat > docker-compose.yml << 'COMPOSE'
version: '3.8'

services:
  frontend:
    build:
      context: .
      dockerfile: docker/Dockerfile.frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - app-network

  backend:
    build:
      context: .
      dockerfile: docker/Dockerfile.backend
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://{{db_user}}:{{db_password}}@postgres:5432/{{db_name}}
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET={{jwt_secret}}
      - JWT_REFRESH_SECRET={{jwt_refresh_secret}}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - app-network

  postgres:
    image: postgres:16-alpine
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/migrations:/docker-entrypoint-initdb.d
    environment:
      - POSTGRES_USER={{db_user}}
      - POSTGRES_PASSWORD={{db_password}}
      - POSTGRES_DB={{db_name}}
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U {{db_user}} -d {{db_name}}"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - app-network

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - app-network

volumes:
  postgres_data:
  redis_data:

networks:
  app-network:
    driver: bridge
COMPOSE
```

The Docker setup uses multi-stage builds to minimize image size, dumb-init
for proper signal handling in the Node.js container, health checks for
service dependencies, and persistent volumes for database and cache data.

---

## Step 15: CI/CD - GitHub Actions

Create GitHub Actions workflows for continuous integration, including linting,
testing, building, and deployment to staging and production environments.

```bash
cat > .github/workflows/ci.yml << 'GHCI'
name: CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npm run lint

  test-backend:
    name: Backend Tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test_db
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npm -w backend run test:coverage
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379
          JWT_SECRET: ci-test-secret
          JWT_REFRESH_SECRET: ci-test-refresh-secret
      - uses: actions/upload-artifact@v4
        with:
          name: backend-coverage
          path: backend/coverage/

  test-frontend:
    name: Frontend Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npm -w frontend run test:coverage
      - uses: actions/upload-artifact@v4
        with:
          name: frontend-coverage
          path: frontend/coverage/

  build:
    name: Build Docker Images
    needs: [lint, test-backend, test-frontend]
    runs-on: ubuntu-latest
    if: github.event_name == 'push'
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          context: .
          file: docker/Dockerfile.backend
          push: true
          tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/backend:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
      - uses: docker/build-push-action@v5
        with:
          context: .
          file: docker/Dockerfile.frontend
          push: true
          tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/frontend:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy-staging:
    name: Deploy to Staging
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to staging
        run: |
          echo "Deploying to staging environment..."
          # Add deployment commands here
GHCI
```

The CI pipeline runs lint, backend tests (with PostgreSQL and Redis service
containers), and frontend tests in parallel. Docker images are built only
after all checks pass and only on push events (not pull requests).

---

## Step 16: CI/CD - GitLab CI

Provide an equivalent GitLab CI configuration for teams using GitLab instead
of GitHub, with similar stages and caching strategies.

```bash
cat > .gitlab/.gitlab-ci.yml << 'GLCI'
stages:
  - validate
  - test
  - build
  - deploy

variables:
  NODE_VERSION: "20"
  POSTGRES_USER: test
  POSTGRES_PASSWORD: test
  POSTGRES_DB: test_db
  DATABASE_URL: "postgresql://test:test@postgres:5432/test_db"
  REDIS_URL: "redis://redis:6379"

.node-cache: &node-cache
  cache:
    key:
      files:
        - package-lock.json
    paths:
      - node_modules/
      - frontend/node_modules/
      - backend/node_modules/

lint:
  stage: validate
  image: node:${NODE_VERSION}-alpine
  <<: *node-cache
  script:
    - npm ci
    - npm run lint

test:backend:
  stage: test
  image: node:${NODE_VERSION}-alpine
  services:
    - postgres:16-alpine
    - redis:7-alpine
  <<: *node-cache
  script:
    - npm ci
    - npm -w backend run test:coverage
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: backend/coverage/cobertura-coverage.xml
    paths:
      - backend/coverage/

test:frontend:
  stage: test
  image: node:${NODE_VERSION}-alpine
  <<: *node-cache
  script:
    - npm ci
    - npm -w frontend run test:coverage
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: frontend/coverage/cobertura-coverage.xml

build:backend:
  stage: build
  image: docker:24
  services:
    - docker:24-dind
  script:
    - docker build -f docker/Dockerfile.backend -t $CI_REGISTRY_IMAGE/backend:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE/backend:$CI_COMMIT_SHA
  only:
    - main
    - develop

build:frontend:
  stage: build
  image: docker:24
  services:
    - docker:24-dind
  script:
    - docker build -f docker/Dockerfile.frontend -t $CI_REGISTRY_IMAGE/frontend:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE/frontend:$CI_COMMIT_SHA
  only:
    - main
    - develop

deploy:staging:
  stage: deploy
  environment:
    name: staging
    url: https://staging.{{project-domain}}
  script:
    - echo "Deploying to staging..."
  only:
    - develop
  when: manual

deploy:production:
  stage: deploy
  environment:
    name: production
    url: https://{{project-domain}}
  script:
    - echo "Deploying to production..."
  only:
    - main
  when: manual
GLCI
```

The GitLab CI configuration mirrors the GitHub Actions workflow with equivalent
stages. It uses GitLab's native cache mechanism with lockfile-based keys,
Cobertura coverage report integration, and manual deployment gates for both
staging and production.

---

## Step 17: ESLint and Prettier Configuration

Set up unified code formatting and linting rules across the entire monorepo
with TypeScript-aware ESLint rules and Prettier integration.

```bash
# Root ESLint configuration
cat > .eslintrc.json << 'ESLINT'
{
  "root": true,
  "env": {
    "es2020": true,
    "node": true
  },
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2020,
    "sourceType": "module"
  },
  "plugins": ["@typescript-eslint", "import"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "prettier"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/no-explicit-any": "warn",
    "import/order": ["error", {
      "groups": ["builtin", "external", "internal", "parent", "sibling", "index"],
      "newlines-between": "always",
      "alphabetize": { "order": "asc" }
    }],
    "no-console": ["warn", { "allow": ["warn", "error"] }],
    "prefer-const": "error",
    "no-var": "error"
  },
  "settings": {
    "import/resolver": {
      "typescript": { "alwaysTryTypes": true }
    }
  }
}
ESLINT

# Frontend-specific ESLint overrides
cat > frontend/.eslintrc.json << 'ESLINTFRONT'
{
  "extends": [
    "../.eslintrc.json",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended"
  ],
  "plugins": ["react", "react-hooks", "jsx-a11y"],
  "env": {
    "browser": true
  },
  "settings": {
    "react": { "version": "detect" }
  },
  "rules": {
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    "jsx-a11y/anchor-is-valid": ["error", {
      "components": ["Link"],
      "specialLink": ["to"]
    }]
  }
}
ESLINTFRONT

# Prettier configuration
cat > .prettierrc << 'PRETTIER'
{
  "semi": true,
  "trailingComma": "all",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf"
}
PRETTIER

cat > .prettierignore << 'PRETTIERIGNORE'
node_modules
dist
build
.next
coverage
*.min.js
*.min.css
package-lock.json
PRETTIERIGNORE

# Install linting dependencies at root
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin \
  eslint-plugin-import eslint-import-resolver-typescript \
  eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-jsx-a11y \
  eslint-config-prettier prettier
```

ESLint is configured with TypeScript support, import ordering enforcement,
React hooks rules, and accessibility checks. Prettier handles all formatting
concerns, with ESLint's formatting rules disabled via eslint-config-prettier
to avoid conflicts between the two tools.

---

## Step 18: Husky Pre-commit Hooks and lint-staged

Configure Git hooks to automatically lint and format staged files before
each commit, preventing poorly formatted code from entering the repository.

```bash
npx husky install

# Pre-commit hook: lint staged files
cat > .husky/pre-commit << 'PRECOMMIT'
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
PRECOMMIT

chmod +x .husky/pre-commit

# Commit message validation hook
cat > .husky/commit-msg << 'COMMITMSG'
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx --no -- commitlint --edit ${1}
COMMITMSG

chmod +x .husky/commit-msg

# lint-staged configuration
cat > .lintstagedrc.json << 'LINTSTAGED'
{
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md,yml,yaml}": ["prettier --write"],
  "*.css": ["prettier --write"],
  "*.sql": ["prettier --write --plugin=prettier-plugin-sql"]
}
LINTSTAGED

# Commitlint configuration for conventional commits
cat > commitlint.config.js << 'COMMITLINT'
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat', 'fix', 'docs', 'style', 'refactor',
      'perf', 'test', 'build', 'ci', 'chore', 'revert',
    ]],
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    'header-max-length': [2, 'always', 100],
  },
};
COMMITLINT

npm install -D husky lint-staged @commitlint/cli @commitlint/config-conventional
```

Husky sets up two Git hooks: pre-commit runs lint-staged to fix and format only
the files being committed (avoiding unnecessary full-repo linting), and
commit-msg enforces conventional commit message format for changelog generation.

---

## Step 19: Deployment Configuration

Generate deployment scripts and configurations for common hosting platforms
including process managers, reverse proxy, and SSL certificate automation.

```bash
# PM2 ecosystem configuration for production
cat > ecosystem.config.js << 'PM2CONFIG'
module.exports = {
  apps: [
    {
      name: '{{project-name}}-api',
      script: 'backend/dist/index.js',
      instances: 'max',
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      max_memory_restart: '500M',
      error_file: '/var/log/{{project-name}}/api-error.log',
      out_file: '/var/log/{{project-name}}/api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 4000,
    },
  ],
};
PM2CONFIG

# Deployment script for VPS / bare metal
cat > scripts/deploy/deploy.sh << 'DEPLOY'
#!/bin/bash
set -euo pipefail

DEPLOY_DIR="/opt/{{project-name}}"
BACKUP_DIR="/opt/{{project-name}}-backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "Starting deployment at ${TIMESTAMP}..."

# Create backup
mkdir -p "${BACKUP_DIR}"
if [ -d "${DEPLOY_DIR}" ]; then
  cp -r "${DEPLOY_DIR}" "${BACKUP_DIR}/backup-${TIMESTAMP}"
  echo "Backup created at ${BACKUP_DIR}/backup-${TIMESTAMP}"
fi

# Pull latest code
cd "${DEPLOY_DIR}"
git fetch origin main
git reset --hard origin/main

# Install dependencies
npm ci --production

# Build
npm run build

# Run migrations
npm run db:migrate

# Restart services
pm2 reload ecosystem.config.js --env production
pm2 save

# Clean old backups (keep last 5)
ls -dt "${BACKUP_DIR}"/backup-* | tail -n +6 | xargs rm -rf

echo "Deployment completed successfully."
DEPLOY

chmod +x scripts/deploy/deploy.sh

# Nginx site configuration for production
cat > scripts/deploy/nginx-site.conf << 'NGINXSITE'
upstream backend_upstream {
    least_conn;
    server 127.0.0.1:4000;
    server 127.0.0.1:4001 backup;
}

server {
    listen 80;
    server_name {{project-domain}} www.{{project-domain}};
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name {{project-domain}} www.{{project-domain}};

    ssl_certificate /etc/letsencrypt/live/{{project-domain}}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/{{project-domain}}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;

    root /opt/{{project-name}}/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://backend_upstream;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }
}
NGINXSITE
```

The deployment configuration includes PM2 cluster mode for utilizing all CPU
cores, automatic backup rotation keeping the last 5 deployments, production
Nginx with SSL termination and HTTP/2, upstream load balancing, and security
headers including HSTS.

---

## Step 20: Monitoring and Health Checks

Set up application monitoring with structured logging, health check endpoints,
and Prometheus-compatible metrics collection.

```bash
# Winston logger configuration with rotation
cat > backend/src/utils/logger.ts << 'LOGGER'
import winston from 'winston';
import path from 'path';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `${timestamp} ${level}: ${message} ${metaStr}`;
  })
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: '{{project-name}}-api' },
  transports: [
    new winston.transports.File({
      filename: path.join('logs', 'error.log'),
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join('logs', 'combined.log'),
      maxsize: 5242880,
      maxFiles: 10,
    }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({ format: consoleFormat }));
}
LOGGER

# Health check endpoint with dependency checks
cat > backend/src/routes/health.ts << 'HEALTH'
import { Router } from 'express';
import { pool } from '../services/database';
import { getClient } from '../services/cache';

export const healthRouter = Router();

healthRouter.get('/', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

healthRouter.get('/ready', async (req, res) => {
  const checks: Record<string, string> = {};

  try {
    await pool.query('SELECT 1');
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  try {
    await getClient().ping();
    checks.redis = 'ok';
  } catch {
    checks.redis = 'error';
  }

  const allHealthy = Object.values(checks).every((v) => v === 'ok');
  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ready' : 'degraded',
    checks,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});
HEALTH

# Prometheus metrics middleware
cat > backend/src/middleware/metrics.ts << 'METRICS'
import { Request, Response, NextFunction } from 'express';

const requestCounts: Record<string, number> = {};
const responseTimes: number[] = [];

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const key = `${req.method} ${req.route?.path || req.path}`;

  res.on('finish', () => {
    const duration = Date.now() - start;
    requestCounts[key] = (requestCounts[key] || 0) + 1;
    responseTimes.push(duration);
    if (responseTimes.length > 10000) responseTimes.shift();
  });

  next();
}

export function getMetrics() {
  const avgResponseTime = responseTimes.length > 0
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : 0;

  return {
    requests: requestCounts,
    averageResponseTimeMs: Math.round(avgResponseTime * 100) / 100,
    totalRequests: Object.values(requestCounts).reduce((a, b) => a + b, 0),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };
}
METRICS
```

The monitoring setup includes structured JSON logging with file rotation,
a readiness endpoint that checks database and Redis connectivity, and a
lightweight metrics collection middleware that tracks request counts and
response times without requiring external dependencies.

---

## Step 21: API Documentation with Swagger/OpenAPI

Generate Swagger documentation from route definitions and JSDoc annotations,
with an interactive UI available at the /docs endpoint.

```bash
cat > backend/src/swagger.ts << 'SWAGGER'
import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: '{{project-name}} API',
      version: '0.1.0',
      description: 'REST API documentation for {{project-name}}',
      contact: { email: 'dev@{{project-domain}}' },
      license: { name: 'MIT' },
    },
    servers: [
      { url: 'http://localhost:4000', description: 'Development' },
      { url: 'https://api.{{project-domain}}', description: 'Production' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            status: { type: 'integer' },
            message: { type: 'string' },
            details: { type: 'array', items: { type: 'string' } },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            displayName: { type: 'string' },
            role: { type: 'string', enum: ['admin', 'editor', 'viewer'] },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        TokenPair: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            expiresIn: { type: 'integer' },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
SWAGGER

npm install -D swagger-jsdoc swagger-ui-express @types/swagger-jsdoc @types/swagger-ui-express
```

The Swagger configuration defines reusable schemas for common response types,
JWT bearer authentication, and multiple server environments. Route-level
documentation is pulled from JSDoc annotations in the route files.

---

## Step 22: Environment Management

Create environment file templates and a validation layer that ensures all
required variables are present before the application starts.

```bash
cat > .env.example << 'ENVEXAMPLE'
# Application
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:3000
BASE_URL=http://localhost:4000

# Database
DATABASE_URL=postgresql://devuser:devpass@localhost:5432/{{project-name}}_dev
TEST_DATABASE_URL=postgresql://devuser:devpass@localhost:5432/{{project-name}}_test

# Redis
REDIS_URL=redis://localhost:6379

# Authentication
JWT_SECRET=change-this-to-a-random-string-at-least-32-chars
JWT_REFRESH_SECRET=change-this-to-another-random-string-at-least-32-chars

# OAuth - Google
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# OAuth - GitHub
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Logging
LOG_LEVEL=debug

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
ENVEXAMPLE

cat > backend/src/config.ts << 'CONFIG'
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

export const config = {
  env: optionalEnv('NODE_ENV', 'development'),
  port: parseInt(optionalEnv('PORT', '4000'), 10),
  frontendUrl: optionalEnv('FRONTEND_URL', 'http://localhost:3000'),
  baseUrl: optionalEnv('BASE_URL', 'http://localhost:4000'),

  databaseUrl: requireEnv('DATABASE_URL'),
  redisUrl: optionalEnv('REDIS_URL', 'redis://localhost:6379'),

  jwtSecret: requireEnv('JWT_SECRET'),
  jwtRefreshSecret: requireEnv('JWT_REFRESH_SECRET'),

  google: {
    clientId: optionalEnv('GOOGLE_CLIENT_ID', ''),
    clientSecret: optionalEnv('GOOGLE_CLIENT_SECRET', ''),
  },

  github: {
    clientId: optionalEnv('GITHUB_CLIENT_ID', ''),
    clientSecret: optionalEnv('GITHUB_CLIENT_SECRET', ''),
  },

  logLevel: optionalEnv('LOG_LEVEL', 'info'),
  corsOrigins: optionalEnv('CORS_ORIGINS', 'http://localhost:3000').split(','),
} as const;

// Validate on import
if (config.env === 'production') {
  if (config.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }
  if (config.jwtRefreshSecret.length < 32) {
    throw new Error('JWT_REFRESH_SECRET must be at least 32 characters in production');
  }
}
CONFIG
```

The environment configuration uses a fail-fast pattern: required variables
throw immediately on startup if missing, while optional variables have sensible
defaults. Production mode enforces additional security constraints like minimum
secret length.

---

## Step 23: README Generation

Generate a comprehensive project README with badges, setup instructions,
architecture overview, and contribution guidelines.

```bash
cat > docs/README-template.md << 'README'
# {{project-name}}

[![CI](https://github.com/{{github-org}}/{{project-name}}/actions/workflows/ci.yml/badge.svg)](https://github.com/{{github-org}}/{{project-name}}/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> {{project-description}}

## Quick Start

```bash
# Clone and install
git clone https://github.com/{{github-org}}/{{project-name}}.git
cd {{project-name}}
npm install

# Set up environment
cp .env.example .env
# Edit .env with your values

# Start services with Docker
docker-compose up -d postgres redis

# Run migrations
npm run db:migrate

# Start development servers
npm run dev
```

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend   │────▶│   Backend   │────▶│  PostgreSQL  │
│  React/Vite  │     │   Express   │     │             │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                    ┌──────▼──────┐
                    │    Redis    │
                    │   (Cache)   │
                    └─────────────┘
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all development servers |
| `npm run build` | Build for production |
| `npm run test` | Run all tests |
| `npm run lint` | Lint all files |
| `npm run db:migrate` | Run database migrations |
| `npm run db:seed` | Seed database with sample data |
| `npm run docker:up` | Start Docker services |

## API Documentation

Once the backend is running, visit `http://localhost:4000/docs` for interactive
Swagger documentation.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

Please follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.
README
```

The README template includes CI badges, quick-start instructions, ASCII
architecture diagram, a command reference table, and contribution guidelines
with conventional commit format.

---

## Step 24: License Selection

Generate the appropriate license file based on the user's choice, with MIT
as the default if no preference is specified.

```bash
YEAR=$(date +%Y)
AUTHOR="{{author-name}}"

cat > LICENSE << LICENSEEOF
MIT License

Copyright (c) ${YEAR} ${AUTHOR}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
LICENSEEOF
```

---

## Step 25: VS Code Workspace Settings

Configure VS Code with recommended extensions, editor settings, and debug
launch configurations for both frontend and backend.

```bash
cat > .vscode/settings.json << 'VSSETTINGS'
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit",
    "source.organizeImports": "explicit"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "files.eol": "\n",
  "files.insertFinalNewline": true,
  "files.trimTrailingWhitespace": true,
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/build": true,
    "**/coverage": true,
    "**/.next": true
  },
  "[typescript]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[typescriptreact]": { "editor.defaultFormatter": "esbenp.prettier-vscode" },
  "[json]": { "editor.defaultFormatter": "esbenp.prettier-vscode" }
}
VSSETTINGS

cat > .vscode/extensions.json << 'VSEXT'
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "ms-azuretools.vscode-docker",
    "prisma.prisma",
    "mikestead.dotenv",
    "humao.rest-client",
    "ms-playwright.playwright",
    "vitest.explorer"
  ]
}
VSEXT

cat > .vscode/launch.json << 'VSLAUNCH'
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Backend: Debug",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npx",
      "runtimeArgs": ["tsx", "backend/src/index.ts"],
      "envFile": "${workspaceFolder}/.env",
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"]
    },
    {
      "name": "Backend: Debug Tests",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npx",
      "runtimeArgs": ["vitest", "run", "--reporter=verbose"],
      "cwd": "${workspaceFolder}/backend",
      "console": "integratedTerminal"
    },
    {
      "name": "Frontend: Debug Chrome",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000",
      "webRoot": "${workspaceFolder}/frontend/src",
      "sourceMapPathOverrides": {
        "webpack:///./src/*": "${webRoot}/*"
      }
    }
  ],
  "compounds": [
    {
      "name": "Full Stack: Debug",
      "configurations": ["Backend: Debug", "Frontend: Debug Chrome"]
    }
  ]
}
VSLAUNCH
```

VS Code is configured with format-on-save via Prettier, ESLint auto-fix,
TypeScript workspace SDK usage, and debug configurations for backend,
tests, and frontend. The compound configuration allows debugging the full
stack simultaneously.

---

## Edge Cases and Limitations

This skill handles the following edge cases:

1. **Existing directory**: If the target directory already exists, the skill
   will prompt for confirmation before overwriting any files.

2. **Missing prerequisites**: The skill validates tool versions at the start
   and reports which tools are missing or outdated.

3. **Network failures**: npm install failures are caught with retry logic
   (up to 3 attempts with exponential backoff).

4. **Port conflicts**: The skill checks if ports 3000, 4000, 5432, and 6379
   are already in use and suggests alternatives.

5. **Windows compatibility**: All scripts use cross-platform commands where
   possible. The .gitattributes enforces LF line endings except for Windows
   batch files.

6. **Large monorepo performance**: npm workspaces are used instead of Lerna
   or Turborepo for simplicity, but the structure supports migration to
   Turborepo if build times become a concern.

7. **Database connection pooling**: The PostgreSQL pool is configured with
   a maximum of 20 connections by default to avoid exhausting the database
   connection limit in development.

8. **Memory limits**: The PM2 configuration restarts the backend process if
   it exceeds 500MB of memory, preventing memory leaks from causing outages.

9. **Secret generation**: When JWT secrets are not provided, the skill
   generates cryptographically secure random strings using OpenSSL.

10. **Docker volume permissions**: On Linux hosts, the PostgreSQL volume
    may have permission issues. The skill includes a fix script that sets
    the correct ownership.

---

## Advanced Configuration

### Custom Database Schemas

The skill supports generating additional database tables by passing a schema
definition object. Each table definition includes columns, indexes, foreign
keys, and triggers.

### Multi-environment Docker Compose

Override files are generated for development (`docker-compose.dev.yml`),
testing (`docker-compose.test.yml`), and production (`docker-compose.prod.yml`)
with appropriate resource limits and logging drivers.

### Kubernetes Deployment

For teams deploying to Kubernetes, the skill can generate Helm charts with
configurable values for replica counts, resource requests/limits, ingress
rules, and horizontal pod autoscaling.

### Terraform Infrastructure

Optional Terraform modules are available for provisioning cloud infrastructure
on AWS (ECS Fargate, RDS, ElastiCache) or GCP (Cloud Run, Cloud SQL, Memorystore)
with the necessary IAM roles and security groups.

### Feature Flags

The skill can integrate LaunchDarkly or a self-hosted feature flag service
with a React provider component and Express middleware for server-side
evaluation. Feature flags are typed and validated at build time.

### Internationalization

For projects requiring multi-language support, the skill generates i18n
scaffolding using react-i18next with namespace-based translation files,
language detection, and a translation management workflow.

### API Versioning

The generated API uses URL-based versioning (`/api/v1/`) with middleware
that supports content negotiation for clients that prefer header-based
versioning via the `Accept-Version` header.

### Database Seeding

The seed script generates realistic test data using Faker.js, respecting
foreign key constraints and creating a configurable number of records per
table. Seed data is deterministic when given the same random seed value.

### Backup and Restore

Database backup scripts are included for both local development and production
use. Production backups use pg_dump with custom format for compression and
selective restoration. Backups are automatically uploaded to S3 or GCS
depending on the configured cloud provider.

### Performance Testing

A k6 load testing script is generated with scenarios for common API endpoints,
configurable virtual user counts, and threshold-based pass/fail criteria.
Results are output in JSON format compatible with Grafana dashboards.
