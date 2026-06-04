import fs from 'fs';
import path from 'path';
import { defineConfig } from 'prisma/config';

function loadEnv() {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const envPath = path.join(dir, '.env');
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf-8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const firstEqual = trimmed.indexOf('=');
            if (firstEqual !== -1) {
              const key = trimmed.slice(0, firstEqual).trim();
              let val = trimmed.slice(firstEqual + 1).trim();
              if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                val = val.slice(1, -1);
              }
              process.env[key] = val;
            }
          }
        }
      } catch (e) {
        // Ignore file read issues
      }
      break;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
}

loadEnv();

export default defineConfig({
  schema: './apps/backend/prisma/schema.prisma',
  datasource: {
    url: process.env.DIRECT_URL,
  },
});
