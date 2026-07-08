const { TrainingStorage, MatchStorage } = require('./storage');

function getMonthRange() {
  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: `${d.getFullYear()}年${d.getMonth() + 1}月`
    });
  }
  return months;
}

function calcCareerStats() {
  const trainings = TrainingStorage.getAll();
  const matches = MatchStorage.getAll();

  const totalTrainings = trainings.length;
  const totalDuration = trainings.reduce((s, r) => s + (r.duration || 0), 0);
  const totalMatches = matches.length;
  const wins = matches.filter(m => m.win).length;
  const winRate = totalMatches > 0 ? (wins / totalMatches * 100).toFixed(1) : 0;

  // 训练类型分布
  const typeDist = {};
  trainings.forEach(t => {
    typeDist[t.type] = (typeDist[t.type] || 0) + 1;
  });

  // 月度训练时长
  const monthlyDuration = {};
  trainings.forEach(t => {
    const key = t.date.slice(0, 7);
    monthlyDuration[key] = (monthlyDuration[key] || 0) + (t.duration || 0);
  });

  // 月度比赛次数
  const monthlyMatches = {};
  matches.forEach(m => {
    const key = m.date.slice(0, 7);
    monthlyMatches[key] = (monthlyMatches[key] || 0) + 1;
  });

  const months = getMonthRange();
  const monthlyTrend = months.map(m => {
    const key = `${m.year}-${String(m.month).padStart(2, '0')}`;
    return {
      ...m,
      duration: monthlyDuration[key] || 0,
      matches: monthlyMatches[key] || 0
    };
  });

  return {
    totalTrainings,
    totalDuration,
    totalMatches,
    wins,
    losses: totalMatches - wins,
    winRate,
    typeDist,
    monthlyTrend,
    recentMatches: matches.slice(0, 5)
  };
}

module.exports = { calcCareerStats, getMonthRange };
