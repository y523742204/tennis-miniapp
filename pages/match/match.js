const { MatchStorage } = require('../../utils/storage');
const { formatDateCN, formatScore } = require('../../utils/format');

Page({
  data: {
    records: [],
    showForm: false,
    formMode: 'add',
    formData: {
      date: '',
      opponent: '',
      sets: [{ myGames: 0, oppGames: 0 }],
      win: true,
      notes: ''
    },
    showDetail: false,
    detailRecord: null
  },

  onLoad() {
    const now = new Date();
    const d = this._fmtDate(now);
    this.setData({ 'formData.date': d });
  },

  onShow() {
    this._loadRecords();
  },

  _fmtDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

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
      formMode: 'add',
      showForm: true,
      formData: {
        date: this._fmtDate(new Date()),
        opponent: '',
        sets: [{ myGames: 0, oppGames: 0 }],
        win: true,
        notes: ''
      }
    });
  },

  closeForm() {
    this.setData({ showForm: false });
  },

  formInput(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [`formData.${field}`]: e.detail.value });
  },

  formDateChange(e) {
    this.setData({ 'formData.date': e.detail.value });
  },

  formWinChange(e) {
    this.setData({ 'formData.win': e.detail.value === 'true' });
  },

  addSet() {
    const sets = [...this.data.formData.sets, { myGames: 0, oppGames: 0 }];
    this.setData({ 'formData.sets': sets });
  },

  removeSet() {
    const sets = this.data.formData.sets;
    if (sets.length <= 1) return;
    sets.pop();
    this.setData({ 'formData.sets': [...sets] });
  },

  setInput(e) {
    const { idx, side } = e.currentTarget.dataset;
    const sets = [...this.data.formData.sets];
    sets[idx] = { ...sets[idx], [side]: parseInt(e.detail.value) || 0 };
    this.setData({ 'formData.sets': sets });
  },

  submitForm() {
    const fd = this.data.formData;
    if (!fd.opponent) {
      wx.showToast({ title: '请输入对手', icon: 'none' });
      return;
    }
    const totalMy = fd.sets.reduce((s, set) => s + set.myGames, 0);
    const totalOpp = fd.sets.reduce((s, set) => s + set.oppGames, 0);
    const win = totalMy >= totalOpp;
    const record = {
      id: fd.id || undefined,
      date: fd.date,
      opponent: fd.opponent,
      sets: fd.sets,
      win,
      notes: fd.notes
    };
    MatchStorage.save(record);
    this.setData({ showForm: false });
    wx.showToast({ title: fd.id ? '已更新' : '已添加', icon: 'success' });
    this._loadRecords();
  },

  onCardTap(e) {
    const id = e.currentTarget.dataset.id;
    const r = MatchStorage.get(id);
    if (r) {
      this.setData({
        showDetail: true,
        detailRecord: {
          ...r,
          scoreStr: formatScore(r.sets),
          dateCN: formatDateCN(r.date),
          winText: r.win ? '胜' : '负',
          winClass: r.win ? 'win' : 'lose'
        }
      });
    }
  },

  closeDetail() {
    this.setData({ showDetail: false, detailRecord: null });
  },

  editFromDetail() {
    const r = this.data.detailRecord;
    this.setData({
      showDetail: false,
      formMode: 'edit',
      showForm: true,
      formData: {
        id: r.id,
        date: r.date,
        opponent: r.opponent,
        sets: r.sets,
        win: r.win,
        notes: r.notes || ''
      }
    });
  },

  deleteFromDetail() {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这场比赛记录吗？',
      success: (res) => {
        if (res.confirm) {
          MatchStorage.remove(this.data.detailRecord.id);
          this.setData({ showDetail: false, detailRecord: null });
          this._loadRecords();
        }
      }
    });
  }
});
