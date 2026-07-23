const app = getApp();

Page({
  data: {
    summary: { players: 0, rounds: 0, matches: 0 },
    playerStats: [],
    selected: null
  },

  onLoad() {
    const s = app.globalData.networkSchedule;
    if (!s || !s.schedule || s.schedule.length === 0) {
      wx.showToast({ title: '无排赛数据', icon: 'none' });
      return;
    }
    this._buildStats(s);
  },

  _buildStats(s) {
    const players = (s.playerNames || []).slice();
    const nodeMap = {};
    for (const p of players) {
      nodeMap[p] = { name: p, partnerSet: {}, opponentSet: {} };
    }
    let matchCount = 0;
    const roundsAppeared = {};
    for (let ri = 0; ri < (s.schedule || []).length; ri++) {
      const round = s.schedule[ri];
      for (const m of (round.matches || [])) {
        const t0 = (m.teams && m.teams[0]) || [];
        const t1 = (m.teams && m.teams[1]) || [];
        const v0 = t0.filter(p => p && p !== '___' && p !== null);
        const v1 = t1.filter(p => p && p !== '___' && p !== null);
        if (v0.length === 0 && v1.length === 0) continue;
        matchCount++;
        for (const p of [...v0, ...v1]) {
          if (!roundsAppeared[p]) roundsAppeared[p] = new Set();
          roundsAppeared[p].add(ri);
        }
        for (let a = 0; a < v0.length; a++) {
          for (let b = a + 1; b < v0.length; b++) {
            if (nodeMap[v0[a]] && nodeMap[v0[b]]) {
              nodeMap[v0[a]].partnerSet[v0[b]] = (nodeMap[v0[a]].partnerSet[v0[b]] || 0) + 1;
              nodeMap[v0[b]].partnerSet[v0[a]] = (nodeMap[v0[b]].partnerSet[v0[a]] || 0) + 1;
            }
          }
        }
        for (let a = 0; a < v1.length; a++) {
          for (let b = a + 1; b < v1.length; b++) {
            if (nodeMap[v1[a]] && nodeMap[v1[b]]) {
              nodeMap[v1[a]].partnerSet[v1[b]] = (nodeMap[v1[a]].partnerSet[v1[b]] || 0) + 1;
              nodeMap[v1[b]].partnerSet[v1[a]] = (nodeMap[v1[b]].partnerSet[v1[a]] || 0) + 1;
            }
          }
        }
        for (let a = 0; a < v0.length; a++) {
          for (let b = 0; b < v1.length; b++) {
            if (nodeMap[v0[a]] && nodeMap[v1[b]]) {
              nodeMap[v0[a]].opponentSet[v1[b]] = (nodeMap[v0[a]].opponentSet[v1[b]] || 0) + 1;
              nodeMap[v1[b]].opponentSet[v0[a]] = (nodeMap[v1[b]].opponentSet[v0[a]] || 0) + 1;
            }
          }
        }
      }
    }
    let maleCount = s.maleCount || 0;
    if (maleCount === 0 && players.length > 0) {
      const guessed = players.filter(p => /^男/.test(p)).length;
      if (guessed > 0) maleCount = guessed;
    }
    const maleNames = players.slice(0, maleCount);
    const femaleNames = players.slice(maleCount);

    function chunk(arr, size) {
      const result = [];
      for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
      return result;
    }

    const playerStats = players.map(name => {
      const n = nodeMap[name];
      const rels = players.map(p => ({
        name: p,
        partnerCount: p === name ? 0 : (n.partnerSet[p] || 0),
        opponentCount: p === name ? 0 : (n.opponentSet[p] || 0)
      }));
      const maleRels = chunk(rels.filter(r => maleNames.includes(r.name)), 8);
      const femaleRels = chunk(rels.filter(r => femaleNames.includes(r.name)), 8);
      return {
        name, maleRels, femaleRels,
        totalRounds: roundsAppeared[name] ? roundsAppeared[name].size : 0,
        totalOthers: rels.length,
        partnerCount: rels.filter(r => r.partnerCount > 0).length,
        opponentCount: rels.filter(r => r.opponentCount > 0).length
      };
    });
    this.setData({
      summary: { players: players.length, rounds: (s.schedule || []).length, matches: matchCount },
      playerStats
    });
  },

  togglePlayer(e) {
    const name = e.currentTarget.dataset.name;
    this.setData({ selected: this.data.selected === name ? null : name });
  },

  onShareAppMessage() {
    return { title: '网球训练助手', path: 'pages/network/network' };
  }
});
