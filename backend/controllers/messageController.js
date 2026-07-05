const { runQuery, oracledb } = require('../config/database');
const { sanitizeValue, unprefixId, fixTimeForFrontend } = require('../utils/helpers');
const axios = require('axios');

const DEEPL_KEY = process.env.DEEPL_KEY;

// 1. Obtener historial de mensajes
exports.getMessages = async (req, res) => {
  const { chatId } = req.params;
  const { type } = req.query;
  const dbId = unprefixId(chatId); 

  let sql = type === 'group' 
    ? `SELECT m.id_msgGpal as ID_MSG, m.contenido, m.tipo_archivo, m.hora_envio, m.emisor, m.archivo, m.estado, e.nombre || ' ' || e.apellido_pat as SENDER_NAME FROM Mensajes_Gpal m JOIN Empleado e ON m.emisor = e.num_Tel WHERE m.id_ChatGpal = :id ORDER BY m.id_msgGpal ASC`
    : `SELECT m.id_msgInd as ID_MSG, m.contenido, m.tipo_archivo, m.hora_envio, m.emisor, m.archivo, m.estado, e.nombre || ' ' || e.apellido_pat as SENDER_NAME FROM Mensajes_Ind m JOIN Empleado e ON m.emisor = e.num_Tel WHERE m.id_ChatInd = :id ORDER BY m.id_msgInd ASC`;
       
  try {
    const result = await runQuery(sql, { id: dbId }, { fetchInfo: { "ARCHIVO": { type: oracledb.BUFFER } } });
    const processed = result.rows.map(row => {
        let mediaBase64 = null;
        let mimeType = 'image/jpeg'; 
        const tipoArchivo = sanitizeValue(row.TIPO_ARCHIVO);
        
        if (tipoArchivo === 'video') mimeType = 'video/mp4';
        else if (tipoArchivo === 'document') mimeType = 'application/pdf';
        else if (tipoArchivo === 'audio') mimeType = 'audio/webm';

        if (row.ARCHIVO && Buffer.isBuffer(row.ARCHIVO)) {
             mediaBase64 = `data:${mimeType};base64,${row.ARCHIVO.toString('base64')}`;
        }
        return {
            id_msg: sanitizeValue(row.ID_MSG),
            contenido: sanitizeValue(row.CONTENIDO),
            tipo_msg: tipoArchivo || 'text',
            hora_envio: fixTimeForFrontend(sanitizeValue(row.HORA_ENVIO)),
            senderId: sanitizeValue(row.EMISOR),
            senderName: sanitizeValue(row.SENDER_NAME),
            status: sanitizeValue(row.ESTADO),
            mediaContent: mediaBase64,
            isMe: false
        };
    });
    res.json(processed);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// 2. Enviar mensaje
exports.sendMessage = async (req, res) => {
  const { senderId, chatId, content, mediaContent, messageType, isGroup } = req.body;
  const dbId = unprefixId(chatId);
  let fileBuffer = null; 
  let cleanContent = content;
  
  if (mediaContent && messageType !== 'text') {
      try { 
        fileBuffer = Buffer.from(mediaContent.split(',')[1], 'base64');
        cleanContent = messageType === 'audio' ? 'Mensaje de voz' : 'Archivo adjunto'; 
      } catch (err) { console.error(err); }
  }
  
  const simpleTime = new Date().toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit', hour12: false});
  const params = { 
      p_chatId: dbId, p_senderId: senderId, p_content: cleanContent, 
      p_mediaFile: { val: fileBuffer, type: oracledb.BUFFER }, 
      p_msgType: messageType === 'text' ? null : messageType, p_hora: simpleTime 
  };
  
  try {
    const sql = isGroup 
      ? `INSERT INTO Mensajes_Gpal (id_ChatGpal, emisor, contenido, archivo, tipo_archivo, hora_envio, estado) VALUES (:p_chatId, :p_senderId, :p_content, :p_mediaFile, :p_msgType, :p_hora, 'enviado')`
      : `INSERT INTO Mensajes_Ind (id_ChatInd, emisor, contenido, archivo, tipo_archivo, hora_envio, estado) VALUES (:p_chatId, :p_senderId, :p_content, :p_mediaFile, :p_msgType, :p_hora, 'enviado')`;
    await runQuery(sql, params);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

// 3. Traducir contenido mediante la API de DeepL 
exports.translateMessage = async (req, res) => {
    const { text, targetLang, msgId, chatType } = req.body;
    const DEEPL_KEY = process.env.DEEPL_KEY;
    
    if (!DEEPL_KEY) return res.status(400).json({ error: "Falta configurar la API Key en el backend (.env)" });
    
    try {
        // Usamos el formato URL Encoded, que es el más estable para la API de DeepL
        const params = new URLSearchParams();
        params.append('text', text);
        params.append('target_lang', targetLang || 'ES');

        const response = await axios.post('https://api-free.deepl.com/v2/translate', params, { 
            headers: { 
                'Authorization': `DeepL-Auth-Key ${DEEPL_KEY}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            } 
        });
        
        const translatedText = response.data.translations[0].text;
        const detectedSourceLang = response.data.translations[0].detected_source_language;

        // Intentar persistir en Oracle de forma aislada
        try {
            if (chatType && msgId && !String(msgId).startsWith('temp')) {
                const table = chatType === 'group' ? 'Traduccion_Gpal' : 'Traduccion_Ind';
                const fkCol = chatType === 'group' ? 'id_msgGpal' : 'id_msgInd';
                const sql = `INSERT INTO ${table} (${fkCol}, idioma_origen, idioma_final, texto_traducido) VALUES (:1, :2, :3, :4)`;
                await runQuery(sql, [msgId, detectedSourceLang, targetLang, translatedText]);
            }
        } catch (dbError) {
            console.error("No se pudo guardar la traducción en Oracle (ignorando):", dbError.message);
        }

        res.json({ translatedText });
    } catch (error) { 
        console.error("Error DeepL:", error.response ? error.response.data : error.message);
        const apiError = error.response?.data?.message || error.message;
        res.status(500).json({ error: `DeepL rechazó la conexión: ${apiError}` }); 
    }
};

// 4. Marcar mensajes como leídos 
exports.markAsRead = async (req, res) => {
    const { chatId, userId } = req.body;
    const dbId = unprefixId(chatId);
    const isGroup = chatId.startsWith('G-');
    const table = isGroup ? 'Mensajes_Gpal' : 'Mensajes_Ind';
    const idCol = isGroup ? 'id_ChatGpal' : 'id_ChatInd';
    const sql = `UPDATE ${table} SET estado = 'visto' WHERE ${idCol} = :1 AND emisor != :2 AND estado = 'enviado'`;
    try {
        await runQuery(sql, [dbId, userId]);
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
};