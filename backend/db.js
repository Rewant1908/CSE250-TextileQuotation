import { createPool } from 'mariadb';
import dotenv from 'dotenv';
dotenv.config();

// Fix: Removed "mariadb." from the start of the line below
const pool = createPool({
    host: 'localhost',
    user: 'root',
    password: 'Rewant@1908',
    database: 'kt_impex',
    connectionLimit: 5
});

pool.getConnection()
    .then(conn => {
        console.log("✅ MariaDB Connected to KT Impex Engine");
        conn.release();
    })
    .catch(err => console.log("❌ DB Connection Error: " + err));

export default pool;
