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
      mode: 'singles',
      maleCount: 4,
      femaleCount: 0,
      playerNames: defaultNames(4, 0),
      rounds: 3,
      courts: 2
    },
    currentSchedule: null
  },

  onShow() {
    this._loadSchedules();
  },

  // ─── 排赛 ───────────────────────

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
      patch['scheduleForm.playerNames'] = defaultNames(mc, fc);
    }
    this.setData(patch);
  },

  scheduleModeChange(e) {
    this.setData({ 'scheduleForm.mode': e.detail.value === 0 ? 'singles' : 'doubles' });
  },

  playerNameInput(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const names = [...this.data.scheduleForm.playerNames];
    names[idx] = e.detail.value;
    this.setData({ 'scheduleForm.playerNames': names });
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
    const result = generateSchedule(f.mode, names, f.rounds, f.courts);
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
