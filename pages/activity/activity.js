const { ActivityStorage } = require('../../utils/storage');

const LEVELS = [];
for (let i = 0; i <= 10; i++) LEVELS.push((i * 0.5).toFixed(1));

function fmtLevels(min, max) {
  if (min === undefined || max === undefined) return '';
  return min + '–' + max;
}

function fmtPcount(list, gender) {
  return list.filter(p => p.gender === gender).length;
}

Page({
  data: {
    activities: [],
    myOpenid: '',
    showForm: false,
    formMode: 'add',
    formData: {
      date: '', time: '', location: '',
      maxMale: 8, maxFemale: 6,
      levelMinMale: 0, levelMaxMale: 5,
      levelMinFemale: 0, levelMaxFemale: 5
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
    const now = new Date();
    list.forEach(a => {
      const dt = new Date(a.date + 'T' + a.time);
      a.expired = dt < now;
      a.maleCount = a.participants ? a.participants.filter(p => p.gender === 'male').length : 0;
      a.femaleCount = a.participants ? a.participants.filter(p => p.gender === 'female').length : 0;
    });
    this.setData({ activities: list });
  },

  openForm() {
    wx.hideTabBar({ animation: false });
    const today = new Date();
    const date = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    this.setData({
      showForm: true, formMode: 'add',
      formData: { date, time: '14:00', location: '', maxMale: 8, maxFemale: 6, levelMinMale: 0, levelMaxMale: 5, levelMinFemale: 0, levelMaxFemale: 5 }
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
    this.setData({ 'formData.date': e.detail.value });
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

    const gender = this.data.joinGender;
    const level = this.data.joinLevel;

    if (gender === 'male') {
      if (level < act.levelMinMale || level > act.levelMaxMale) {
        wx.showToast({ title: '级别不符合要求(男' + fmtLevels(act.levelMinMale, act.levelMaxMale) + ')', icon: 'none' });
        return;
      }
      if (fmtPcount(act.participants, 'male') >= act.maxMale) {
        wx.showToast({ title: '男名额已满', icon: 'none' });
        return;
      }
    } else {
      if (level < act.levelMinFemale || level > act.levelMaxFemale) {
        wx.showToast({ title: '级别不符合要求(女' + fmtLevels(act.levelMinFemale, act.levelMaxFemale) + ')', icon: 'none' });
        return;
      }
      if (fmtPcount(act.participants, 'female') >= act.maxFemale) {
        wx.showToast({ title: '女名额已满', icon: 'none' });
        return;
      }
    }

    act.participants.push({ name, gender, level, openid: this.data.myOpenid });
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
    return act.participants.some(p => p.openid === this.data.myOpenid);
  },

  isCreator(act) {
    return act.creatorId === this.data.myOpenid;
  },

  canJoin(act) {
    if (act.expired) return false;
    if (this.isJoined(act)) return false;
    const maleOpen = fmtPcount(act.participants, 'male') < act.maxMale;
    const femaleOpen = fmtPcount(act.participants, 'female') < act.maxFemale;
    return maleOpen || femaleOpen;
  }
});