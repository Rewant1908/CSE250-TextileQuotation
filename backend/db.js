import { createPool } from 'mariadb';

// dotenv is loaded once in server.js before any imports.
// Do NOT call config() here — it causes a duplicate dotenv load
// and makes dotenv@17 report "injecting env (0)" twice on startup.

const pool = createPool({
    host:            process.env.DB_HOST     || 'localhost',
    user:            process.env.DB_USER     || 'root',
    password:        process.env.DB_PASSWORD || '',
    database:        process.env.DB_NAME     || 'kt_impex',
    connectionLimit: 5,
    bigIntAsNumber:  true
});

export default pool;
