const { ScheduleStorage } = require('../../utils/storage');
const { generateSchedule } = require('../../utils/scheduler');

function defaultNames(maleCount, femaleCount) {
  const names = [];
  for (let i = 1; i <= maleCount; i++) names.push('男' + i);
  for (let i = 1; i <= femaleCount; i++) names.push('女' + i);
  return names;
}
function defaultCourts(mode, maleCount, femaleCount, firstRoundType) {
  const n = maleCount + femaleCount;
  if (mode === 'singles' || firstRoundType === 'single') return Math.floor(n / 2) || 1;
  return Math.floor(n / 4) || 1;
}
function defaultCourtLabels(courts) {
  return Array.from({ length: courts }, (_, i) => (i + 1) + '号场');
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
      rounds: 5,
      courts: defaultCourts('doubles', 4, 4, 'normal'),
      roundTypes: ['normal', 'mixed', 'mixed', 'mixed', 'mixed'],
      courtLabels: defaultCourtLabels(defaultCourts('doubles', 4, 4, 'normal')),
      fixedPairs: []
    },
    showFixedPairPanel: false,
    fixedPairSel1: null,
    fixedPairSel2: null,
    fixedPairRounds: 1,
    currentSchedule: null,
    editMode: false,
    editData: {
      waitingPlayers: [],
      selected: null,
      selKey: null
    }
  },

  async onShow() {
    await this._loadSchedules();
  },

  async _loadSchedules() {
    this.setData({ schedules: await ScheduleStorage.getAll() });
  },

  scheduleFormChange(e) {
    const { field } = e.currentTarget.dataset;
    const val = Number(e.detail.value) + (field === 'rounds' || field === 'courts' ? 1 : 0);
    const patch = { ['scheduleForm.' + field]: val };
    if (field === 'maleCount' || field === 'femaleCount') {
      const mc = field === 'maleCount' ? val : this.data.scheduleForm.maleCount;
      const fc = field === 'femaleCount' ? val : this.data.scheduleForm.femaleCount;
      const names = defaultNames(mc, fc);
      patch['scheduleForm.playerNames'] = names;
      patch['scheduleForm.maleNames'] = names.slice(0, mc);
      patch['scheduleForm.femaleNames'] = names.slice(mc);
      const c = defaultCourts(this.data.scheduleForm.mode, mc, fc, this.data.scheduleForm.roundTypes[0]);
      patch['scheduleForm.courts'] = c;
      patch['scheduleForm.courtLabels'] = defaultCourtLabels(c);
    }
    if (field === 'courts') {
      const cur = this.data.scheduleForm.courtLabels;
      patch['scheduleForm.courtLabels'] = val > cur.length
        ? [...cur, ...Array(val - cur.length).fill('').map((_, i) => (cur.length + i + 1) + '号场')]
        : cur.slice(0, val);
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
    const mode = e.detail.value === 0 ? 'singles' : 'doubles';
    const { maleCount, femaleCount, roundTypes } = this.data.scheduleForm;
    const c = defaultCourts(mode, maleCount, femaleCount, roundTypes[0]);
    this.setData({
      'scheduleForm.mode': mode,
      'scheduleForm.courts': c,
      'scheduleForm.courtLabels': defaultCourtLabels(c)
    });
  },

  roundTypeChange(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const types = [...this.data.scheduleForm.roundTypes];
    types[idx] = Number(e.detail.value) === 0 ? 'normal' : 'mixed';
    this.setData({ 'scheduleForm.roundTypes': types });
  },

  courtLabelInput(e) {
    const idx = Number(e.currentTarget.dataset.idx);
    const labels = [...this.data.scheduleForm.courtLabels];
    labels[idx] = e.detail.value || (idx + 1) + '号场';
    this.setData({ 'scheduleForm.courtLabels': labels });
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

  addFixedPair() {
    this.setData({
      showFixedPairPanel: true,
      fixedPairSel1: null,
      fixedPairSel2: null,
      fixedPairRounds: 1
    });
  },

  tapFixedPairPlayer(e) {
    const player = e.currentTarget.dataset.player;
    const { fixedPairSel1, fixedPairSel2 } = this.data;
    if (player === fixedPairSel1) {
      this.setData({ fixedPairSel1: null });
    } else if (player === fixedPairSel2) {
      this.setData({ fixedPairSel2: null });
    } else if (!fixedPairSel1) {
      this.setData({ fixedPairSel1: player });
    } else if (!fixedPairSel2) {
      this.setData({ fixedPairSel2: player });
    }
  },

  fixedPairChangeRounds(e) {
    this.setData({ fixedPairRounds: Number(e.detail.value) + 1 });
  },

  confirmFixedPair() {
    const p1 = this.data.fixedPairSel1;
    const p2 = this.data.fixedPairSel2;
    const rounds = this.data.fixedPairRounds;
    if (!p1 || !p2) {
      wx.showToast({ title: '请选择两名选手', icon: 'none' });
      return;
    }
    if (p1 === p2) {
      wx.showToast({ title: '搭档不可为同一人', icon: 'none' });
      return;
    }
    if (rounds > this.data.scheduleForm.rounds) {
      wx.showToast({ title: '轮数不能超过总轮数', icon: 'none' });
      return;
    }
    const used = new Set();
    for (const p of this.data.scheduleForm.fixedPairs) {
      used.add(p.p1); used.add(p.p2);
    }
    if (used.has(p1) || used.has(p2)) {
      wx.showToast({ title: '该选手已有固定搭档', icon: 'none' });
      return;
    }
    const pairs = [...this.data.scheduleForm.fixedPairs];
    pairs.push({ p1, p2, rounds });
    this.setData({
      'scheduleForm.fixedPairs': pairs,
      showFixedPairPanel: false
    });
  },

  cancelFixedPair() {
    this.setData({ showFixedPairPanel: false });
  },

  removeFixedPair(e) {
    const idx = e.currentTarget.dataset.idx;
    const pairs = [...this.data.scheduleForm.fixedPairs];
    pairs.splice(idx, 1);
    this.setData({ 'scheduleForm.fixedPairs': pairs });
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
    const result = generateSchedule(f.mode, players, f.rounds, f.courts, f.roundTypes, f.fixedPairs);
    result.courtLabels = [...f.courtLabels];
    this.setData({ currentSchedule: result });
  },

  async saveSchedule() {
    const s = this.data.currentSchedule;
    if (!s) return;
    await ScheduleStorage.save(s);
    this.setData({ currentSchedule: null });
    wx.showToast({ title: '已保存排赛', icon: 'success' });
    await this._loadSchedules();
  },

  exportScheduleImage() {
    const s = this.data.currentSchedule;
    if (!s) { wx.showToast({ title: '暂无排赛数据', icon: 'none' }); return; }
    const rowH = 44, headH = 38, pad = 16, badgeR = 11;
    const courtLabels = s.courtLabels || Array.from({ length: s.courts }, (_, i) => '场地' + (i + 1));
    const nc = s.courts || 1;
    const mCol = Math.floor((640 - pad * 2) / nc);
    const cw = pad * 2 + mCol * nc;
    // Build table data
    const rows = [];
    let hasBye = false;
    for (const rd of s.schedule) {
      const cells = new Array(nc).fill('');
      for (const m of rd.matches) {
        const ci = m.court - 1;
        if (ci >= 0 && ci < nc) cells[ci] = m.display || (m.teams || []).map(t => t.join('')).join(' vs ');
      }
      rows.push({ round: rd.round, cells, byes: rd.byes || [] });
      if (rd.byes && rd.byes.length) hasBye = true;
    }
    // Heights
    const fpLine = s.fixedPairs && s.fixedPairs.length ? 30 : 0;
    const byeH = hasBye ? 20 * rows.reduce((s2, r) => s2 + (r.byes.length ? 1 : 0), 0) + 8 : 0;
    const tblBodyH = rows.length * rowH;
    const totalH = pad + fpLine + 4 + headH + tblBodyH + 4 + byeH + pad;
    wx.showLoading({ title: '生成中...' });
    const query = wx.createSelectorQuery();
    query.select('#scheduleCanvas').node((res) => {
      const canvas = res.node;
      const ctx = canvas.getContext('2d');
      const dpr = wx.getSystemInfoSync().pixelRatio;
      canvas.width = cw * dpr;
      canvas.height = totalH * dpr;
      ctx.scale(dpr, dpr);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cw, totalH);
      let y = pad;
      // Fixed pairs
      if (s.fixedPairs && s.fixedPairs.length) {
        const fp = s.fixedPairs.map(p => `${p.p1}+${p.p2}(${p.rounds}轮)`).join('；');
        ctx.font = '14px sans-serif';
        ctx.fillStyle = '#999';
        ctx.textBaseline = 'top';
        ctx.fillText(fp, pad, y);
        y += fpLine;
      }
      y += 4;
      // Table header
      const headY = y;
      ctx.fillStyle = '#07c160';
      ctx.fillRect(0, headY, cw, headH);
      ctx.font = 'bold 15px sans-serif';
      ctx.fillStyle = '#fff';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      for (let ci = 0; ci < nc; ci++) {
        ctx.fillText(courtLabels[ci], pad + ci * mCol + mCol / 2, headY + headH / 2);
      }
      ctx.textBaseline = 'top';
      y += headH;
      // Table body
      for (let ri = 0; ri < rows.length; ri++) {
        const r = rows[ri];
        const rowY = y;
        ctx.fillStyle = ri % 2 === 0 ? '#f8fdf8' : '#ffffff';
        ctx.fillRect(0, rowY, cw, rowH);
        ctx.strokeStyle = '#e8e8e8';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, rowY + rowH);
        ctx.lineTo(cw, rowY + rowH);
        ctx.stroke();
        // Round badge
        ctx.fillStyle = '#07c160';
        ctx.beginPath();
        ctx.arc(badgeR + 4, rowY + rowH / 2, badgeR, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText(String(r.round), badgeR + 4, rowY + rowH / 2);
        // Match cells
        ctx.font = '13px sans-serif';
        ctx.fillStyle = '#555';
        ctx.textBaseline = 'middle';
        for (let ci = 0; ci < nc; ci++) {
          const cx = pad + ci * mCol;
          if (r.cells[ci]) {
            ctx.textAlign = 'center';
            ctx.fillText(r.cells[ci], cx + mCol / 2, rowY + rowH / 2);
          }
        }
        ctx.textBaseline = 'top';
        y += rowH;
      }
      // Vertical lines
      ctx.strokeStyle = '#e8e8e8';
      ctx.lineWidth = 1;
      const vt = headY, vb = y;
      for (let ci = 0; ci <= nc; ci++) {
        const vx = ci * mCol;
        ctx.beginPath(); ctx.moveTo(vx, vt); ctx.lineTo(vx, vb); ctx.stroke();
      }
      // Byes
      ctx.textBaseline = 'top';
      y += 4;
      for (const r of rows) {
        if (r.byes.length) {
          ctx.font = '13px sans-serif';
          ctx.fillStyle = '#999';
          ctx.fillText(`第${r.round}轮 轮空：${r.byes.join('、')}`, pad, y);
          y += 20;
        }
      }
      wx.hideLoading();
      wx.canvasToTempFilePath({ canvas, success: (res2) => {
        wx.previewImage({ urls: [res2.tempFilePath] });
      }, fail: () => { wx.showToast({ title: '导出失败', icon: 'none' }); } });
    }).exec();
  },

  exportExcel() {
    const s = this.data.currentSchedule;
    if (!s) { wx.showToast({ title: '暂无排赛数据', icon: 'none' }); return; }
    const courtLabels = s.courtLabels || Array.from({ length: s.courts }, (_, i) => '场地' + (i + 1));
    const nc = s.courts || 1;
    const modeLabel = s.mode === 'doubles' ? '双打' : '单打';
    let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"><style>th,td{font-size:12pt;padding:6px 12px;border:1px solid #ccc;text-align:center}th{background:#07c160;color:#fff;font-weight:bold}</style></head><body>`;
    // Title row (merged)
    html += `<table><tr><td colspan="${nc + 2}" style="font-size:14pt;font-weight:bold;border:none;text-align:center">排赛对阵表（${modeLabel}·${s.playerNames.length}人·${s.rounds}轮·${s.courts}场地）</td></tr>`;
    // Header
    html += '<tr><th>轮次</th>';
    for (const cl of courtLabels) html += `<th>${cl}</th>`;
    html += '<th>轮空</th></tr>';
    // Rows
    for (const rd of s.schedule) {
      const typeLabel = s.roundTypes && s.roundTypes[rd.round - 1] === 'normal' ? '男双/女双' : '混双';
      const cells = new Array(nc).fill('');
      for (const m of rd.matches) {
        const ci = m.court - 1;
        if (ci >= 0 && ci < nc) cells[ci] = m.display || (m.teams || []).map(t => t.join('')).join(' vs ');
      }
      html += `<tr><td style="font-weight:bold">第${rd.round}轮（${typeLabel}）</td>`;
      for (let ci = 0; ci < nc; ci++) html += `<td>${cells[ci] || ''}</td>`;
      html += `<td>${(rd.byes || []).join('、')}</td></tr>`;
    }
    // Fixed pairs
    if (s.fixedPairs && s.fixedPairs.length) {
      const fp = s.fixedPairs.map(p => `${p.p1}+${p.p2}(${p.rounds}轮)`).join('；');
      html += `<tr><td colspan="${nc + 2}" style="font-size:11pt;color:#666;border:none;text-align:left">固定搭档：${fp}</td></tr>`;
    }
    html += '</table></body></html>';
    // Write and open
    const fs = wx.getFileSystemManager();
    const filePath = `${wx.env.USER_DATA_PATH}/schedule_${Date.now()}.xls`;
    fs.writeFile({ filePath, data: html, encoding: 'utf8', success() {
      wx.openDocument({ filePath, fileType: 'xls', success() {
        wx.showToast({ title: '导出成功', icon: 'success' });
      }, fail() { wx.showToast({ title: '打开失败', icon: 'none' }); } });
    }, fail() { wx.showToast({ title: '导出失败', icon: 'none' }); } });
  },

  async viewSchedule(e) {
    const s = await ScheduleStorage.get(e.currentTarget.dataset.id);
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
      success: async (res) => {
        if (res.confirm) { await ScheduleStorage.remove(id); await this._loadSchedules(); }
      }
    });
  },

  goBackToList() {
    this.setData({ currentSchedule: null, editMode: false, editData: { waitingPlayers: [], selected: null, selKey: null } });
  },

  async toggleEdit() {
    const s = this.data.currentSchedule;
    if (this.data.editMode) {
      const saved = JSON.parse(JSON.stringify(s));
      saved.waitingPlayers = this.data.editData.waitingPlayers;
      await ScheduleStorage.save(saved);
      this._syncDisplay(saved);
      this.setData({
        editMode: false,
        currentSchedule: saved,
        editData: { waitingPlayers: [], selected: null, selKey: null }
      });
      wx.showToast({ title: '已保存调整', icon: 'success' });
    } else {
      this.setData({
        editMode: true,
        'editData.waitingPlayers': s.waitingPlayers || []
      });
    }
  },

  tapCard(e) {
    const d = e.currentTarget.dataset;
    const sel = this.data.editData.selected;
    const cur = { player: d.p, source: 'court', ri: d.ri, ci: d.ci, ti: d.ti, si: d.si };
    if (!sel) {
      this.setData({
        'editData.selected': cur,
        'editData.selKey': 'c_' + d.ri + '_' + d.ci + '_' + d.ti + '_' + d.si
      });
      return;
    }
    if (sel.source === 'court' && sel.ri === d.ri && sel.ci === d.ci && sel.ti === d.ti && sel.si === d.si) {
      this.setData({ 'editData.selected': null, 'editData.selKey': null });
      return;
    }
    this._doSwap(sel, cur);
  },

  tapWaiting(e) {
    const d = e.currentTarget.dataset;
    const sel = this.data.editData.selected;
    const cur = { player: d.p, source: 'waiting', wi: d.wi };
    if (!sel) {
      this.setData({
        'editData.selected': cur,
        'editData.selKey': 'w_' + d.wi
      });
      return;
    }
    if (sel.source === 'waiting' && sel.wi === d.wi) {
      this.setData({ 'editData.selected': null, 'editData.selKey': null });
      return;
    }
    this._doSwap(sel, cur);
  },

  tapSlot(e) {
    const d = e.currentTarget.dataset;
    const sel = this.data.editData.selected;
    if (!sel) return;
    const s = JSON.parse(JSON.stringify(this.data.currentSchedule));
    const wp = [...this.data.editData.waitingPlayers];
    if (sel.source === 'waiting') {
      const player = wp.splice(sel.wi, 1)[0];
      s.schedule[d.ri].matches[d.ci].teams[d.ti][d.si] = player;
    } else {
      s.schedule[d.ri].matches[d.ci].teams[d.ti][d.si] = sel.player;
      s.schedule[sel.ri].matches[sel.ci].teams[sel.ti][sel.si] = null;
    }
    this._syncDisplay(s);
    this.setData({
      currentSchedule: s,
      'editData.selected': null,
      'editData.selKey': null,
      'editData.waitingPlayers': wp
    });
  },

  moveToWaiting() {
    const sel = this.data.editData.selected;
    if (!sel || sel.source !== 'court') return;
    const s = JSON.parse(JSON.stringify(this.data.currentSchedule));
    const wp = [...this.data.editData.waitingPlayers];
    s.schedule[sel.ri].matches[sel.ci].teams[sel.ti][sel.si] = null;
    wp.push(sel.player);
    this._syncDisplay(s);
    this.setData({
      currentSchedule: s,
      'editData.selected': null,
      'editData.selKey': null,
      'editData.waitingPlayers': wp
    });
  },

  _doSwap(a, b) {
    const s = JSON.parse(JSON.stringify(this.data.currentSchedule));
    let wp = [...this.data.editData.waitingPlayers];
    if (a.source === 'court' && b.source === 'court') {
      const old = s.schedule[a.ri].matches[a.ci].teams[a.ti][a.si];
      s.schedule[a.ri].matches[a.ci].teams[a.ti][a.si] = s.schedule[b.ri].matches[b.ci].teams[b.ti][b.si];
      s.schedule[b.ri].matches[b.ci].teams[b.ti][b.si] = old;
    } else if (a.source === 'court' && b.source === 'waiting') {
      const old = s.schedule[a.ri].matches[a.ci].teams[a.ti][a.si];
      s.schedule[a.ri].matches[a.ci].teams[a.ti][a.si] = b.player;
      wp = wp.filter(p => p !== b.player);
      wp.push(old);
    } else if (a.source === 'waiting' && b.source === 'court') {
      const old = s.schedule[b.ri].matches[b.ci].teams[b.ti][b.si];
      s.schedule[b.ri].matches[b.ci].teams[b.ti][b.si] = a.player;
      wp = wp.filter(p => p !== a.player);
      wp.push(old);
    } else {
      const ia = wp.indexOf(a.player);
      const ib = wp.indexOf(b.player);
      if (ia !== -1 && ib !== -1) { [wp[ia], wp[ib]] = [wp[ib], wp[ia]]; }
    }
    this._syncDisplay(s);
    this.setData({
      currentSchedule: s,
      'editData.selected': null,
      'editData.selKey': null,
      'editData.waitingPlayers': wp
    });
  },

  renameCard(e) {
    const d = e.currentTarget.dataset;
    wx.showModal({
      title: '修改选手名称',
      editable: true,
      content: d.p,
      placeholderText: '输入新名称',
      success: (res) => {
        if (res.confirm && res.content && res.content.trim() !== d.p) {
          this._renamePlayer(d.p, res.content.trim());
        }
      }
    });
  },

  renameWaiting(e) {
    const d = e.currentTarget.dataset;
    wx.showModal({
      title: '修改选手名称',
      editable: true,
      content: d.p,
      placeholderText: '输入新名称',
      success: (res) => {
        if (res.confirm && res.content && res.content.trim() !== d.p) {
          this._renamePlayer(d.p, res.content.trim());
        }
      }
    });
  },

  _renamePlayer(oldName, newName) {
    const s = JSON.parse(JSON.stringify(this.data.currentSchedule));
    let wp = [...this.data.editData.waitingPlayers];
    for (const round of s.schedule) {
      for (const m of round.matches) {
        for (const team of m.teams) {
          for (let i = 0; i < team.length; i++) {
            if (team[i] === oldName) team[i] = newName;
          }
        }
      }
    }
    if (s.playerNames) s.playerNames = s.playerNames.map(n => n === oldName ? newName : n);
    wp = wp.map(n => n === oldName ? newName : n);
    let selKey = this.data.editData.selKey;
    const sel = this.data.editData.selected;
    if (sel && sel.player === oldName) {
      sel.player = newName;
      if (sel.source === 'court') selKey = 'c_' + sel.ri + '_' + sel.ci + '_' + sel.ti + '_' + sel.si;
    }
    this._syncDisplay(s);
    this.setData({
      currentSchedule: s,
      'editData.waitingPlayers': wp,
      'editData.selected': sel,
      'editData.selKey': selKey
    });
  },

  _syncDisplay(s) {
    for (const round of s.schedule) {
      for (const m of round.matches) {
        m.display = m.teams.map(t => t.map(p => p || '___').join('')).join(' vs ');
      }
    }
  }
});
