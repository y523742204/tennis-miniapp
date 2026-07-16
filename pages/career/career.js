const { calcCareerStats, calcMonthlyStats } = require('../../utils/statistics');

function fmt(m) {
  if (m < 60) return m + '分钟';
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? h + '小时' + r + '分钟' : h + '小时';
}

Page({
  data: {
    stats: null,
    hasData: false,
    monthStats: null,
    monthLabel: '',
    calendarRange: [],
    calendarIndex: [0, 0],
    cloudOpenid: ''
  },

  async onShow() {
    let cloudOpenid = '';
    try {
      const res = await wx.cloud.callFunction({ name: 'getOpenid' });
      if (res.result && res.result.openid) cloudOpenid = res.result.openid;
    } catch (e) {}
    this.setData({ myOpenid: cloudOpenid, cloudOpenid });

    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;

    const years = [];
    for (let y = 2020; y <= curYear; y++) years.push(y + '年');
    const months = [];
    for (let m = 1; m <= 12; m++) months.push(m + '月');

    const yi = years.length - 1;
    const mi = curMonth - 1;
    const label = curYear + '年' + curMonth + '月';

    const raw = await calcCareerStats();
    const stats = {
      ...raw,
      totalText: fmt(raw.totalDuration),
      groupStats: raw.groupStats.map(g => ({ ...g, text: fmt(g.duration), pct: (g.duration / raw.totalDuration * 100).toFixed(1) }))
    };

    this.setData({ stats, calendarRange: [years, months], calendarIndex: [yi, mi], hasData: stats.totalTrainings > 0 });
    await this._loadMonthStats(curYear, curMonth, label);
  },

  async _loadMonthStats(year, month, label) {
    const mRaw = await calcMonthlyStats(year, month);
    const monthStats = {
      ...mRaw,
      totalText: fmt(mRaw.totalDuration),
      groupStats: mRaw.groupStats.map(g => ({ ...g, text: fmt(g.duration), pct: mRaw.totalDuration > 0 ? (g.duration / mRaw.totalDuration * 100).toFixed(1) : '0' }))
    };
    this.setData({ monthStats, monthLabel: label });
  },

  onCalendarChange(e) {
    const idx = e.detail.value;
    const yearText = this.data.calendarRange[0][idx[0]];
    const monthText = this.data.calendarRange[1][idx[1]];
    const year = parseInt(yearText);
    const month = parseInt(monthText);
    if (year && month) {
      this.setData({ calendarIndex: idx });
      this._loadMonthStats(year, month, year + '年' + month + '月');
    }
  }
});
