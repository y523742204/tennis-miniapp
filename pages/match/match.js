const { ScheduleStorage } = require('../../utils/storage');
const { generateSchedule } = require('../../utils/scheduler');

function defaultNames(maleCount, femaleCount) {
  const names = [];
  for (let i = 1; i <= maleCount; i++) names.push('男' + i);
  for (let i = 1; i <= femaleCount; i++) names.push('女' + i);
  return names;
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
      rounds: 3,
      courts: 2,
      roundTypes: ['normal', 'mixed', 'mixed']
    },
    currentSchedule: null
  },

  onShow() {
    this._loadSchedules();
  },

  _loadSchedules() {
    this.setData({ schedules: ScheduleStorage.getAll() });
  },

  scheduleFormChange(e) {
    const { field } = e.currentTarget.dataset;
    const val = Number(e.detail.value);
    const patch = { ['scheduleForm.' + field]: val };
    if (field === 'maleCount' || field === 'femaleCount') {
      const mc = field === 'maleCount' ? val : this.data.scheduleForm.maleCount;
      const fc = field === 'femaleCount' ? val : this.data.scheduleForm.femaleCount;
      const names = defaultNames(mc, fc);
      patch['scheduleForm.playerNames'] = names;
      patch['scheduleForm.maleNames'] = names.slice(0, mc);
      patch['scheduleForm.femaleNames'] = names.slice(mc);
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
    this.setData({ 'scheduleForm.mode': e.detail.value === 0 ? 'singles' : 'doubles' });
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
    this.setData({ currentSchedule: null });
  }
});
