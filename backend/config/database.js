const oracledb = require('oracledb');
const path = require('path');
require('dotenv').config(); 

const walletPath = path.join(__dirname, '../wallet');

oracledb.autoCommit = true; 
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT; 
oracledb.fetchAsString = [ oracledb.CLOB ]; 

oracledb.initOracleClient({ configDir: walletPath });

const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  connectString: process.env.DB_CONNECTION_STRING,
  walletLocation: walletPath,
  walletPassword: process.env.WALLET_PASSWORD
};

// 1. INICIALIZAR EL POOL Y GUARDAR LA TAREA EN UNA VARIABLE
let poolPromise = null;

async function initPool() {
    try {
        await oracledb.createPool({
            ...dbConfig,
            poolMin: 2,
            poolMax: 10,
            poolIncrement: 1
        });
        console.log(" Pool de conexiones de Oracle inicializado");
    } catch (err) {
        console.error(" Error inicializando el pool:", err.message);
    }
}
poolPromise = initPool();

// 2. EJECUTAR CONSULTAS USANDO EL POOL
async function runQuery(sql, params = [], options = {}) {
  await poolPromise; 

  let connection;
  try {
    connection = await oracledb.getConnection(); 
    const result = await connection.execute(sql, params, options);
    return result;
  } catch (err) {
    console.error("Error SQL Interno:", err.message); 
    throw err; 
  } finally {
    if (connection) { 
      try { await connection.close(); } catch (e) { console.error(e); } 
    }
  }
}

module.exports = { runQuery, oracledb };