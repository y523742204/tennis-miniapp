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
      levelMinMale: 3.0,
      levelMinFemale: 2.5
    },
    expandedIdx: -1,
    debugInfo: '',
    cancelTarget: -1,
    cancelNames: [],
    showPwd: false,
    pwdMode: '',
    pwdInput: '',
    pwdTargetIdx: -1,
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
    let id = wx.getStorageSync('my_openid') || '';
    if (!id) {
      id = 'local_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      wx.setStorageSync('my_openid', id);
    }
    this.setData({ myOpenid: id });
  },

  async _loadActivities() {
    const list = await ActivityStorage.getAll();
    list.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    list.forEach(a => {
      a.participants = a.participants || [];
      a.waitlist = a.waitlist || [];
      a.maleCount = a.participants.filter(p => p.gender === 'male').length;
      a.femaleCount = a.participants.filter(p => p.gender === 'female').length;
      a.maleWaitCount = a.waitlist.filter(p => p.gender === 'male').length;
      a.femaleWaitCount = a.waitlist.filter(p => p.gender === 'female').length;
      a.weekday = WEEKDAYS[new Date(a.date + 'T00:00:00').getDay()];
      a.levelMinMale = a.levelMinMale || 0;
      a.levelMinFemale = a.levelMinFemale || 0;
      a.levelStr = '男 ' + a.levelMinMale.toFixed(1) + '+ 女 ' + a.levelMinFemale.toFixed(1) + '+';
      a.maleDisplay = a.participants.filter(p => p.gender === 'male').map(p => p.name + ' ' + (typeof p.level === 'number' ? p.level.toFixed(1) : p.level));
      a.femaleDisplay = a.participants.filter(p => p.gender === 'female').map(p => p.name + ' ' + (typeof p.level === 'number' ? p.level.toFixed(1) : p.level));
      a.maleWaitDisplay = a.waitlist.filter(p => p.gender === 'male').map(p => p.name + ' ' + (typeof p.level === 'number' ? p.level.toFixed(1) : p.level));
      a.femaleWaitDisplay = a.waitlist.filter(p => p.gender === 'female').map(p => p.name + ' ' + (typeof p.level === 'number' ? p.level.toFixed(1) : p.level));
    });
    const first = list[0];
    this.setData({ activities: list, debugInfo: 'myId:' + this.data.myOpenid + (first ? ' | pids:' + first.participants.map(p => p.openid).join(',') : '') });
  },

  _todayPwd() {
    const d = new Date();
    return String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  },

  _datePwd(dateStr) {
    const parts = dateStr.split('-');
    return parts[1] + parts[2];
  },

  openForm() {
    this.setData({ showPwd: true, pwdMode: 'publish', pwdInput: '' });
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
      levelMinFemale: parseFloat(fd.levelMinFemale) || 0,
      participants: [],
      waitlist: [],
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
    this.setData({ showJoinDialog: true, joinTarget: idx, joinName: uname, joinGender: 'male', joinLevel: 3.0, joinLevelIdx: 6 });
  },

  hideJoinDialog() {
    this.setData({ showJoinDialog: false, joinTarget: null });
  },

  onJoinNameInput(e) {
    this.setData({ joinName: e.detail.value });
  },

  selectJoinGender(e) {
    const gender = e.currentTarget.dataset.gender;
    const level = gender === 'male' ? 3.0 : 2.5;
    const idx = gender === 'male' ? 6 : 5;
    this.setData({ joinGender: gender, joinLevel: level, joinLevelIdx: idx });
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
    const isFull = gender === 'male'
      ? act.participants.filter(p => p.gender === 'male').length >= act.maxMale
      : act.participants.filter(p => p.gender === 'female').length >= act.maxFemale;
    const obj = { name, gender, level: this.data.joinLevel, openid: this.data.myOpenid };
    if (isFull) {
      act.waitlist.push(obj);
      wx.showToast({ title: '名额已满，已加入候补', icon: 'none' });
    } else {
      act.participants.push(obj);
      wx.showToast({ title: '已报名', icon: 'success' });
    }
    await ActivityStorage.save(act);
    this.hideJoinDialog();
    await this._loadActivities();
  },

  _removePerson(act, p) {
    const pi = act.participants.indexOf(p);
    if (pi > -1) {
      act.participants.splice(pi, 1);
      const wi = act.waitlist.findIndex(w => w.gender === p.gender);
      if (wi > -1) act.participants.push(act.waitlist.splice(wi, 1)[0]);
      return;
    }
    const wi = act.waitlist.indexOf(p);
    if (wi > -1) act.waitlist.splice(wi, 1);
  },

  async cancelJoin(e) {
    const idx = e.currentTarget.dataset.idx;
    const act = this.data.activities[idx];
    if (!act) return;
    const all = (act.participants || []).concat(act.waitlist || []);
    const me = all.filter(p => p.openid === this.data.myOpenid);
    if (me.length === 0) return;
    if (me.length === 1) {
      this._removePerson(act, me[0]);
      await ActivityStorage.save(act);
      wx.showToast({ title: '已取消', icon: 'success' });
      await this._loadActivities();
    } else {
      this.setData({ cancelTarget: idx, cancelNames: me.map(p => p.name) });
    }
  },

  isJoined(act) {
    return (act.participants || []).some(p => p.openid === this.data.myOpenid);
  },

  onPwdInput(e) {
    this.setData({ pwdInput: e.detail.value });
  },

  confirmPwd() {
    const mode = this.data.pwdMode;
    let correct = false;
    if (mode === 'publish') {
      correct = this.data.pwdInput === this._todayPwd();
    } else if (mode === 'delete') {
      const act = this.data.activities[this.data.pwdTargetIdx];
      if (act) correct = this.data.pwdInput === this._datePwd(act.date);
    }
    if (!correct) {
      wx.showToast({ title: '密码错误', icon: 'none' });
      return;
    }
    this.setData({ showPwd: false, pwdInput: '' });
    if (mode === 'publish') this._doPublish();
    else if (mode === 'delete') this._confirmDelete();
  },

  async _doPublish() {
    wx.hideTabBar({ animation: false });
    const today = new Date();
    const date = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
    this.setData({
      showForm: true, formMode: 'add',
      formData: { date, dateLabel: fmtWeekday(date), time: '19:00', location: '酷胜网球中心', maxMale: 8, maxFemale: 8, levelMinMale: 3.0, levelMinFemale: 2.5 }
    });
  },

  async deleteActivity(e) {
    const idx = e.currentTarget.dataset.idx;
    const act = this.data.activities[idx];
    if (!act) return;
    this.setData({ showPwd: true, pwdMode: 'delete', pwdInput: '', pwdTargetIdx: idx });
  },

  _confirmDelete() {
    const idx = this.data.pwdTargetIdx;
    const act = this.data.activities[idx];
    if (!act) return;
    this.setData({ pwdTargetIdx: -1 });
    wx.showModal({
      title: '删除活动',
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

  toggleExpand(e) {
    const idx = e.currentTarget.dataset.idx;
    this.setData({ expandedIdx: this.data.expandedIdx === idx ? -1 : idx });
  },

  hidePwd() {
    this.setData({ showPwd: false, pwdInput: '' });
  },

  selectCancelName(e) {
    const name = e.currentTarget.dataset.name;
    const act = this.data.activities[this.data.cancelTarget];
    if (!act) return;
    const all = (act.participants || []).concat(act.waitlist || []);
    const p = all.find(p => p.name === name && p.openid === this.data.myOpenid);
    if (!p) return;
    this._removePerson(act, p);
    ActivityStorage.save(act).then(() => {
      this.setData({ cancelTarget: -1, cancelNames: [] });
      wx.showToast({ title: '已取消', icon: 'success' });
      this._loadActivities();
    });
  },

  hideCancelPicker() {
    this.setData({ cancelTarget: -1, cancelNames: [] });
  },

  noop() {},

});