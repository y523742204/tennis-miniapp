const { ScheduleStorage } = require('../../utils/storage');
const { generateSchedule } = require('../../utils/scheduler');

function defaultNames(maleCount, femaleCount) {
  const names = [];
  for (let i = 1; i <= maleCount; i++) names.push('男' + i);
  for (let i = 1; i <= femaleCount; i++) names.push('女' + i);
  return names;
}
function defaultCourts(mode, maleCount, femaleCount, firstRoundType) {
  const n = maleCount + femaleCount;
  if (mode === 'singles' || firstRoundType === 'single') return Math.floor(n / 2) || 1;
  return Math.floor(n / 4) || 1;
}

Page({
  data: {
    schedules: [],
    scheduleForm: {
      mode: 'doubles',
      maleCount: 4,
      femaleCount: 4,
      playerNames: defaultNames(4, 4),
      maleNames: defaultNames(4, 4).slice(0, 4),
      femaleNames: defaultNames(4, 4).slice(4),
      rounds: 5,
      courts: defaultCourts('doubles', 4, 4, 'normal'),
      roundTypes: ['normal', 'mixed', 'mixed', 'mixed', 'mixed']
    },
    currentSchedule: null,
    editMode: false,
    editData: {
      waitingPlayers: [],
      selected: null,
      selKey: null
    }
  },

  onShow() {
    this._loadSchedules();
  },

  _loadSchedules() {
    this.setData({ schedules: ScheduleStorage.getAll() });
  },

  scheduleFormChange(e) {
    const { field } = e.currentTarget.dataset;
    const val = Number(e.detail.value) + (field === 'rounds' || field === 'courts' ? 1 : 0);
    const patch = { ['scheduleForm.' + field]: val };
    if (field === 'maleCount' || field === 'femaleCount') {
      const mc = field === 'maleCount' ? val : this.data.scheduleForm.maleCount;
      const fc = field === 'femaleCount' ? val : this.data.scheduleForm.femaleCount;
      const names = defaultNames(mc, fc);
      patch['scheduleForm.playerNames'] = names;
      patch['scheduleForm.maleNames'] = names.slice(0, mc);
      patch['scheduleForm.femaleNames'] = names.slice(mc);
      const firstType = this.data.scheduleForm.roundTypes[0];
      patch['scheduleForm.courts'] = defaultCourts(this.data.scheduleForm.mode, mc, fc, firstType);
    }
    if (field === 'rounds') {
      const cur = this.data.scheduleForm.roundTypes;
      patch['scheduleForm.roundTypes'] = val > cur.length
        ? [...cur, ...Array(val - cur.length).fill('mixed')]
        : cur.slice(0, val);
    }
    this.setData(patch);
  },

  scheduleModeChange(e) {
    const mode = e.detail.value === 0 ? 'singles' : 'doubles';
    const { maleCount, femaleCount, roundTypes } = this.data.scheduleForm;
    this.setData({
      'scheduleForm.mode': mode,
      'scheduleForm.courts': defaultCourts(mode, maleCount, femaleCount, roundTypes[0])
    });
  },

  roundTypeChange(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const types = [...this.data.scheduleForm.roundTypes];
    types[idx] = Number(e.detail.value) === 0 ? 'normal' : 'mixed';
    this.setData({ 'scheduleForm.roundTypes': types });
  },

  playerNameInput(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const names = [...this.data.scheduleForm.playerNames];
    names[idx] = e.detail.value;
    const mc = this.data.scheduleForm.maleCount;
    this.setData({
      'scheduleForm.playerNames': names,
      'scheduleForm.maleNames': names.slice(0, mc),
      'scheduleForm.femaleNames': names.slice(mc)
    });
  },

  generateSchedule() {
    const f = this.data.scheduleForm;
    const total = f.playerNames.length;
    if (total < (f.mode === 'doubles' ? 4 : 2)) {
      wx.showToast({ title: f.mode === 'doubles' ? '至少需要4人' : '至少需要2人', icon: 'none' });
      return;
    }
    if (f.rounds < 1 || f.courts < 1) {
      wx.showToast({ title: '轮数和场地数须≥1', icon: 'none' });
      return;
    }
    const names = f.playerNames.map(n => n.trim() || '选手' + (f.playerNames.indexOf(n) + 1));
    const players = names.map((n, i) => ({ label: n, gender: i < f.maleCount ? 'male' : 'female' }));
    const result = generateSchedule(f.mode, players, f.rounds, f.courts, f.roundTypes);
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
    if (s) {
      for (const round of s.schedule || []) {
        for (const m of round.matches || []) {
          if (!m.display) m.display = (m.teams || []).map(t => (t || []).join('')).join(' vs ');
        }
      }
      this.setData({ currentSchedule: s });
    }
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
    this.setData({ currentSchedule: null, editMode: false, editData: { waitingPlayers: [], selected: null, selKey: null } });
  },

  toggleEdit() {
    const s = this.data.currentSchedule;
    if (this.data.editMode) {
      const saved = JSON.parse(JSON.stringify(s));
      saved.waitingPlayers = this.data.editData.waitingPlayers;
      ScheduleStorage.save(saved);
      this._syncDisplay(saved);
      this.setData({
        editMode: false,
        currentSchedule: saved,
        editData: { waitingPlayers: [], selected: null, selKey: null }
      });
      wx.showToast({ title: '已保存调整', icon: 'success' });
    } else {
      this.setData({
        editMode: true,
        'editData.waitingPlayers': s.waitingPlayers || []
      });
    }
  },

  tapCard(e) {
    const d = e.currentTarget.dataset;
    const sel = this.data.editData.selected;
    const cur = { player: d.p, source: 'court', ri: d.ri, ci: d.ci, ti: d.ti, si: d.si };
    if (!sel) {
      this.setData({
        'editData.selected': cur,
        'editData.selKey': 'c_' + d.ri + '_' + d.ci + '_' + d.ti + '_' + d.si
      });
      return;
    }
    if (sel.source === 'court' && sel.ri === d.ri && sel.ci === d.ci && sel.ti === d.ti && sel.si === d.si) {
      this.setData({ 'editData.selected': null, 'editData.selKey': null });
      return;
    }
    this._doSwap(sel, cur);
  },

  tapWaiting(e) {
    const d = e.currentTarget.dataset;
    const sel = this.data.editData.selected;
    const cur = { player: d.p, source: 'waiting', wi: d.wi };
    if (!sel) {
      this.setData({
        'editData.selected': cur,
        'editData.selKey': 'w_' + d.wi
      });
      return;
    }
    if (sel.source === 'waiting' && sel.wi === d.wi) {
      this.setData({ 'editData.selected': null, 'editData.selKey': null });
      return;
    }
    this._doSwap(sel, cur);
  },

  tapSlot(e) {
    const d = e.currentTarget.dataset;
    const sel = this.data.editData.selected;
    if (!sel) return;
    const s = JSON.parse(JSON.stringify(this.data.currentSchedule));
    const wp = [...this.data.editData.waitingPlayers];
    if (sel.source === 'waiting') {
      const player = wp.splice(sel.wi, 1)[0];
      s.schedule[d.ri].matches[d.ci].teams[d.ti][d.si] = player;
    } else {
      s.schedule[d.ri].matches[d.ci].teams[d.ti][d.si] = sel.player;
      s.schedule[sel.ri].matches[sel.ci].teams[sel.ti][sel.si] = null;
    }
    this._syncDisplay(s);
    this.setData({
      currentSchedule: s,
      'editData.selected': null,
      'editData.selKey': null,
      'editData.waitingPlayers': wp
    });
  },

  moveToWaiting() {
    const sel = this.data.editData.selected;
    if (!sel || sel.source !== 'court') return;
    const s = JSON.parse(JSON.stringify(this.data.currentSchedule));
    const wp = [...this.data.editData.waitingPlayers];
    s.schedule[sel.ri].matches[sel.ci].teams[sel.ti][sel.si] = null;
    wp.push(sel.player);
    this._syncDisplay(s);
    this.setData({
      currentSchedule: s,
      'editData.selected': null,
      'editData.selKey': null,
      'editData.waitingPlayers': wp
    });
  },

  _doSwap(a, b) {
    const s = JSON.parse(JSON.stringify(this.data.currentSchedule));
    let wp = [...this.data.editData.waitingPlayers];
    if (a.source === 'court' && b.source === 'court') {
      const old = s.schedule[a.ri].matches[a.ci].teams[a.ti][a.si];
      s.schedule[a.ri].matches[a.ci].teams[a.ti][a.si] = s.schedule[b.ri].matches[b.ci].teams[b.ti][b.si];
      s.schedule[b.ri].matches[b.ci].teams[b.ti][b.si] = old;
    } else if (a.source === 'court' && b.source === 'waiting') {
      const old = s.schedule[a.ri].matches[a.ci].teams[a.ti][a.si];
      s.schedule[a.ri].matches[a.ci].teams[a.ti][a.si] = b.player;
      wp = wp.filter(p => p !== b.player);
      wp.push(old);
    } else if (a.source === 'waiting' && b.source === 'court') {
      const old = s.schedule[b.ri].matches[b.ci].teams[b.ti][b.si];
      s.schedule[b.ri].matches[b.ci].teams[b.ti][b.si] = a.player;
      wp = wp.filter(p => p !== a.player);
      wp.push(old);
    } else {
      const ia = wp.indexOf(a.player);
      const ib = wp.indexOf(b.player);
      if (ia !== -1 && ib !== -1) { [wp[ia], wp[ib]] = [wp[ib], wp[ia]]; }
    }
    this._syncDisplay(s);
    this.setData({
      currentSchedule: s,
      'editData.selected': null,
      'editData.selKey': null,
      'editData.waitingPlayers': wp
    });
  },

  _syncDisplay(s) {
    for (const round of s.schedule) {
      for (const m of round.matches) {
        m.display = m.teams.map(t => t.map(p => p || '___').join('')).join(' vs ');
      }
    }
  }
});
