const { calcCareerStats } = require('../../utils/statistics');

function fmt(m) {
  if (m < 60) return m + '分钟';
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? h + '小时' + r + '分钟' : h + '小时';
}

Page({
  data: {
    stats: null,
    hasData: false
  },

  async onShow() {
    const raw = await calcCareerStats();
    const stats = {
      ...raw,
      totalText: fmt(raw.totalDuration),
      groupStats: raw.groupStats.map(g => ({ ...g, text: fmt(g.duration), pct: (g.duration / raw.totalDuration * 100).toFixed(1) }))
    };
    this.setData({ stats, hasData: stats.totalTrainings > 0 });
  }
});
