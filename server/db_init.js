import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initDb() {
  console.log('Initializing PostgreSQL database for Kanban Flow...');
  const client = await pool.connect();
  try {
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    console.log('Applying schema...');
    await client.query(schemaSql);
    console.log('Schema applied successfully.');

    const seedSql = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf-8');
    console.log('Seeding initial data...');
    await client.query(seedSql);
    console.log('Database seeded successfully with sample projects, members, and tasks!');
  } catch (err) {
    console.error('Database initialization failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

initDb();
