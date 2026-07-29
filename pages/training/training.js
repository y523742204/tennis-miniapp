const { TrainingStorage } = require('../../utils/storage');
const { getWeekDates, getTrainingType, TRAINING_TYPES, LEVEL_OPTIONS } = require('../../utils/format');

const START_HOUR = 6;
const END_HOUR = 24;
const ROW_HEIGHT = 60;
const COL_WIDTH = 175;
const TIME_WIDTH = 100;
const HEADER_HEIGHT = 80;

Page({
  data: {
    weekStartDate: '',
    weekLabel: '',
    currentDate: '',
    days: [],
    slots: [],
    pickerItems: [],
    cards: [],
    hasTrainingMap: {},
    selectedCells: [],
    selectedSet: {},

    showDetail: false,
    detailRecord: null,

    showForm: false,
    formMode: 'add',
    formData: {},
    formTypeIndex: 0,
    formTypeLabel: '拉球',
    levelOptions: LEVEL_OPTIONS,
    levelIndex: 5,
    startTimeIndex: 0,
    endTimeIndex: 0,
    trainingTypes: TRAINING_TYPES,

    myOpenid: ''
  },

  async onLoad() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getOpenid' });
      if (res.result && res.result.openid) this.setData({ myOpenid: res.result.openid });
    } catch (e) {
      console.error('[training] getOpenid failed:', e);
    }
    const slotList = [];
    const items = [];
    for (let h = START_HOUR; h < END_HOUR; h++) {
      slotList.push({ text: `${String(h).padStart(2, '0')}:00`, isHour: true });
      slotList.push({ text: `${String(h).padStart(2, '0')}:30`, isHour: false });
    }
    slotList.push({ text: '24:00', isHour: true, isEnd: true });
    for (let h = START_HOUR; h <= END_HOUR; h++) {
      items.push(`${String(h).padStart(2, '0')}:00`);
      if (h < END_HOUR) items.push(`${String(h).padStart(2, '0')}:30`);
    }
    this.setData({ slots: slotList, pickerItems: items, currentDate: this._fmtDate(new Date()) });
    this.goThisWeek();
  },

  async onShow() {
    if (this.data.weekStartDate) await this._refreshGrid();
  },

  _fmtDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  _slotIndex(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return ((h - START_HOUR) * 60 + m) / 30;
  },

  async _loadWeek(dateStr) {
    const dates = getWeekDates(dateStr);
    const start = new Date(dates[0]);
    const end = new Date(dates[6]);
    const weekLabel = `${start.getMonth() + 1}月${start.getDate()}日 - ${end.getMonth() + 1}月${end.getDate()}日`;
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const todayStr = this._fmtDate(new Date());
    const days = dates.map(d => ({
      date: d, label: weekdays[new Date(d).getDay()], dateText: String(new Date(d).getDate()), isToday: d === todayStr
    }));
    const today = this._fmtDate(new Date());
    this.setData({ weekStartDate: dates[0], weekLabel, days, currentDate: today >= dates[0] && today <= dates[6] ? today : dates[0] });
    await this._refreshGrid();
  },

  async _refreshGrid() {
    const { days, weekStartDate } = this.data;
    const weekEnd = this._fmtDate(new Date(new Date(weekStartDate).getTime() + 6 * 86400000));
    const records = (await TrainingStorage.getAll(this.data.myOpenid)).filter(r => r.date >= weekStartDate && r.date <= weekEnd);
    const hasTrainingMap = {};
    records.forEach(r => {
      const di = days.findIndex(d => d.date === r.date);
      if (di < 0) return;
      const si = this._slotIndex(r.startTime);
      const ei = this._slotIndex(r.endTime);
      for (let s = si; s < ei; s++) hasTrainingMap[di + '-' + s] = true;
    });
    const cards = records.map(r => {
      const di = days.findIndex(d => d.date === r.date);
      if (di < 0) return null;
      const si = this._slotIndex(r.startTime);
      const ei = this._slotIndex(r.endTime);
      const info = getTrainingType(r.type);
      const infoLines = [r.level, r.court, r.notes].filter(Boolean).length;
      const totalLines = 1 + infoLines;
      const cardH = (ei - si) * ROW_HEIGHT - 4;
      let fontSize = Math.min(26, Math.floor((cardH - 4) / (totalLines * 1.3)));
      if (fontSize < 18) fontSize = 18;
      return {
        id: r.id, date: r.date, startTime: r.startTime, endTime: r.endTime,
        duration: r.duration, type: r.type, level: r.level || 0,
        court: r.court || '', notes: r.notes || '',
        typeLabel: info.label, color: info.color, fontSize,
        top: HEADER_HEIGHT + si * ROW_HEIGHT - 15,
        left: TIME_WIDTH + di * COL_WIDTH - 10,
        width: COL_WIDTH - 10,
        height: cardH
      };
    }).filter(Boolean);
    this.setData({ cards, hasTrainingMap });
  },

  async prevWeek() {
    const d = new Date(this.data.weekStartDate);
    d.setDate(d.getDate() - 7);
    this._clearSelection();
    await this._loadWeek(this._fmtDate(d));
  },

  async nextWeek() {
    const d = new Date(this.data.weekStartDate);
    d.setDate(d.getDate() + 7);
    this._clearSelection();
    await this._loadWeek(this._fmtDate(d));
  },

  async goThisWeek() {
    this._clearSelection();
    await this._loadWeek(this._fmtDate(new Date()));
  },

  async onDatePick(e) {
    this._clearSelection();
    await this._loadWeek(e.detail.value);
  },

  _clearSelection() {
    this.setData({ selectedCells: [], selectedSet: {} });
  },

  onCellTap(e) {
    if (this.data.showForm || this.data.showDetail) return;
    const { day, slot } = e.currentTarget.dataset;
    const key = day + '-' + slot;
    if (this.data.hasTrainingMap[key]) {
      this._clearSelection();
      return;
    }
    const selected = [...this.data.selectedCells];
    const idx = selected.findIndex(c => c.day === day && c.slot === slot);
    if (idx > -1) selected.splice(idx, 1);
    else selected.push({ day: Number(day), slot: Number(slot) });
    const selectedSet = {};
    selected.forEach(c => { selectedSet[c.day + '-' + c.slot] = true; });
    this.setData({ selectedCells: selected, selectedSet });
  },

  showAddForm() {
    const cells = this.data.selectedCells;
    if (!cells.length) return;
    const days = [...new Set(cells.map(c => c.day))];
    if (days.length > 1) {
      wx.showToast({ title: '请选择同一天的时段', icon: 'none' });
      return;
    }
    const dayData = this.data.days[days[0]];
    const slotVals = cells.map(c => c.slot).sort((a, b) => a - b);
    const startIdx = slotVals[0];
    const endIdx = slotVals[slotVals.length - 1] + 1;
    const startMin = START_HOUR * 60 + startIdx * 30;
    const endMin = START_HOUR * 60 + endIdx * 30;
    this.setData({
      formMode: 'add', showForm: true,
      formData: {
        date: dayData.date,
        startTime: `${String(Math.floor(startMin / 60)).padStart(2, '0')}:${String(startMin % 60).padStart(2, '0')}`,
        endTime: `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`,
        type: 'rally', level: 2.5, court: '', notes: ''
      },
      formTypeIndex: 0, formTypeLabel: '拉球', levelIndex: 5,
      startTimeIndex: startIdx, endTimeIndex: endIdx
    });
  },

  async onCardTap(e) {
    const record = await TrainingStorage.get(e.currentTarget.dataset.id);
    if (!record) return;
    const info = getTrainingType(record.type);
    this.setData({
      showDetail: true,
      detailRecord: {
        ...record, typeLabel: info.label, color: info.color,
        levelText: record.level != null ? String(record.level) : '未设置',
        durationText: record.duration + '分钟'
      }
    });
  },

  closeDetail(e) {
    if (!e.target.dataset.close) return;
    this.setData({ showDetail: false, detailRecord: null });
  },

  editFromDetail() {
    const r = this.data.detailRecord;
    const typeIdx = TRAINING_TYPES.findIndex(t => t.value === r.type);
    const levIdx = LEVEL_OPTIONS.indexOf(r.level || 0);
    this.setData({
      showDetail: false, formMode: 'edit', showForm: true,
      formData: {
        id: r.id, date: r.date, startTime: r.startTime, endTime: r.endTime,
        type: r.type, level: r.level || 0, court: r.court || '', notes: r.notes || ''
      },
      formTypeIndex: typeIdx > -1 ? typeIdx : 0,
      formTypeLabel: typeIdx > -1 ? TRAINING_TYPES[typeIdx].label : '拉球',
      levelIndex: levIdx > -1 ? levIdx : 5,
      startTimeIndex: this._slotIndex(r.startTime),
      endTimeIndex: this._slotIndex(r.endTime)
    });
  },

  deleteFromDetail() {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条训练记录吗？',
      success: async (res) => {
        if (res.confirm) {
          await TrainingStorage.remove(this.data.detailRecord.id);
          this.setData({ showDetail: false, detailRecord: null });
          await this._refreshGrid();
        }
      }
    });
  },

  cancelForm() {
    this.setData({ showForm: false });
    if (this.data.formMode === 'add') this._clearSelection();
  },

  closeForm(e) {
    if (!e.target.dataset.close) return;
    this.cancelForm();
  },

  formInput(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ ['formData.' + field]: e.detail.value });
  },

  formSelectType(e) {
    const idx = Number(e.detail.value);
    const t = TRAINING_TYPES[idx];
    if (t) this.setData({ 'formData.type': t.value, formTypeIndex: idx, formTypeLabel: t.label });
  },

  formSelectLevel(e) {
    const idx = Number(e.detail.value);
    this.setData({ 'formData.level': LEVEL_OPTIONS[idx], levelIndex: idx });
  },

  pickStartTime(e) {
    const idx = Number(e.detail.value);
    const st = this.data.pickerItems[idx] || '06:00';
    const ei = Math.max(idx + 1, this.data.endTimeIndex);
    this.setData({
      'formData.startTime': st,
      'formData.endTime': this.data.pickerItems[ei],
      startTimeIndex: idx, endTimeIndex: ei
    });
  },

  pickEndTime(e) {
    const idx = Number(e.detail.value);
    if (idx <= this.data.startTimeIndex) {
      wx.showToast({ title: '结束需晚于开始', icon: 'none' });
      return;
    }
    this.setData({ 'formData.endTime': this.data.pickerItems[idx], endTimeIndex: idx });
  },

  async submitForm() {
    const fd = this.data.formData;
    const [sh, sm] = fd.startTime.split(':').map(Number);
    const [eh, em] = fd.endTime.split(':').map(Number);
    const duration = (eh * 60 + em) - (sh * 60 + sm);
    if (duration <= 0) {
      wx.showToast({ title: '结束需晚于开始', icon: 'none' });
      return;
    }
    const newStart = sh * 60 + sm;
    const newEnd = eh * 60 + em;
    const allRecords = await TrainingStorage.getAll(this.data.myOpenid);
    const overlap = allRecords.some(r => {
      if (r.date !== fd.date) return false;
      if (fd.id && r.id === fd.id) return false;
      const [rh, rm] = r.startTime.split(':').map(Number);
      const [r2h, r2m] = r.endTime.split(':').map(Number);
      return newStart < (r2h * 60 + r2m) && newEnd > (rh * 60 + rm);
    });
    if (overlap) {
      wx.showToast({ title: '该时段已有训练记录', icon: 'none' });
      return;
    }
    const record = {
      id: fd.id || undefined, date: fd.date,
      startTime: fd.startTime, endTime: fd.endTime, duration,
      type: fd.type, level: fd.level, court: fd.court, notes: fd.notes
    };
    await TrainingStorage.save(record);
    this.setData({ showForm: false, selectedCells: [], selectedSet: {} });
    wx.showToast({ title: fd.id ? '已更新' : '已添加', icon: 'success' });
    await this._refreshGrid();
  },

  onShareAppMessage() {
    return { title: '网球训练助手', path: 'pages/training/training' };
  }
});
