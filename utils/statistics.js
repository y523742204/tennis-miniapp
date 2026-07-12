const { TrainingStorage } = require('./storage');

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

  const totalTrainings = trainings.length;
  const totalDuration = trainings.reduce((s, r) => s + (r.duration || 0), 0);

  const typeDist = {};
  trainings.forEach(t => {
    typeDist[t.type] = (typeDist[t.type] || 0) + 1;
  });

  const monthlyDuration = {};
  trainings.forEach(t => {
    const key = t.date.slice(0, 7);
    monthlyDuration[key] = (monthlyDuration[key] || 0) + (t.duration || 0);
  });

  const months = getMonthRange();
  const monthlyTrend = months.map(m => {
    const key = `${m.year}-${String(m.month).padStart(2, '0')}`;
    return { ...m, duration: monthlyDuration[key] || 0 };
  });

  return { totalTrainings, totalDuration, typeDist, monthlyTrend };
}

module.exports = { calcCareerStats, getMonthRange };
