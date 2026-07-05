const { runQuery, oracledb } = require('../config/database');
const { sanitizeValue, unprefixId, mapKeysToLowerCase } = require('../utils/helpers');

// 1. Obtener lista unificada de Chats e Información del último mensaje
exports.getChats = async (req, res) => {
  const { num_Tel } = req.params;
  const sqlInd = `
    SELECT c.id_ChatInd as id, 
      CASE WHEN c.usuario_1 = :me THEN (SELECT nombre || ' ' || apellido_pat FROM Empleado WHERE num_Tel = c.usuario_2)
           ELSE (SELECT nombre || ' ' || apellido_pat FROM Empleado WHERE num_Tel = c.usuario_1)
      END as name, 
      CASE WHEN c.usuario_1 = :me THEN c.usuario_2 ELSE c.usuario_1 END as otherTel, 
      CASE WHEN c.usuario_1 = :me THEN (SELECT foto_perfil FROM Empleado WHERE num_Tel = c.usuario_2)
           ELSE (SELECT foto_perfil FROM Empleado WHERE num_Tel = c.usuario_1)
      END as photo,
      'individual' as type,
      (SELECT contenido FROM (SELECT contenido FROM Mensajes_Ind WHERE id_ChatInd = c.id_ChatInd ORDER BY id_msgInd DESC) WHERE ROWNUM = 1) as lastMessage,
      COALESCE(
        (SELECT fecha_envio FROM (SELECT fecha_envio FROM Mensajes_Ind WHERE id_ChatInd = c.id_ChatInd ORDER BY id_msgInd DESC) WHERE ROWNUM = 1),
        c.fecha_creacion
      ) as lastTimeReal
    FROM Chat_Individual c WHERE c.usuario_1 = :me OR c.usuario_2 = :me`;
  
  const sqlGpo = `
    SELECT cg.id_ChatGpal as id, cg.nombre_grupo as name, cg.foto_grupo as photo, 'group' as type,
           (SELECT contenido FROM (SELECT contenido FROM Mensajes_Gpal WHERE id_ChatGpal = cg.id_ChatGpal ORDER BY id_msgGpal DESC) WHERE ROWNUM = 1) as lastMessage,
           COALESCE(
             (SELECT fecha_envio FROM (SELECT fecha_envio FROM Mensajes_Gpal WHERE id_ChatGpal = cg.id_ChatGpal ORDER BY id_msgGpal DESC) WHERE ROWNUM = 1),
             cg.fecha_creacion
           ) as lastTimeReal
    FROM Chat_Grupal cg JOIN Miembros_Grupo mg ON cg.id_ChatGpal = mg.id_ChatGpal WHERE mg.num_Tel = :me`;
  
  try {
    const [resInd, resGpo] = await Promise.all([
        runQuery(sqlInd, { me: num_Tel }, { fetchInfo: { "PHOTO": { type: oracledb.BUFFER } } }), 
        runQuery(sqlGpo, { me: num_Tel }, { fetchInfo: { "PHOTO": { type: oracledb.BUFFER } } }) 
    ]);
    
    const processChats = (rows, prefix) => rows.map(r => {
        const mapped = mapKeysToLowerCase(r);
        let timeStr = r.LASTTIMEREAL ? new Date(r.LASTTIMEREAL).toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'}) : "Nuevo";
        return { 
            id: `${prefix}-${sanitizeValue(r.ID)}`, 
            name: sanitizeValue(r.NAME), 
            otherTel: sanitizeValue(r.OTHERTEL), 
            photoURL: mapped.photoURL || null, 
            isGroup: prefix === 'G', 
            lastMessage: sanitizeValue(r.LASTMESSAGE) || 'Iniciar conversación...', 
            lastTime: timeStr,
            timestamp: r.LASTTIMEREAL ? new Date(r.LASTTIMEREAL).getTime() : 0 
        };
    });

    const allChats = [...processChats(resInd.rows, 'I'), ...processChats(resGpo.rows, 'G')].sort((a, b) => b.timestamp - a.timestamp);
    res.json(allChats);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// 2. Iniciar chat individual
exports.startChat = async (req, res) => {
    const { num_Tel1, num_Tel2 } = req.body;
    try {
        let result = await runQuery(`SELECT id_ChatInd FROM Chat_Individual WHERE (usuario_1 = :t1 AND usuario_2 = :t2) OR (usuario_1 = :t2 AND usuario_2 = :t1)`, { t1: num_Tel1, t2: num_Tel2 });
        let chatId = result.rows.length > 0 ? result.rows[0].ID_CHATIND : null;
        if (!chatId) {
            await runQuery(`INSERT INTO Chat_Individual (usuario_1, usuario_2) VALUES (:t1, :t2)`, { t1: num_Tel1, t2: num_Tel2 });
            const newRes = await runQuery(`SELECT id_ChatInd FROM Chat_Individual WHERE (usuario_1 = :t1 AND usuario_2 = :t2) OR (usuario_1 = :t2 AND ... )`, { t1: num_Tel1, t2: num_Tel2 });
            chatId = newRes.rows[0].ID_CHATIND;
        }
        const nameRes = await runQuery(`SELECT e.nombre || ' ' || e.apellido_pat as NAME, e.foto_perfil FROM Empleado e WHERE e.num_Tel = :tel`, { tel: num_Tel2 }, { fetchInfo: { "FOTO_PERFIL": { type: oracledb.BUFFER } } });
        const userData = mapKeysToLowerCase(nameRes.rows[0]);
        res.json({ success: true, chat: { id: `I-${chatId}`, name: userData.name, photoURL: userData.photoURL, isGroup: false } });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// 3. Eliminar chat completo 
exports.deleteChat = async (req, res) => {
    const { chatId } = req.params;
    const isGroup = chatId.startsWith('G-');
    const dbId = unprefixId(chatId);
    try {
        if (isGroup) {
            await runQuery(`DELETE FROM Traduccion_Gpal WHERE id_msgGpal IN (SELECT id_msgGpal FROM Mensajes_Gpal WHERE id_ChatGpal = :id)`, { id: dbId });
            await runQuery(`DELETE FROM Mensajes_Gpal WHERE id_ChatGpal = :id`, { id: dbId });
            await runQuery(`DELETE FROM Miembros_Grupo WHERE id_ChatGpal = :id`, { id: dbId });
            await runQuery(`DELETE FROM Chat_Grupal WHERE id_ChatGpal = :id`, { id: dbId });
        } else {
            await runQuery(`DELETE FROM Traduccion_Ind WHERE id_msgInd IN (SELECT id_msgInd FROM Mensajes_Ind WHERE id_ChatInd = :id)`, { id: dbId });
            await runQuery(`DELETE FROM Mensajes_Ind WHERE id_ChatInd = :id`, { id: dbId });
            await runQuery(`DELETE FROM Chat_Individual WHERE id_ChatInd = :id`, { id: dbId });
        }
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// 4. Crear Grupo nuevo
exports.createGroup = async (req, res) => {
    const { name, adminTel, members } = req.body;
    try {
        await runQuery(`INSERT INTO Chat_Grupal (nombre_grupo, admin_tel) VALUES (:1, :2)`, [name, adminTel]);
        const idRes = await runQuery(`SELECT MAX(id_ChatGpal) as ID FROM Chat_Grupal WHERE admin_tel = :1`, [adminTel]);
        const groupId = idRes.rows[0].ID;
        const allMembers = [...new Set([adminTel, ...members])];
        for (const memberTel of allMembers) {
            await runQuery(`INSERT INTO Miembros_Grupo (id_ChatGpal, num_Tel) VALUES (:1, :2)`, [groupId, memberTel]);
        }
        res.json({ success: true, groupId });
    } catch (e) { res.status(500).json({ error: "Error creando grupo" }); }
};

// 5. Agregar un contacto 
exports.addContact = async (req, res) => {
  const { ownerTel, contactTel } = req.body;
  try {
    await runQuery(`INSERT INTO Contactos (usuario_dueno, usuario_agregado) VALUES (:1, :2)`, [ownerTel, contactTel]);
    const check = await runQuery(`SELECT id_ChatInd FROM Chat_Individual WHERE (usuario_1=:t1 AND usuario_2=:t2) OR (usuario_1=:t2 AND usuario_2=:t1)`, { t1: ownerTel, t2: contactTel });
    if(check.rows.length === 0) await runQuery(`INSERT INTO Chat_Individual (usuario_1, usuario_2) VALUES (:t1, :t2)`, { t1: ownerTel, t2: contactTel }); 
    res.json({ success: true });
  } catch (e) { res.status(500).json({ success: false, message: "Error o contacto ya existe" }); }
};

// 6. Listar contactos vinculados
exports.getContacts = async (req, res) => {
    const { tel } = req.params;
    const sql = `SELECT e.num_Tel, e.nombre, e.apellido_pat, e.puesto, e.correo, e.foto_perfil, d.nom_dep FROM Contactos c JOIN Empleado e ON c.usuario_agregado = e.num_Tel LEFT JOIN Departamento d ON e.id_dep = d.id_dep WHERE c.usuario_dueno = :tel`;
    try {
        const result = await runQuery(sql, { tel }, { fetchInfo: { "FOTO_PERFIL": { type: oracledb.BUFFER } } });
        res.json(result.rows.map(mapKeysToLowerCase));
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// 7. Eliminar contacto de la agenda
exports.deleteContact = async (req, res) => {
    const { ownerTel, contactTel } = req.body;
    try {
        await runQuery(`DELETE FROM Contactos WHERE usuario_dueno = :1 AND usuario_agregado = :2`, [ownerTel, contactTel]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// 8. Actualizar imagen identificadora del grupo
exports.updateGroupProfile = async (req, res) => {
    const { groupId, photoURL } = req.body;
    const dbId = unprefixId(groupId);
    let fileBuffer = null;
    if (photoURL && photoURL.startsWith('data:')) fileBuffer = Buffer.from(photoURL.split(',')[1], 'base64');
    if (!fileBuffer) return res.status(400).json({ error: "Foto inválida" });
    try {
        await runQuery(`UPDATE Chat_Grupal SET foto_grupo = :1 WHERE id_ChatGpal = :2`, [{ val: fileBuffer, type: oracledb.BUFFER }, dbId]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// 9. Listar los miembros activos de un grupo
exports.getGroupMembers = async (req, res) => {
    const { groupId } = req.params;
    const dbId = unprefixId(groupId);
    try {
        const result = await runQuery(`SELECT e.nombre, e.apellido_pat, e.num_Tel, e.foto_perfil FROM Miembros_Grupo mg JOIN Empleado e ON mg.num_Tel = e.num_Tel WHERE mg.id_ChatGpal = :groupId`, { groupId: dbId }, { fetchInfo: { "FOTO_PERFIL": { type: oracledb.BUFFER } } });
        res.json(result.rows.map(mapKeysToLowerCase));
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// 10. Añadir miembro a un grupo existente
exports.addGroupMember = async (req, res) => {
    const { groupId } = req.params;
    const { memberTel } = req.body;
    const dbId = unprefixId(groupId);
    try {
        await runQuery(`INSERT INTO Miembros_Grupo (id_ChatGpal, num_Tel) VALUES (:1, :2)`, [dbId, memberTel]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
};

// 11.Eliminar miembro del grupo
exports.removeGroupMember = async (req, res) => {
    const { groupId, memberTel } = req.params;
    const dbId = unprefixId(groupId);
    try {
        await runQuery(`DELETE FROM Miembros_Grupo WHERE id_ChatGpal = :1 AND num_Tel = :2`, [dbId, memberTel]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
};