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

  onShow() {
    const raw = calcCareerStats();
    const stats = {
      ...raw,
      totalText: fmt(raw.totalDuration),
      groupStats: raw.groupStats.map(g => ({ ...g, text: fmt(g.duration) }))
    };
    this.setData({ stats, hasData: stats.totalTrainings > 0 });
  }
});
