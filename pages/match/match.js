const { MatchStorage, ScheduleStorage } = require('../../utils/storage');
const { formatDateCN, formatScore } = require('../../utils/format');
const { generateSchedule } = require('../../utils/scheduler');

Page({
  data: {
    tab: 'record',
    records: [],

    // 记录表单
    showForm: false,
    formMode: 'add',
    formData: {
      date: '', opponent: '',
      sets: [{ myGames: 0, oppGames: 0 }],
      win: true, notes: ''
    },
    showDetail: false,
    detailRecord: null,

    // 排赛
    schedules: [],
    scheduleForm: {
      mode: 'singles',
      maleCount: 4,
      femaleCount: 0,
      rounds: 3,
      courts: 2
    },
    currentSchedule: null
  },

  onLoad() {
    this.setData({ 'formData.date': this._fmtDate(new Date()) });
  },

  onShow() {
    this._loadRecords();
    this._loadSchedules();
  },

  _fmtDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  // ─── Tab ───────────────────────

  switchTab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab, currentSchedule: null });
  },

  // ─── 比赛记录 ───────────────────

  _loadRecords() {
    const records = MatchStorage.getAll();
    this.setData({ records: records.map(r => ({
      ...r,
      scoreStr: formatScore(r.sets),
      dateCN: formatDateCN(r.date),
      winText: r.win ? '胜' : '负',
      winClass: r.win ? 'win' : 'lose'
    }))});
  },

  showAddForm() {
    this.setData({
      formMode: 'add', showForm: true,
      formData: { date: this._fmtDate(new Date()), opponent: '', sets: [{ myGames: 0, oppGames: 0 }], win: true, notes: '' }
    });
  },

  closeForm() { this.setData({ showForm: false }); },

  formInput(e) { this.setData({ ['formData.' + e.currentTarget.dataset.field]: e.detail.value }); },

  formDateChange(e) { this.setData({ 'formData.date': e.detail.value }); },

  formWinChange(e) { this.setData({ 'formData.win': e.detail.value === 'true' }); },

  addSet() {
    const sets = [...this.data.formData.sets, { myGames: 0, oppGames: 0 }];
    this.setData({ 'formData.sets': sets });
  },

  removeSet() {
    const s = this.data.formData.sets;
    if (s.length <= 1) return;
    s.pop();
    this.setData({ 'formData.sets': [...s] });
  },

  setInput(e) {
    const { idx, side } = e.currentTarget.dataset;
    const sets = [...this.data.formData.sets];
    sets[idx] = { ...sets[idx], [side]: parseInt(e.detail.value) || 0 };
    this.setData({ 'formData.sets': sets });
  },

  submitForm() {
    const fd = this.data.formData;
    if (!fd.opponent) { wx.showToast({ title: '请输入对手', icon: 'none' }); return; }
    const totalMy = fd.sets.reduce((s, set) => s + set.myGames, 0);
    const totalOpp = fd.sets.reduce((s, set) => s + set.oppGames, 0);
    MatchStorage.save({ id: fd.id || undefined, date: fd.date, opponent: fd.opponent, sets: fd.sets, win: totalMy >= totalOpp, notes: fd.notes });
    this.setData({ showForm: false });
    wx.showToast({ title: fd.id ? '已更新' : '已添加', icon: 'success' });
    this._loadRecords();
  },

  onCardTap(e) {
    const r = MatchStorage.get(e.currentTarget.dataset.id);
    if (r) this.setData({ showDetail: true, detailRecord: { ...r, scoreStr: formatScore(r.sets), dateCN: formatDateCN(r.date), winText: r.win ? '胜' : '负', winClass: r.win ? 'win' : 'lose' } });
  },

  closeDetail() { this.setData({ showDetail: false, detailRecord: null }); },

  editFromDetail() {
    const r = this.data.detailRecord;
    this.setData({ showDetail: false, formMode: 'edit', showForm: true, formData: { id: r.id, date: r.date, opponent: r.opponent, sets: r.sets, win: r.win, notes: r.notes || '' } });
  },

  deleteFromDetail() {
    wx.showModal({
      title: '确认删除', content: '确定要删除这场比赛记录吗？',
      success: (res) => {
        if (res.confirm) { MatchStorage.remove(this.data.detailRecord.id); this.setData({ showDetail: false, detailRecord: null }); this._loadRecords(); }
      }
    });
  },

  // ─── 排赛 ───────────────────────

  _loadSchedules() {
    this.setData({ schedules: ScheduleStorage.getAll() });
  },

  scheduleFormChange(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ ['scheduleForm.' + field]: Number(e.detail.value) });
  },

  scheduleModeChange(e) {
    this.setData({ 'scheduleForm.mode': e.detail.value === 0 ? 'singles' : 'doubles' });
  },

  generateSchedule() {
    const f = this.data.scheduleForm;
    if (f.maleCount + f.femaleCount < (f.mode === 'doubles' ? 4 : 2)) {
      wx.showToast({ title: f.mode === 'doubles' ? '至少需要4人' : '至少需要2人', icon: 'none' });
      return;
    }
    if (f.rounds < 1 || f.courts < 1) {
      wx.showToast({ title: '轮数和场地数须≥1', icon: 'none' });
      return;
    }
    const result = generateSchedule(f.mode, f.maleCount, f.femaleCount, f.rounds, f.courts);
    this.setData({ currentSchedule: result });
  },

  saveSchedule() {
    const s = this.data.currentSchedule;
    if (!s) return;
    ScheduleStorage.save(s);
    this.setData({ currentSchedule: null });
    wx.showToast({ title: '已保存排赛', icon: 'success' });
    this._loadSchedules();
  },

  viewSchedule(e) {
    const s = ScheduleStorage.get(e.currentTarget.dataset.id);
    if (s) this.setData({ currentSchedule: s });
  },

  deleteSchedule(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除', content: '确定要删除该排赛吗？',
      success: (res) => {
        if (res.confirm) { ScheduleStorage.remove(id); this._loadSchedules(); }
      }
    });
  },

  goBackToList() {
    this.setData({ currentSchedule: null });
  }
});
