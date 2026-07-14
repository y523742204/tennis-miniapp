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
    monthLabel: ''
  },

  async onShow() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthLabel = year + '年' + month + '月';

    const raw = await calcCareerStats();
    const stats = {
      ...raw,
      totalText: fmt(raw.totalDuration),
      groupStats: raw.groupStats.map(g => ({ ...g, text: fmt(g.duration), pct: (g.duration / raw.totalDuration * 100).toFixed(1) }))
    };

    const mRaw = await calcMonthlyStats(year, month);
    const monthStats = {
      ...mRaw,
      totalText: fmt(mRaw.totalDuration),
      groupStats: mRaw.groupStats.map(g => ({ ...g, text: fmt(g.duration), pct: mRaw.totalDuration > 0 ? (g.duration / mRaw.totalDuration * 100).toFixed(1) : '0' }))
    };

    this.setData({ stats, monthStats, monthLabel, hasData: stats.totalTrainings > 0 });
  }
});
