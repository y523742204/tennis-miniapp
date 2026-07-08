const { TrainingStorage } = require('../../utils/storage');
const { getWeekDates, getTrainingType, TRAINING_TYPES, LEVEL_OPTIONS } = require('../../utils/format');

const START_HOUR = 6;
const END_HOUR = 22;
const ROW_HEIGHT = 120;
const COL_WIDTH = 175;
const TIME_WIDTH = 100;
const HEADER_HEIGHT = 80;

Page({
  data: {
    weekStartDate: '',
    weekLabel: '',
    days: [],
    hours: [],
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
    formTypeLabel: '底线',
    levelOptions: LEVEL_OPTIONS,
    levelIndex: 5,
    startTimeIndex: 0,
    endTimeIndex: 0,
    trainingTypes: TRAINING_TYPES
  },

  onLoad() {
    const h = [];
    for (let i = START_HOUR; i <= END_HOUR; i++) h.push(String(i).padStart(2, '0') + ':00');
    this.setData({ hours: h });
    this.goThisWeek();
  },

  onShow() {
    if (this.data.weekStartDate) this._refreshGrid();
  },

  _fmtDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  _loadWeek(dateStr) {
    const dates = getWeekDates(dateStr);
    const start = new Date(dates[0]);
    const end = new Date(dates[6]);
    const weekLabel = `${start.getMonth() + 1}月${start.getDate()}日 - ${end.getMonth() + 1}月${end.getDate()}日`;
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const todayStr = this._fmtDate(new Date());
    const days = dates.map(d => ({
      date: d, label: weekdays[new Date(d).getDay()], dateText: String(new Date(d).getDate()), isToday: d === todayStr
    }));
    this.setData({ weekStartDate: dates[0], weekLabel, days });
    this._refreshGrid();
  },

  _refreshGrid() {
    const { days, weekStartDate } = this.data;
    const weekEnd = this._fmtDate(new Date(new Date(weekStartDate).getTime() + 6 * 86400000));
    const records = TrainingStorage.getAll().filter(r => r.date >= weekStartDate && r.date <= weekEnd);
    const hasTrainingMap = {};
    records.forEach(r => {
      const di = days.findIndex(d => d.date === r.date);
      if (di < 0) return;
      const [sh] = r.startTime.split(':').map(Number);
      const [eh] = r.endTime.split(':').map(Number);
      for (let h = sh - START_HOUR; h < eh - START_HOUR; h++) hasTrainingMap[di + '-' + h] = true;
    });
    const cards = records.map(r => {
      const di = days.findIndex(d => d.date === r.date);
      if (di < 0) return null;
      const [sh] = r.startTime.split(':').map(Number);
      const [eh] = r.endTime.split(':').map(Number);
      const info = getTrainingType(r.type);
      return {
        id: r.id, date: r.date, startTime: r.startTime, endTime: r.endTime,
        duration: r.duration, type: r.type, level: r.level || 0,
        court: r.court || '', notes: r.notes || '',
        typeLabel: info.label, color: info.color,
        top: HEADER_HEIGHT + (sh - START_HOUR) * ROW_HEIGHT + 2,
        left: TIME_WIDTH + di * COL_WIDTH + 4,
        width: COL_WIDTH - 8,
        height: (eh - sh) * ROW_HEIGHT - 4
      };
    }).filter(Boolean);
    this.setData({ cards, hasTrainingMap });
  },

  prevWeek() {
    const d = new Date(this.data.weekStartDate);
    d.setDate(d.getDate() - 7);
    this._clearSelection();
    this._loadWeek(this._fmtDate(d));
  },

  nextWeek() {
    const d = new Date(this.data.weekStartDate);
    d.setDate(d.getDate() + 7);
    this._clearSelection();
    this._loadWeek(this._fmtDate(d));
  },

  goThisWeek() {
    this._clearSelection();
    this._loadWeek(this._fmtDate(new Date()));
  },

  _clearSelection() {
    this.setData({ selectedCells: [], selectedSet: {} });
  },

  onCellTap(e) {
    if (this.data.showForm || this.data.showDetail) return;
    const { day, hour } = e.currentTarget.dataset;
    const key = day + '-' + hour;
    if (this.data.hasTrainingMap[key]) {
      this._clearSelection();
      return;
    }
    const selected = [...this.data.selectedCells];
    const idx = selected.findIndex(c => c.day === day && c.hour === hour);
    if (idx > -1) selected.splice(idx, 1);
    else selected.push({ day: Number(day), hour: Number(hour) });
    const selectedSet = {};
    selected.forEach(c => { selectedSet[c.day + '-' + c.hour] = true; });
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
    const hours = cells.map(c => c.hour + START_HOUR).sort((a, b) => a - b);
    const sh = hours[0];
    const eh = hours[hours.length - 1] + 1;
    this.setData({
      formMode: 'add', showForm: true,
      formData: {
        date: dayData.date,
        startTime: String(sh).padStart(2, '0') + ':00',
        endTime: String(eh).padStart(2, '0') + ':00',
        type: 'baseline', level: 2.5, court: '', notes: ''
      },
      formTypeIndex: 0, formTypeLabel: '底线', levelIndex: 5,
      startTimeIndex: sh - START_HOUR, endTimeIndex: eh - START_HOUR
    });
  },

  onCardTap(e) {
    const record = TrainingStorage.get(e.currentTarget.dataset.id);
    if (!record) return;
    const info = getTrainingType(record.type);
    this.setData({
      showDetail: true,
      detailRecord: {
        ...record, typeLabel: info.label, color: info.color,
        levelText: record.level ? 'Lv ' + record.level : '未设置',
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
      formTypeLabel: typeIdx > -1 ? TRAINING_TYPES[typeIdx].label : '底线',
      levelIndex: levIdx > -1 ? levIdx : 5,
      startTimeIndex: r.startTime ? parseInt(r.startTime.split(':')[0]) - START_HOUR : 0,
      endTimeIndex: r.endTime ? parseInt(r.endTime.split(':')[0]) - START_HOUR : 0
    });
  },

  deleteFromDetail() {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条训练记录吗？',
      success: (res) => {
        if (res.confirm) {
          TrainingStorage.remove(this.data.detailRecord.id);
          this.setData({ showDetail: false, detailRecord: null });
          this._refreshGrid();
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
    const st = this.data.hours[idx] || '06:00';
    const ei = Math.max(idx + 1, this.data.endTimeIndex);
    this.setData({
      'formData.startTime': st,
      'formData.endTime': this.data.hours[ei],
      startTimeIndex: idx, endTimeIndex: ei
    });
  },

  pickEndTime(e) {
    const idx = Number(e.detail.value);
    if (idx <= this.data.startTimeIndex) {
      wx.showToast({ title: '结束需晚于开始', icon: 'none' });
      return;
    }
    this.setData({ 'formData.endTime': this.data.hours[idx], endTimeIndex: idx });
  },

  submitForm() {
    const fd = this.data.formData;
    const [sh, sm] = fd.startTime.split(':').map(Number);
    const [eh, em] = fd.endTime.split(':').map(Number);
    const duration = (eh * 60 + em) - (sh * 60 + sm);
    if (duration <= 0) {
      wx.showToast({ title: '结束需晚于开始', icon: 'none' });
      return;
    }
    const record = {
      id: fd.id || undefined, date: fd.date,
      startTime: fd.startTime, endTime: fd.endTime, duration,
      type: fd.type, level: fd.level, court: fd.court, notes: fd.notes
    };
    TrainingStorage.save(record);
    this.setData({ showForm: false, selectedCells: [], selectedSet: {} });
    wx.showToast({ title: fd.id ? '已更新' : '已添加', icon: 'success' });
    this._refreshGrid();
  }
});
