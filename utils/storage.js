const STORAGE_KEYS = {
  TRAINING: 'tennis_training',
  MATCH: 'tennis_match',
  COURT: 'tennis_court',
  SCHEDULE: 'tennis_schedule'
};

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function getData(key) {
  return wx.getStorageSync(key) || [];
}

function setData(key, data) {
  wx.setStorageSync(key, data);
}

// 训练记录
const TrainingStorage = {
  getAll() {
    return getData(STORAGE_KEYS.TRAINING);
  },
  getByDate(date) {
    return getData(STORAGE_KEYS.TRAINING).filter(r => r.date === date);
  },
  getByMonth(year, month) {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    return getData(STORAGE_KEYS.TRAINING).filter(r => r.date.startsWith(prefix));
  },
  get(id) {
    return getData(STORAGE_KEYS.TRAINING).find(r => r.id === id);
  },
  save(record) {
    const records = getData(STORAGE_KEYS.TRAINING);
    if (record.id) {
      const i = records.findIndex(r => r.id === record.id);
      if (i > -1) records[i] = record;
    } else {
      record.id = genId();
      record.createdAt = Date.now();
      records.unshift(record);
    }
    setData(STORAGE_KEYS.TRAINING, records);
    return record;
  },
  remove(id) {
    setData(STORAGE_KEYS.TRAINING, getData(STORAGE_KEYS.TRAINING).filter(r => r.id !== id));
  }
};

// 比赛记录
const MatchStorage = {
  getAll() {
    return getData(STORAGE_KEYS.MATCH);
  },
  get(id) {
    return getData(STORAGE_KEYS.MATCH).find(r => r.id === id);
  },
  save(record) {
    const records = getData(STORAGE_KEYS.MATCH);
    if (record.id) {
      const i = records.findIndex(r => r.id === record.id);
      if (i > -1) records[i] = record;
    } else {
      record.id = genId();
      record.createdAt = Date.now();
      records.unshift(record);
    }
    setData(STORAGE_KEYS.MATCH, records);
    return record;
  },
  remove(id) {
    setData(STORAGE_KEYS.MATCH, getData(STORAGE_KEYS.MATCH).filter(r => r.id !== id));
  }
};

// 球场
const CourtStorage = {
  getAll() {
    return getData(STORAGE_KEYS.COURT);
  },
  get(id) {
    return getData(STORAGE_KEYS.COURT).find(r => r.id === id);
  },
  save(record) {
    const records = getData(STORAGE_KEYS.COURT);
    if (record.id) {
      const i = records.findIndex(r => r.id === record.id);
      if (i > -1) records[i] = record;
    } else {
      record.id = genId();
      record.createdAt = Date.now();
      records.unshift(record);
    }
    setData(STORAGE_KEYS.COURT, records);
    return record;
  },
  remove(id) {
    setData(STORAGE_KEYS.COURT, getData(STORAGE_KEYS.COURT).filter(r => r.id !== id));
  }
};

// 排赛记录
const ScheduleStorage = {
  getAll() {
    return getData(STORAGE_KEYS.SCHEDULE);
  },
  get(id) {
    return getData(STORAGE_KEYS.SCHEDULE).find(r => r.id === id);
  },
  save(record) {
    const records = getData(STORAGE_KEYS.SCHEDULE);
    if (record.id) {
      const i = records.findIndex(r => r.id === record.id);
      if (i > -1) records[i] = record;
    } else {
      record.id = genId();
      record.createdAt = Date.now();
      records.unshift(record);
    }
    setData(STORAGE_KEYS.SCHEDULE, records);
    return record;
  },
  remove(id) {
    setData(STORAGE_KEYS.SCHEDULE, getData(STORAGE_KEYS.SCHEDULE).filter(r => r.id !== id));
  }
};

module.exports = { TrainingStorage, MatchStorage, CourtStorage, ScheduleStorage };
