const { ActivityStorage } = require('../../utils/storage');

const LEVELS = [];
for (let i = 0; i <= 10; i++) LEVELS.push((i * 0.5).toFixed(1));

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function fmtWeekday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return dateStr + ' ' + WEEKDAYS[d.getDay()];
}

function fmtLevels(min, max) {
  if (min === undefined || max === undefined) return '';
  return min + '–' + max;
}

function fmtPcount(list, gender) {
  return (list || []).filter(p => p.gender === gender).length;
}

Page({
  data: {
    activities: [],
    myOpenid: '',
    showForm: false,
    formMode: 'add',
    formData: {
      date: '', dateLabel: '', time: '', location: '',
      maxMale: 8, maxFemale: 8,
      levelMinMale: 3.0, levelMaxMale: 4.5,
      levelMinFemale: 2.5, levelMaxFemale: 4.0
    },
    levels: LEVELS,
    showJoinDialog: false,
    joinTarget: null,
    joinName: '',
    joinGender: 'male',
    joinLevel: 0,
    joinLevelIdx: 0
  },

  async onShow() {
    await this._loadMyOpenid();
    await this._loadActivities();
    const uname = wx.getStorageSync('activity_user_name') || '';
    this.setData({ joinName: uname });
  },

  async _loadMyOpenid() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getOpenid' });
      if (res.result && res.result.openid) {
        this.setData({ myOpenid: res.result.openid });
        return;
      }
    } catch (e) {}
    const stored = wx.getStorageSync('my_openid') || '';
    if (stored) {
      this.setData({ myOpenid: stored });
    } else {
      const id = 'local_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      wx.setStorageSync('my_openid', id);
      this.setData({ myOpenid: id });
    }
  },

  async _loadActivities() {
    const list = await ActivityStorage.getAll();
    list.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    list.forEach(a => {
      a.participants = a.participants || [];
      a.maleCount = a.participants.filter(p => p.gender === 'male').length;
      a.femaleCount = a.participants.filter(p => p.gender === 'female').length;
      a.weekday = WEEKDAYS[new Date(a.date + 'T00:00:00').getDay()];
    });
    this.setData({ activities: list });
  },

  openForm() {
    wx.hideTabBar({ animation: false });
    const today = new Date();
    const date = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    this.setData({
      showForm: true, formMode: 'add',
      formData: { date, dateLabel: fmtWeekday(date), time: '19:00', location: '酷胜网球中心', maxMale: 8, maxFemale: 8, levelMinMale: 3.0, levelMaxMale: 4.5, levelMinFemale: 2.5, levelMaxFemale: 4.0 }
    });
  },

  closeForm() {
    this.setData({ showForm: false });
    wx.showTabBar({ animation: false });
  },

  formInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ ['formData.' + field]: e.detail.value });
  },

  formDateChange(e) {
    const date = e.detail.value;
    this.setData({ 'formData.date': date, 'formData.dateLabel': fmtWeekday(date) });
  },

  formTimeChange(e) {
    this.setData({ 'formData.time': e.detail.value });
  },

  formLevelChange(e) {
    const field = e.currentTarget.dataset.field;
    const val = parseFloat(LEVELS[e.detail.value]) || 0;
    this.setData({ ['formData.' + field]: val });
  },

  async submitForm() {
    const fd = this.data.formData;
    if (!fd.date || !fd.time) { wx.showToast({ title: '请选择时间', icon: 'none' }); return; }
    if (!fd.location) { wx.showToast({ title: '请输入地点', icon: 'none' }); return; }
    if (fd.maxMale < 0 || fd.maxFemale < 0) { wx.showToast({ title: '人数不能为负', icon: 'none' }); return; }

    const record = {
      date: fd.date,
      time: fd.time,
      location: fd.location,
      maxMale: parseInt(fd.maxMale) || 0,
      maxFemale: parseInt(fd.maxFemale) || 0,
      levelMinMale: parseFloat(fd.levelMinMale) || 0,
      levelMaxMale: parseFloat(fd.levelMaxMale) || 5,
      levelMinFemale: parseFloat(fd.levelMinFemale) || 0,
      levelMaxFemale: parseFloat(fd.levelMaxFemale) || 5,
      participants: [],
      creatorId: this.data.myOpenid,
      creatorName: wx.getStorageSync('activity_user_name') || '匿名'
    };
    await ActivityStorage.save(record);
    this.closeForm();
    wx.showToast({ title: '活动已发布', icon: 'success' });
    await this._loadActivities();
  },

  showJoinDialog(e) {
    const idx = e.currentTarget.dataset.idx;
    const act = this.data.activities[idx];
    if (!act) return;
    const uname = wx.getStorageSync('activity_user_name') || '';
    this.setData({ showJoinDialog: true, joinTarget: idx, joinName: uname, joinGender: 'male', joinLevel: 0, joinLevelIdx: 0 });
  },

  hideJoinDialog() {
    this.setData({ showJoinDialog: false, joinTarget: null });
  },

  onJoinNameInput(e) {
    this.setData({ joinName: e.detail.value });
  },

  selectJoinGender(e) {
    this.setData({ joinGender: e.currentTarget.dataset.gender });
  },

  selectJoinLevel(e) {
    const idx = e.detail.value;
    this.setData({ joinLevel: parseFloat(LEVELS[idx]) || 0, joinLevelIdx: idx });
  },

  async confirmJoin() {
    const act = this.data.activities[this.data.joinTarget];
    if (!act) return;
    const name = this.data.joinName.trim();
    if (!name) { wx.showToast({ title: '请输入姓名', icon: 'none' }); return; }
    wx.setStorageSync('activity_user_name', name);

    act.participants.push({ name, gender: this.data.joinGender, level: this.data.joinLevel, openid: this.data.myOpenid });
    await ActivityStorage.save(act);
    this.hideJoinDialog();
    wx.showToast({ title: '已报名', icon: 'success' });
    await this._loadActivities();
  },

  async cancelJoin(e) {
    const idx = e.currentTarget.dataset.idx;
    const act = this.data.activities[idx];
    if (!act) return;
    act.participants = act.participants.filter(p => p.openid !== this.data.myOpenid);
    await ActivityStorage.save(act);
    wx.showToast({ title: '已取消报名', icon: 'success' });
    await this._loadActivities();
  },

  async deleteActivity(e) {
    const idx = e.currentTarget.dataset.idx;
    const act = this.data.activities[idx];
    if (!act) return;
    if (act.creatorId !== this.data.myOpenid) {
      wx.showToast({ title: '仅有发布者可删除', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '确认删除',
      content: '删除「' + act.date + ' ' + act.time + ' ' + act.location + '」？',
      success: async (r) => {
        if (r.confirm) {
          await ActivityStorage.remove(act.id);
          wx.showToast({ title: '已删除', icon: 'success' });
          await this._loadActivities();
        }
      }
    });
  },

  noop() {},

  isJoined(act) {
    return (act.participants || []).some(p => p.openid === this.data.myOpenid);
  },

  isCreator(act) {
    return act.creatorId === this.data.myOpenid;
  },

});