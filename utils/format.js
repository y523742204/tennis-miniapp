function pad(n) {
  return String(n).padStart(2, '0');
}

function formatDate(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDateCN(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${y}年${parseInt(m)}月${parseInt(d)}日`;
}

function formatTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}分钟`;
  if (m === 0) return `${h}小时`;
  return `${h}小时${m}分钟`;
}

function formatScore(sets) {
  if (!sets || sets.length === 0) return '';
  return sets.map(s => `${s.myGames}-${s.oppGames}`).join(', ');
}

function getWeekDay(dateStr) {
  const days = ['日', '一', '二', '三', '四', '五', '六'];
  return '周' + days[new Date(dateStr).getDay()];
}

function getMonthDays(year, month) {
  const days = [];
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  for (let d = 1; d <= last.getDate(); d++) {
    days.push({
      date: `${year}-${pad(month)}-${pad(d)}`,
      day: d,
      weekDay: new Date(year, month - 1, d).getDay()
    });
  }
  return days;
}

function getWeekDates(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay() === 0 ? 6 : d.getDay() - 1;
  const start = new Date(d);
  start.setDate(d.getDate() - day);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(start);
    cur.setDate(start.getDate() + i);
    dates.push(formatDate(cur));
  }
  return dates;
}

function formatHourMin(m) {
  const h = Math.floor(m / 60);
  const mi = m % 60;
  return `${pad(h)}:${pad(mi)}`;
}

const TRAINING_TYPES = [
  { value: 'serve', label: '发球', color: '#3b82f6' },
  { value: 'baseline', label: '底线', color: '#10b981' },
  { value: 'volley', label: '截击', color: '#f59e0b' },
  { value: 'comprehensive', label: '综合', color: '#8b5cf6' },
  { value: 'match_sim', label: '比赛模拟', color: '#ef4444' },
  { value: 'fitness', label: '体能', color: '#ec4899' }
];

function getTrainingType(value) {
  return TRAINING_TYPES.find(t => t.value === value) || { label: value, color: '#6b7280' };
}

const LEVEL_OPTIONS = [];
for (let i = 0; i <= 10; i++) {
  LEVEL_OPTIONS.push(i * 0.5);
}

module.exports = {
  formatDate, formatDateCN, formatTime, formatScore,
  getWeekDay, getMonthDays, getWeekDates, formatHourMin,
  TRAINING_TYPES, getTrainingType, LEVEL_OPTIONS
};
