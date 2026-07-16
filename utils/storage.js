const { getDB } = require('./cloud');

const COLLECTION_MAP = {
  training: { cloud: 'trainings', local: 'tennis_training' },
  court: { cloud: 'courts', local: 'tennis_court' },
  schedule: { cloud: 'schedules', local: 'tennis_schedule' },
  activity: { cloud: 'activity', local: 'tennis_activity' }
};

function getLocal(key) {
  try { return wx.getStorageSync(key) || []; } catch (e) { return []; }
}

function setLocal(key, data) {
  try { wx.setStorageSync(key, data); } catch (e) {}
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function createStorage(type) {
  const { cloud: colName, local: localKey } = COLLECTION_MAP[type];

  return {
    async getAll() {
      try {
        const db = getDB();
        const res = await db.collection(colName)
          .where({ _openid: '{openid}' })
          .get();
        const data = (res.data || []).map(r => ({ ...r, id: r._id }));
        data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        if (data.length > 0) setLocal(localKey, data);
        return data.length > 0 ? data : getLocal(localKey);
      } catch (e) {
        console.warn('[' + colName + '] cloud getAll failed, fallback to local:', e);
        return getLocal(localKey);
      }
    },

    async get(id) {
      try {
        const db = getDB();
        const res = await db.collection(colName).doc(id).get();
        if (res.data) {
          const record = { ...res.data, id: res.data._id };
          const local = getLocal(localKey);
          const idx = local.findIndex(r => r.id === id);
          if (idx > -1) local[idx] = record;
          else local.unshift(record);
          setLocal(localKey, local);
          return record;
        }
        return null;
      } catch (e) {
        console.warn('[' + colName + '] cloud get failed, fallback to local:', e);
        return getLocal(localKey).find(r => r.id === id);
      }
    },

    async save(record) {
      try {
        const db = getDB();
        const data = JSON.parse(JSON.stringify(record));
        delete data.id;
        delete data._id;

        data.createdAt = record.createdAt || Date.now();
        if (record.id) {
          const docId = record.id;
          try {
            await db.collection(colName).doc(docId).update({ data });
          } catch (updateErr) {
            await db.collection(colName).doc(docId).set({ data });
          }
          record._id = docId;
          record.id = docId;
        } else {
          const res = await db.collection(colName).add({ data });
          record._id = res._id;
          record.id = res._id;
        }

        const local = getLocal(localKey);
        const idx = local.findIndex(r => r.id === record.id);
        if (idx > -1) local[idx] = { ...record };
        else local.unshift({ ...record });
        setLocal(localKey, local);

        return record;
      } catch (e) {
        console.warn('[' + colName + '] cloud save failed, fallback to local:', e);
        const local = getLocal(localKey);
        if (record.id) {
          const idx = local.findIndex(r => r.id === record.id);
          if (idx > -1) local[idx] = record;
        } else {
          record.id = genId();
          record.createdAt = Date.now();
          local.unshift(record);
        }
        setLocal(localKey, local);
        return record;
      }
    },

    async remove(id) {
      try {
        const db = getDB();
        await db.collection(colName).doc(id).remove();
      } catch (e) {
        console.warn('[' + colName + '] cloud remove failed:', e);
      }
      const local = getLocal(localKey).filter(r => r.id !== id);
      setLocal(localKey, local);
    }
  };
}

const TrainingStorage = {
  getAll: createStorage('training').getAll,
  get: createStorage('training').get,
  save: createStorage('training').save,
  remove: createStorage('training').remove,
  async getByDate(date) {
    const all = await this.getAll();
    return all.filter(r => r.date === date);
  },
  async getByMonth(year, month) {
    const prefix = year + '-' + String(month).padStart(2, '0');
    const all = await this.getAll();
    return all.filter(r => r.date.startsWith(prefix));
  }
};

const CourtStorage = createStorage('court');
const ScheduleStorage = createStorage('schedule');

async function migrateLocalToCloud() {
  const items = [
    { name: '训练记录', localKey: COLLECTION_MAP.training.local, cloud: COLLECTION_MAP.training.cloud },
    { name: '球场', localKey: COLLECTION_MAP.court.local, cloud: COLLECTION_MAP.court.cloud },
    { name: '排赛', localKey: COLLECTION_MAP.schedule.local, cloud: COLLECTION_MAP.schedule.cloud }
  ];
  let total = 0;
  for (const item of items) {
    const localData = getLocal(item.localKey);
    for (const record of localData) {
      if (!record._id) {
        const data = { ...record };
        delete data.id;
        delete data._id;
        try {
          const db = getDB();
          const res = await db.collection(item.cloud).add({ data });
          record._id = res._id;
          record.id = res._id;
          total++;
        } catch (e) {
          console.warn('[migration] failed to save ' + item.name + ' record:', e);
        }
      }
    }
    setLocal(item.localKey, localData);
  }
  return total;
}

const ActivityStorage = {
  ...createStorage('activity'),
  async getAll() {
    try {
      const db = getDB();
      const res = await db.collection('activity').get();
      const data = (res.data || []).map(r => ({ ...r, id: r._id }));
      if (data.length > 0) setLocal('tennis_activity', data);
      return data.length > 0 ? data : getLocal('tennis_activity');
    } catch (e) {
      return getLocal('tennis_activity');
    }
  }
};

module.exports = { TrainingStorage, CourtStorage, ScheduleStorage, ActivityStorage, migrateLocalToCloud };
