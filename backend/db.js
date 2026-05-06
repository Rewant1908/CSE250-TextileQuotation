import { createPool } from 'mariadb';
import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

const pool = createPool({
    host:            process.env.DB_HOST || 'localhost',
    user:            process.env.DB_USER || 'root',
    password:        process.env.DB_PASS,
    database:        process.env.DB_NAME || 'kt_impex',
    connectionLimit: 5
});

export default pool;
