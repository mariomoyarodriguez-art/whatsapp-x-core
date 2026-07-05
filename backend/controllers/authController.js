const { runQuery, oracledb } = require('../config/database');
const { mapKeysToLowerCase } = require('../utils/helpers');

// 1. Obtener lista de departamentos
exports.getDepartamentos = async (req, res) => {
  try {
    const result = await runQuery('SELECT id_dep, nom_dep FROM Departamento ORDER BY nom_dep ASC');
    const deps = result.rows.map(r => ({ id_dep: r.ID_DEP, nom_dep: r.NOM_DEP })); 
    res.json(deps);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// 2. Registrar nuevo empleado
exports.register = async (req, res) => {
  const { num_Tel, nombre, apellido_pat, apellido_mat, correo, puesto, id_dep, password } = req.body;
  const sql = `INSERT INTO Empleado (num_Tel, nombre, apellido_pat, apellido_mat, correo, puesto, id_dep, contrasena) VALUES (:tel, :nom, :apat, :amat, :mail, :pst, :dep, :pass)`;
  try {
    await runQuery(sql, { tel: num_Tel, nom: nombre, apat: apellido_pat, amat: apellido_mat, mail: correo, pst: puesto, dep: id_dep || 'GEN01', pass: password });
    res.json({ success: true });
  } catch (e) { 
    res.status(400).json({ success: false, message: "Error al registrar" }); 
  }
};

// 3. Iniciar sesión
exports.login = async (req, res) => {
  const { num_Tel, password } = req.body;
  const sql = `SELECT e.*, d.nom_dep FROM Empleado e LEFT JOIN Departamento d ON e.id_dep = d.id_dep WHERE e.num_Tel = :tel AND e.contrasena = :pass`;
  try {
    const result = await runQuery(sql, { tel: num_Tel, pass: password }, { fetchInfo: { "FOTO_PERFIL": { type: oracledb.BUFFER } } });
    if (result.rows.length > 0) {
      const user = mapKeysToLowerCase(result.rows[0]);
      res.json({ success: true, user });
    } else {
      res.status(401).json({ success: false, message: "Credenciales incorrectas" });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// 4. Buscar empleado global
exports.searchEmpleado = async (req, res) => {
    const { tel } = req.query;
    try {
        const sql = `SELECT e.num_Tel, e.nombre, e.apellido_pat, e.puesto, e.foto_perfil, d.nom_dep 
                     FROM Empleado e 
                     LEFT JOIN Departamento d ON e.id_dep = d.id_dep 
                     WHERE e.num_Tel = :tel`;
        const result = await runQuery(sql, { tel }, { fetchInfo: { "FOTO_PERFIL": { type: oracledb.BUFFER } } });
        if(result.rows.length > 0) res.json({ found: true, data: mapKeysToLowerCase(result.rows[0]) });
        else res.json({ found: false });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// 5. Actualizar Perfil (Foto / Datos)
exports.updateProfile = async (req, res) => {
    const { num_Tel, displayName, status, photoURL, password } = req.body;
    const parts = displayName.split(' ');
    const nombre = parts[0];
    const apellido = parts.slice(1).join(' ') || '';
    let fileBuffer = null;
    
    if (photoURL && photoURL.startsWith('data:')) fileBuffer = Buffer.from(photoURL.split(',')[1], 'base64');
    
    let sql = `UPDATE Empleado SET nombre = :1, apellido_pat = :2, puesto = :3`;
    let params = [nombre, apellido, status];
    
    if (password && password.trim() !== "") {
        sql += `, contrasena = :pass`;
        params.push(password);
    }
    if (fileBuffer) {
        sql += `, foto_perfil = :foto`;
        params.push({ val: fileBuffer, type: oracledb.BUFFER });
    }
    
    sql += ` WHERE num_Tel = :tel`;
    params.push(num_Tel);

    try { await runQuery(sql, params); res.json({ success: true }); } catch (e) { res.status(500).json({ error: e.message }); }
};