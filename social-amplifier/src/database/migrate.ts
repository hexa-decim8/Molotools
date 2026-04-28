import { getDatabase } from './index.js';
import { runMigrations } from './migrations.js';
import { loadConfig } from '../config/index.js';

const config = loadConfig();
const db = getDatabase(config.databasePath);

console.log('Running migrations...');
runMigrations(db);
console.log('Migrations complete.');

db.close();
