const { ActivityStorage, TrainingStorage } = require('../../utils/storage');

const LEVELS = [];
for (let i = 0; i <= 10; i++) LEVELS.push((i * 0.5).toFixed(1));

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const ACTIVITY_TYPES = [
  { value: 'singles', label: '单打' },
  { value: 'doubles', label: '双打' },
  { value: 'practice', label: '练习' }
];

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

function addHours(time, hours) {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + hours * 60;
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return String(nh).padStart(2, '0') + ':' + String(nm).padStart(2, '0');
}

Page({
  data: {
    activities: [],
    myOpenid: '',
    _targetActivityId: '',
    scrollToId: '',
    showForm: false,
    formMode: 'add',
    formData: {
      date: '', dateLabel: '', time: '', endTime: '', location: '',
      maxMale: 4, maxFemale: 4,
      levelMinMale: 3.0,
      levelMinFemale: 2.5,
      fee: 60,
      type: 'doubles',
      totalPlayers: 4
    },
    formTypeIndex: 1,
    activityTypes: ACTIVITY_TYPES,
    expandedIdx: -1,
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

  onLoad(options) {
    if (options && options.activityId) {
      this._targetActivityId = options.activityId;
    }
  },

  async onShow() {
    await this._loadMyOpenid();
    await this._loadActivities();
    const uname = wx.getStorageSync('activity_user_name') || '';
    this.setData({ joinName: uname });
    if (this._targetActivityId) {
      const idx = this.data.activities.findIndex(a => a.id === this._targetActivityId);
      if (idx > -1) {
        this.setData({ expandedIdx: idx, scrollToId: 'act-' + this._targetActivityId });
      }
      this._targetActivityId = '';
    }
  },

  async _loadMyOpenid() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getOpenid' });
      if (res.result && res.result.openid) {
        this.setData({ myOpenid: res.result.openid });
      }
    } catch (e) {}
  },

  async _cleanupExpired() {
    try {
      const all = await ActivityStorage.getAll();
      const now = Date.now();
      const DAY_MS = 24 * 60 * 60 * 1000;
      for (const a of all) {
        if (!a.endTime) continue;
        const endMs = new Date(a.date + 'T' + a.endTime + ':00').getTime();
        if (now - endMs > DAY_MS) {
          await ActivityStorage.remove(a.id);
        }
      }
    } catch (e) {}
  },

  async _loadActivities() {
    await this._cleanupExpired();
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
      const t = ACTIVITY_TYPES.find(x => x.value === a.type);
      a.typeLabel = t ? t.label : '';
      a.levelMinMale = a.levelMinMale || 0;
      a.levelMinFemale = a.levelMinFemale || 0;
      a.levelStr = '男 ' + a.levelMinMale.toFixed(1) + '+ 女 ' + a.levelMinFemale.toFixed(1) + '+';
      a.maleDisplay = a.participants.filter(p => p.gender === 'male').map(p => p.name + ' ' + (typeof p.level === 'number' ? p.level.toFixed(1) : p.level));
      a.femaleDisplay = a.participants.filter(p => p.gender === 'female').map(p => p.name + ' ' + (typeof p.level === 'number' ? p.level.toFixed(1) : p.level));
      a.maleWaitDisplay = a.waitlist.filter(p => p.gender === 'male').map(p => p.name + ' ' + (typeof p.level === 'number' ? p.level.toFixed(1) : p.level));
      a.femaleWaitDisplay = a.waitlist.filter(p => p.gender === 'female').map(p => p.name + ' ' + (typeof p.level === 'number' ? p.level.toFixed(1) : p.level));
      a.totalPlayers = a.totalPlayers || 0;
      a.totalCount = a.participants.length;
      a._joined = a.participants.some(p => p.openid === this.data.myOpenid);
    });
    this.setData({ activities: list });
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
    const pwd = this._todayPwd();
    this.setData({ showPwd: true, pwdMode: 'publish', pwdInput: pwd });
    this.confirmPwd();
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
    const t = e.detail.value;
    this.setData({ 'formData.time': t, 'formData.endTime': addHours(t, 3) });
  },

  formEndTimeChange(e) {
    this.setData({ 'formData.endTime': e.detail.value });
  },

  formTypeChange(e) {
    const idx = Number(e.detail.value);
    const t = ACTIVITY_TYPES[idx];
    if (t) this.setData({ 'formData.type': t.value, formTypeIndex: idx });
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

    const maxMale = parseInt(fd.maxMale) || 0;
    const maxFemale = parseInt(fd.maxFemale) || 0;

    if (fd.id) {
      const existing = await ActivityStorage.get(fd.id);
      if (!existing) { wx.showToast({ title: '活动不存在', icon: 'none' }); return; }
      const pl = existing.participants || [];
      const wl = existing.waitlist || [];
      const overflow = (p) => (p.gender === 'male' ? pl.filter(x => x.gender === 'male').length > maxMale : pl.filter(x => x.gender === 'female').length > maxFemale);
      const moved = [];
      pl.forEach(p => {
        if (p.gender === 'male' && pl.filter(x => x.gender === 'male').indexOf(p) >= maxMale) moved.push(p);
        if (p.gender === 'female' && pl.filter(x => x.gender === 'female').indexOf(p) >= maxFemale) moved.push(p);
      });
      moved.forEach(p => {
        const pi = pl.indexOf(p);
        if (pi > -1) { pl.splice(pi, 1); wl.unshift(p); }
      });
      const record = {
        id: fd.id, date: fd.date, time: fd.time, endTime: fd.endTime,
        location: fd.location, maxMale, maxFemale,
        levelMinMale: parseFloat(fd.levelMinMale) || 0,
        levelMinFemale: parseFloat(fd.levelMinFemale) || 0,
        fee: parseInt(fd.fee) || 0, type: fd.type,
        totalPlayers: parseInt(fd.totalPlayers) || 0,
        participants: pl, waitlist: wl,
        creatorId: existing.creatorId,
        creatorName: existing.creatorName
      };
      await ActivityStorage.save(record);
      this.closeForm();
      wx.showToast({ title: '已更新', icon: 'success' });
    } else {
      const record = {
        date: fd.date, time: fd.time, endTime: fd.endTime, location: fd.location,
        maxMale, maxFemale,
        levelMinMale: parseFloat(fd.levelMinMale) || 0,
        levelMinFemale: parseFloat(fd.levelMinFemale) || 0,
        fee: parseInt(fd.fee) || 0, type: fd.type,
        totalPlayers: parseInt(fd.totalPlayers) || 0,
        participants: [], waitlist: [],
        creatorId: this.data.myOpenid,
        creatorName: wx.getStorageSync('activity_user_name') || '匿名'
      };
      const saved = await ActivityStorage.save(record);
      try {
        const [sh, sm] = fd.time.split(':').map(Number);
        const [eh, em] = fd.endTime.split(':').map(Number);
        const duration = (eh * 60 + em) - (sh * 60 + sm);
        await TrainingStorage.save({
          date: fd.date, startTime: fd.time, endTime: fd.endTime,
          duration, type: fd.type, level: parseFloat(fd.levelMinMale) || 0,
          court: fd.location, notes: '已发布活动'
        });
      } catch (e) { console.warn('create training from activity failed:', e); }
      this.closeForm();
      wx.showToast({ title: '活动已记录', icon: 'success' });
    }
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

    wx.showLoading({ title: '报名中...' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'joinActivity',
        data: {
          action: 'join',
          activityId: act.id,
          name: name,
          gender: this.data.joinGender,
          level: this.data.joinLevel
        }
      });
      wx.hideLoading();
      if (res.result && res.result.success) {
        wx.showToast({ title: res.result.waitlisted ? '已加入候补' : '已报名', icon: 'success' });
      } else {
        wx.showToast({ title: '报名失败', icon: 'none' });
      }
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '报名失败', icon: 'none' });
    }
    this.hideJoinDialog();
    await this._loadActivities();
  },

  async cancelJoin(e) {
    const idx = e.currentTarget.dataset.idx;
    const act = this.data.activities[idx];
    if (!act) return;
    const all = (act.participants || []).concat(act.waitlist || []);
    const me = all.filter(p => p.openid === this.data.myOpenid);
    if (me.length === 0) return;
    if (me.length === 1) {
      wx.showLoading({ title: '取消中...' });
      try {
        await wx.cloud.callFunction({
          name: 'joinActivity',
          data: { action: 'leave', activityId: act.id, name: me[0].name }
        });
        wx.hideLoading();
        wx.showToast({ title: '已取消', icon: 'success' });
      } catch (e) {
        wx.hideLoading();
        wx.showToast({ title: '取消失败', icon: 'none' });
      }
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
      formData: { date, dateLabel: fmtWeekday(date), time: '19:00', endTime: addHours('19:00', 3), location: '酷胜网球中心', maxMale: 4, maxFemale: 4, levelMinMale: 3.0, levelMinFemale: 2.5, fee: 60, type: 'doubles', totalPlayers: 4 }
    });
  },

  async deleteActivity(e) {
    const idx = e.currentTarget.dataset.idx;
    const act = this.data.activities[idx];
    if (!act) return;
    this.setData({ showPwd: true, pwdMode: 'delete', pwdInput: '', pwdTargetIdx: idx });
  },

  editActivity(e) {
    const idx = e.currentTarget.dataset.idx;
    const act = this.data.activities[idx];
    if (!act) return;
    wx.hideTabBar({ animation: false });
    this.setData({
      showForm: true, formMode: 'edit',
      formData: {
        id: act.id,
        date: act.date, dateLabel: fmtWeekday(act.date),
        time: act.time, endTime: act.endTime || addHours(act.time, 3),
        location: act.location,
        maxMale: act.maxMale, maxFemale: act.maxFemale,
        levelMinMale: act.levelMinMale, levelMinFemale: act.levelMinFemale,
        fee: act.fee || 0,
        totalPlayers: act.totalPlayers || 4
      }
    });
  },

  _confirmDelete() {
    const idx = this.data.pwdTargetIdx;
    const act = this.data.activities[idx];
    if (!act) return;
    this.setData({ pwdTargetIdx: -1 });
    if (act.creatorId !== this.data.myOpenid) {
      wx.showToast({ title: '仅有发布者可删除', icon: 'none' });
      return;
    }
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

  async selectCancelName(e) {
    const name = e.currentTarget.dataset.name;
    const act = this.data.activities[this.data.cancelTarget];
    if (!act) return;
    wx.showLoading({ title: '取消中...' });
    try {
      await wx.cloud.callFunction({
        name: 'joinActivity',
        data: { action: 'leave', activityId: act.id, name: name }
      });
      wx.hideLoading();
      this.setData({ cancelTarget: -1, cancelNames: [] });
      wx.showToast({ title: '已取消', icon: 'success' });
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '取消失败', icon: 'none' });
    }
    await this._loadActivities();
  },

  hideCancelPicker() {
    this.setData({ cancelTarget: -1, cancelNames: [] });
  },

  noop() {},

  onShareAppMessage(e) {
    if (e && e.target && e.target.dataset.idx !== undefined) {
      const act = this.data.activities[e.target.dataset.idx];
      if (act) {
        const m = act.date.slice(5);
        const title = m + ' ' + act.time + '-' + (act.endTime || act.time) + '\n' + act.location;
        const p = this.data.myOpenid ? this._genShareImage(act).then(img => {
          return { title, imageUrl: img, path: 'pages/activity/activity?activityId=' + act.id };
        }) : { title, path: 'pages/activity/activity?activityId=' + act.id };
        return p;
      }
    }
    return { title: '网球训练助手', path: 'pages/activity/activity' };
  },

  _genShareImage(act) {
    return new Promise((resolve) => {
      const W = 400, H = 400;
      wx.createSelectorQuery().select('#shareCanvas').node((res) => {
        const canvas = res.node;
        const ctx = canvas.getContext('2d');
        const dpr = wx.getSystemInfoSync().pixelRatio;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        ctx.scale(dpr, dpr);

        const typeMap = { singles: '单打', doubles: '双打', practice: '练习' };
        const t = typeMap[act.type] || '';

        // White background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, W, H);

        // Green header bar
        const hh = 56;
        const pad = 28;
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(0, 0, W, hh);
        ctx.font = 'bold 20px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        const weekday = ['日', '一', '二', '三', '四', '五', '六'][new Date(act.date + 'T00:00:00').getDay()];
        const headerText = act.date.slice(5) + ' 周' + weekday + '  ' + act.time + '-' + (act.endTime || act.time);
        ctx.fillText(headerText, W / 2, hh / 2);

        // Calculate vertical center for content
        const contentH = 280;
        let y = hh + (H - hh - contentH) / 2;

        // Location
        ctx.font = 'bold 32px sans-serif';
        ctx.fillStyle = '#222';
        ctx.textBaseline = 'top';
        ctx.textAlign = 'center';
        ctx.fillText(act.location, W / 2, y);
        y += 46;

        // Type
        ctx.font = 'bold 28px sans-serif';
        ctx.fillStyle = '#555';
        ctx.fillText(t, W / 2, y);
        y += 40;

        // Level limit
        const ll = '男 ' + (act.levelMinMale || 0).toFixed(1) + '+  女 ' + (act.levelMinFemale || 0).toFixed(1) + '+';
        ctx.font = '22px sans-serif';
        ctx.fillStyle = '#888';
        ctx.fillText('水平限制：' + ll, W / 2, y);
        y += 36;

        // Count row
        const mc = (act.participants || []).filter(p => p.gender === 'male').length;
        const fc = (act.participants || []).filter(p => p.gender === 'female').length;
        ctx.font = 'bold 26px sans-serif';
        ctx.fillStyle = '#333';
        ctx.fillText('男[' + mc + '/' + act.maxMale + ']  女[' + fc + '/' + act.maxFemale + ']  总[' + (mc + fc) + '/' + (act.totalPlayers || 0) + ']', W / 2, y);
        y += 38;

        // Fee
        if (act.fee) {
          ctx.font = '24px sans-serif';
          ctx.fillStyle = '#e67e22';
          ctx.textAlign = 'center';
          ctx.fillText(act.fee + '元/人', W / 2, y);
        }

        wx.canvasToTempFilePath({
          canvas, x: 0, y: 0, width: W, height: H,
          destWidth: W, destHeight: H,
          success: (res2) => resolve(res2.tempFilePath),
          fail: () => resolve('')
        });
      }).exec();
    });
  },
});