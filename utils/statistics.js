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

const TYPE_GROUPS = {
  rally: '拉球',
  serve: '发球',
  singles: '单打',
  doubles: '双打',
  lesson: '上课',
  practice: '陪练'
};

async function calcCareerStats(openid) {
  const trainings = await TrainingStorage.getAll(openid);

  const totalTrainings = trainings.length;
  const totalDuration = trainings.reduce((s, r) => s + (r.duration || 0), 0);

  const byGroup = {};
  trainings.forEach(t => {
    const group = TYPE_GROUPS[t.type] || '其他';
    if (!byGroup[group]) byGroup[group] = { count: 0, duration: 0 };
    byGroup[group].count += 1;
    byGroup[group].duration += (t.duration || 0);
  });

  const groupStats = Object.entries(byGroup).map(([key, v]) => ({
    label: key,
    count: v.count,
    duration: v.duration
  }));
  groupStats.sort((a, b) => b.duration - a.duration);

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

  return { totalTrainings, totalDuration, groupStats, typeDist, monthlyTrend };
}

async function calcMonthlyStats(year, month, openid) {
  const key = `${year}-${String(month).padStart(2, '0')}`;
  const all = await TrainingStorage.getAll(openid);
  const trainings = all.filter(t => t.date && t.date.slice(0, 7) === key);

  const totalTrainings = trainings.length;
  const totalDuration = trainings.reduce((s, r) => s + (r.duration || 0), 0);

  const byGroup = {};
  trainings.forEach(t => {
    const group = TYPE_GROUPS[t.type] || '其他';
    if (!byGroup[group]) byGroup[group] = { count: 0, duration: 0 };
    byGroup[group].count += 1;
    byGroup[group].duration += (t.duration || 0);
  });

  const groupStats = Object.entries(byGroup).map(([key, v]) => ({
    label: key,
    count: v.count,
    duration: v.duration
  }));
  groupStats.sort((a, b) => b.duration - a.duration);

  return { totalTrainings, totalDuration, groupStats };
}

module.exports = { calcCareerStats, getMonthRange, calcMonthlyStats };
