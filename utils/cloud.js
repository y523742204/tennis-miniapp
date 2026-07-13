const ENV = 'cloudbase-d8g9lkpfs4080e891';
let db = null;
let inited = false;

function init() {
  if (inited) return;
  wx.cloud.init({ env: ENV });
  inited = true;
}

function getDB() {
  init();
  if (!db) db = wx.cloud.database();
  return db;
}

module.exports = { getDB, init, ENV };
