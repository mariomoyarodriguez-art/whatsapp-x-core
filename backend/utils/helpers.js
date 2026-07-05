const oracledb = require('oracledb');

const sanitizeValue = (val) => {
    if (val === null || val === undefined) return null;
    if (Buffer.isBuffer(val)) return val; 
    if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return val;
    if (val instanceof Date) return val.toISOString();
    try { return String(val); } catch (e) { return "Dato ilegible"; }
};

const unprefixId = (id) => {
    if (!id) return id;
    return id.toString().replace(/^[IG]-/, '');
};


const mapKeysToLowerCase = (obj) => {
  const newObj = {};
  if (!obj) return newObj;
  
  Object.keys(obj).forEach(key => {
    const val = obj[key];
    if ((key === 'FOTO_PERFIL' || key === 'PHOTO' || key === 'FOTO_GRUPO') && Buffer.isBuffer(val)) {
        newObj['photoURL'] = `data:image/jpeg;base64,${val.toString('base64')}`;
    } else if (key === 'NUM_TEL') newObj['num_Tel'] = val;
    else if (key === 'APELLIDO_PAT') newObj['apellido_pat'] = val;
    else if (key === 'APELLIDO_MAT') newObj['apellido_mat'] = val;
    else if (key === 'ID_DEP') newObj['id_dep'] = val;
    else if (key === 'NOM_DEP') newObj['departamento'] = val;
    else if (key === 'ID_CHATIND') newObj['id'] = val;
    else if (key === 'NOMBRE') newObj['name'] = val;
    else if (key === 'OTHERTEL') newObj['otherTel'] = val;
    else newObj[key.toLowerCase()] = val;
  });
  return newObj;
};


const fixTimeForFrontend = (timeStr) => {
    if (!timeStr) return new Date().toISOString(); 
    if (timeStr.includes('T') || timeStr.includes('-')) return timeStr;
    const today = new Date().toISOString().split('T')[0]; 
    return `${today}T${timeStr}:00`; 
};

module.exports = {
    sanitizeValue,
    unprefixId,
    mapKeysToLowerCase,
    fixTimeForFrontend
};