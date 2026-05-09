import { createPool } from 'mariadb';
// dotenv is loaded in server.js before this module is imported.
// No need to call dotenv.config() here.

const pool = createPool({
    host:            process.env.DB_HOST || 'localhost',
    user:            process.env.DB_USER || 'root',
    password:        process.env.DB_PASSWORD,
    database:        process.env.DB_NAME || 'kt_impex',
    connectionLimit: 5,
    bigIntAsNumber:  true
});

export default pool;
