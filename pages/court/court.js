const { CourtStorage, migrateLocalToCloud } = require('../../utils/storage');
const { searchNearbyPOI, geocodeAddress, searchByKeyword, AMAP_KEY } = require('../../utils/map');
const { getLiveWeather } = require('../../utils/weather');

var _mid = 1000;
var _midMap = {};

Page({
  data: {
    courts: [],
    markers: [],
    mode: 'map',
    showForm: false,
    formMode: 'add',
    formData: {},
    searchRadius: 2000,
    radiusIndex: 2,
    searching: false,
    nearbyCourts: [],
    mapLongitude: 116.4,
    mapLatitude: 39.9,
    hasKey: !!AMAP_KEY,
    showMigrate: false,
    searchKeyword: '',
    searchSuggestions: [],
    showSuggestions: false,
    myOpenid: '',
    weather: null
  },

  async onShow() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getOpenid' });
      if (res.result && res.result.openid) this.setData({ myOpenid: res.result.openid });
    } catch (e) {}
    const courts = await this._loadCourts();
    if (courts.length === 0) {
      await CourtStorage.save({
        name: '酷胜网球中心',
        address: '成都市双流区双华路三段898号',
        rating: 3
      });
      await this._loadCourts();
    }
    try {
      const local = wx.getStorageSync('tennis_court') || [];
      this.setData({ showMigrate: local.some(r => !r._id) });
    } catch (e) {}
    if (!this._autoSearched) {
      this._autoSearched = true;
      this._autoSearchNearby();
    }
    this._loadWeather(this.data.mapLatitude, this.data.mapLongitude);
  },

  async _autoSearchNearby() {
    try {
      const loc = await new Promise((resolve, reject) => {
        wx.getSetting({
          success: (r) => {
            if (r.authSetting['scope.userLocation']) {
              wx.getLocation({ type: 'gcj02', success: resolve, fail: reject });
            } else {
              wx.authorize({
                scope: 'scope.userLocation',
                success: () => { wx.getLocation({ type: 'gcj02', success: resolve, fail: reject }); },
                fail: () => reject()
              });
            }
          },
          fail: () => reject()
        });
      });
      if (!loc) return;
      this.setData({ mapLatitude: loc.latitude, mapLongitude: loc.longitude });
      this._loadWeather(loc.latitude, loc.longitude);
      const pois = await searchNearbyPOI(loc.latitude, loc.longitude, this.data.searchRadius, '网球场');
      if (pois.length === 0) return;
      var nx = pois.map(function(p) {
        var mid = this._nextMid();
        _midMap[mid] = { type: 'poi', id: p.id };
        return {
          id: mid,
          latitude: p.latitude, longitude: p.longitude, title: p.name,
          iconPath: '/images/marker.png', width: 24, height: 24,
          callout: { content: p.name, color: '#fff', fontSize: 12, bgColor: '#4a90d9', borderRadius: 8, borderColor: '#357abd', borderWidth: 1, padding: 6, display: 'ALWAYS', textAlign: 'center' }
        };
      }.bind(this));
      var saved = (await CourtStorage.getAll(this.data.myOpenid)).filter(function(c) { return c.latitude; }).map(function(c) {
        var mid = this._nextMid();
        _midMap[mid] = { type: 'court', id: c.id };
        return {
          id: mid,
          latitude: c.latitude, longitude: c.longitude, title: c.name,
          iconPath: '/images/marker.png', width: 24, height: 24,
          callout: { content: c.name, color: '#fff', fontSize: 12, bgColor: '#07c160', borderRadius: 8, borderColor: '#05a14f', borderWidth: 1, padding: 6, display: 'ALWAYS', textAlign: 'center' }
        };
      }.bind(this));
      this.setData({ markers: [...saved, ...nx], nearbyCourts: pois });
    } catch (e) {}
  },

  async _loadWeather(lat, lng) {
    try {
      const w = await getLiveWeather(lat, lng);
      if (w && w.temperature) {
        this.setData({ weather: w });
        return;
      }
    } catch (e) { console.warn('天气加载失败', e); }
    this.setData({ weather: { city: '成都', temperature: '23', humidity: '65', weather: '多云' } });
  },

  async _loadCourts() {
    let courts = await CourtStorage.getAll(this.data.myOpenid);
    const seen = {};
    const toRemove = [];
    for (const c of courts) {
      if (seen[c.name]) {
        toRemove.push(c.id);
      } else {
        seen[c.name] = true;
      }
    }
    for (const id of toRemove) {
      await CourtStorage.remove(id);
    }
    if (toRemove.length > 0) courts = await CourtStorage.getAll(this.data.myOpenid);
    const markers = courts.filter(function(c) { return c.latitude; }).map(function(c) {
      var mid = this._nextMid();
      _midMap[mid] = { type: 'court', id: c.id };
      return {
        id: mid,
        latitude: c.latitude, longitude: c.longitude, title: c.name,
        iconPath: '/images/marker.png', width: 24, height: 24,
        callout: { content: c.name, color: '#fff', fontSize: 12, bgColor: '#07c160', borderRadius: 8, borderColor: '#05a14f', borderWidth: 1, padding: 6, display: 'ALWAYS', textAlign: 'center' }
      };
    }.bind(this));
    this.setData({ courts, markers });
    return courts;
  },

  switchMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ mode });
    if (mode === 'map') {
      this._loadMap();
    }
  },

  _loadMap() {
    wx.authorize({
      scope: 'scope.userLocation',
      success: () => {
        wx.getLocation({
          type: 'gcj02',
          success: (res) => {
            this.setData({
              mapLatitude: res.latitude,
              mapLongitude: res.longitude
            });
          },
          fail: () => {
            wx.showToast({ title: '获取位置失败，使用默认位置', icon: 'none' });
          }
        });
      },
      fail: () => {
        wx.showToast({ title: '需授权位置信息才能使用地图', icon: 'none' });
      }
    });
  },

  radiusChange(e) {
    const idx = Number(e.detail.value);
    const radii = [1000, 2000, 5000, 10000];
    this.setData({ radiusIndex: idx, searchRadius: radii[idx] });
  },

  _searchTimer: null,

  onSearchInput(e) {
    var keyword = e.detail.value;
    this.setData({ searchKeyword: keyword });
    if (!keyword || keyword.length < 2) {
      this.setData({ showSuggestions: false, searchSuggestions: [] });
      return;
    }
    var loc = this.data.mapLongitude + ',' + this.data.mapLatitude;
    if (this._searchTimer) clearTimeout(this._searchTimer);
    this._searchTimer = setTimeout(() => {
      this._searchTimer = null;
      searchByKeyword(keyword, loc).then((pois) => {
        this.setData({ searchSuggestions: pois.slice(0, 8), showSuggestions: pois.length > 0 });
        if (pois.length > 0) {
          this._updateMarkersFromPOIs(pois);
        }
      }).catch(() => {
        this.setData({ showSuggestions: false });
      });
    }, 300);
  },

  onSearchConfirm(e) {
    var keyword = e.detail.value || this.data.searchKeyword;
    if (!keyword) return;
    this.setData({ searchKeyword: keyword, showSuggestions: false });
    this._searchByKeyword(keyword);
  },

  onClearSearch() {
    this.setData({ searchKeyword: '', searchSuggestions: [], showSuggestions: false });
  },

  selectSuggestion(e) {
    var tip = e.currentTarget.dataset.tip;
    this.setData({ searchKeyword: tip.name, showSuggestions: false });
    if (tip.latitude && tip.longitude) {
      this.setData({ mapLatitude: tip.latitude, mapLongitude: tip.longitude });
    }
    this._searchByKeyword(tip.name);
  },

  _ensureLocation() {
    return new Promise((resolve, reject) => {
      wx.getSetting({
        success: (res) => {
          if (res.authSetting['scope.userLocation']) {
            wx.getLocation({
              type: 'gcj02',
              success: (loc) => {
                this.setData({ mapLatitude: loc.latitude, mapLongitude: loc.longitude });
                resolve();
              },
              fail: reject
            });
          } else {
            wx.authorize({
              scope: 'scope.userLocation',
              success: () => {
                wx.getLocation({
                  type: 'gcj02',
                  success: (loc) => {
                    this.setData({ mapLatitude: loc.latitude, mapLongitude: loc.longitude });
                    resolve();
                  },
                  fail: reject
                });
              },
              fail: () => {
                wx.showModal({
                  title: '需要位置权限',
                  content: '请授权位置信息以搜索附近球场',
                  success: (m) => {
                    if (m.confirm) {
                      wx.openSetting();
                    }
                    reject(new Error('位置权限未授权'));
                  }
                });
              }
            });
          }
        },
        fail: reject
      });
    });
  },

  _updateMarkersFromPOIs(pois) {
    var nx = pois.map(function(p) {
      var mid = this._nextMid();
      _midMap[mid] = { type: 'poi', id: p.id };
      return {
        id: mid,
        latitude: p.latitude, longitude: p.longitude, title: p.name,
        iconPath: '/images/marker.png', width: 24, height: 24,
        callout: { content: p.name, color: '#fff', fontSize: 12, bgColor: '#4a90d9', borderRadius: 8, borderColor: '#357abd', borderWidth: 1, padding: 6, display: 'ALWAYS', textAlign: 'center' }
      };
    }.bind(this));
    var mlat = pois[0] ? pois[0].latitude : this.data.mapLatitude;
    var mlng = pois[0] ? pois[0].longitude : this.data.mapLongitude;
    this.setData({ markers: nx, nearbyCourts: pois, searching: false, mapLatitude: mlat, mapLongitude: mlng });
    if (pois.length === 0) {
      wx.showToast({ title: '未找到相关球场', icon: 'none' });
    } else {
      wx.showToast({ title: '找到 ' + pois.length + ' 个结果', icon: 'success' });
    }
  },

  _searchByKeyword(keyword) {
    this.setData({ searching: true });
    this._ensureLocation().then(() => {
      var loc = this.data.mapLongitude + ',' + this.data.mapLatitude;
      searchByKeyword(keyword, loc)
      .then((pois) => {
        this._updateMarkersFromPOIs(pois);
      })
      .catch(function(err) {
        wx.showToast({ title: '搜索失败: ' + err.message, icon: 'none' });
        this.setData({ searching: false });
      }.bind(this));
    }).catch(function(err) {
      this.setData({ searching: false });
    }.bind(this));
  },

  searchNearby() {
    if (!this.data.hasKey) {
      wx.showModal({
        title: '需要配置API Key',
        content: '请前往 utils/map.js 填入您的高德地图 Web API Key（免费申请）',
        showCancel: false
      });
      return;
    }
    this.setData({ searching: true });
    this._ensureLocation().then(() => {
      searchNearbyPOI(this.data.mapLatitude, this.data.mapLongitude, this.data.searchRadius, '网球场')
              .then(async (pois) => {
                var that = this;
                var nx = pois.map(function(p) {
                  var mid = that._nextMid();
                  _midMap[mid] = { type: 'poi', id: p.id };
                  return {
                    id: mid,
                    latitude: p.latitude, longitude: p.longitude, title: p.name,
                    iconPath: '/images/marker.png', width: 24, height: 24,
                    callout: { content: p.name, color: '#fff', fontSize: 12, bgColor: '#4a90d9', borderRadius: 8, borderColor: '#357abd', borderWidth: 1, padding: 6, display: 'ALWAYS', textAlign: 'center' }
                  };
                });
                var saved = (await CourtStorage.getAll(that.data.myOpenid)).filter(function(c) { return c.latitude; }).map(function(c) {
                  var mid = that._nextMid();
                  _midMap[mid] = { type: 'court', id: c.id };
                  return {
                    id: mid,
                    latitude: c.latitude, longitude: c.longitude, title: c.name,
                    iconPath: '/images/marker.png', width: 24, height: 24,
                    callout: { content: c.name, color: '#fff', fontSize: 12, bgColor: '#07c160', borderRadius: 8, borderColor: '#05a14f', borderWidth: 1, padding: 6, display: 'ALWAYS', textAlign: 'center' }
                  };
                });
                this.setData({
                  markers: [...saved, ...nx],
                  nearbyCourts: pois,
                  searching: false
                });
                if (pois.length === 0) {
                  wx.showToast({ title: '未找到附近网球场', icon: 'none' });
                } else {
                  wx.showToast({ title: '找到 ' + pois.length + ' 个网球场', icon: 'success' });
                }
              })
              .catch((err) => {
                wx.showToast({ title: '搜索失败: ' + err.message, icon: 'none' });
                this.setData({ searching: false });
              });
    }).catch((err) => {
      this.setData({ searching: false });
    });
  },

  onNearbyTap(e) {
    const idx = e.currentTarget.dataset.idx;
    const court = this.data.nearbyCourts[idx];
    if (!court) return;
    this._showNearbyActions(court);
  },

  _showNearbyActions(court) {
    wx.showActionSheet({
      itemList: ['地图导航', '保存到本地球场', '复制地址'],
      success: async (res) => {
        if (res.tapIndex === 0) {
          wx.openLocation({
            latitude: court.latitude,
            longitude: court.longitude,
            name: court.name,
            address: court.address
          });
        } else if (res.tapIndex === 1) {
          await CourtStorage.save({
            name: court.name,
            address: court.address || '',
            rating: 3,
            latitude: court.latitude,
            longitude: court.longitude
          });
          wx.showToast({ title: '已保存', icon: 'success' });
          await this._loadCourts();
        } else if (res.tapIndex === 2) {
          wx.setClipboardData({ data: court.address || court.name });
        }
      }
    });
  },

  openMapNav(e) {
    const { lat, lng, name, address } = e.currentTarget.dataset;
    wx.openLocation({
      latitude: parseFloat(lat),
      longitude: parseFloat(lng),
      name,
      address
    });
  },

  closeForm() {
    this.setData({ showForm: false });
    wx.showTabBar({ animation: false });
  },

  formInput(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [`formData.${field}`]: e.detail.value });
  },

  noop() {},

  formRating(e) {
    this.setData({ 'formData.rating': parseInt(e.currentTarget.dataset.star) });
  },

  async submitForm() {
    const fd = this.data.formData;
    if (!fd.name) {
      wx.showToast({ title: '请输入球场名称', icon: 'none' });
      return;
    }
    const record = {
      id: fd.id || undefined,
      name: fd.name,
      address: fd.address || '',

      rating: fd.rating || 3,
      latitude: fd.latitude || 0,
      longitude: fd.longitude || 0
    };
    await CourtStorage.save(record);
    this.setData({ showForm: false });
    wx.showTabBar({ animation: false });
    wx.showToast({ title: fd.id ? '已更新' : '已添加', icon: 'success' });
    await this._loadCourts();
  },

  async onCourtTap(e) {
    const id = e.currentTarget.dataset.id;
    const court = await CourtStorage.get(id);
    if (court) this._showCourtActions(court);
  },

  _showCourtActions(court) {
    wx.showActionSheet({
      itemList: ['编辑', '地图导航', '删除'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.hideTabBar({ animation: false });
          this.setData({
            formMode: 'edit',
            showForm: true,
            formData: { ...court }
          });
        } else if (res.tapIndex === 1) {
          this._navigateToCourt(court);
        } else if (res.tapIndex === 2) {
          wx.showModal({
            title: '确认删除',
            content: `删除「${court.name}」？`,
            success: async (r) => {
              if (r.confirm) {
                await CourtStorage.remove(court.id);
                await this._loadCourts();
              }
            }
          });
        }
      }
    });
  },

  _navigateToCourt(court) {
    if (court.latitude && court.longitude) {
      wx.openLocation({
        latitude: court.latitude,
        longitude: court.longitude,
        name: court.name,
        address: court.address
      });
    } else if (court.address) {
      wx.showLoading({ title: '解析地址中...' });
      geocodeAddress(court.address).then(async (loc) => {
        wx.hideLoading();
        court.latitude = loc.latitude;
        court.longitude = loc.longitude;
        await CourtStorage.save(court);
        wx.openLocation({
          latitude: loc.latitude,
          longitude: loc.longitude,
          name: court.name,
          address: court.address
        });
      }).catch(() => {
        wx.hideLoading();
        wx.showToast({ title: '无法解析地址', icon: 'none' });
      });
    } else {
      wx.showToast({ title: '该球场暂无位置信息', icon: 'none' });
    }
  },

  _nextMid() {
    return ++_mid;
  },

  onCalloutTap(e) {
    const markerId = e.detail.markerId;
    const info = _midMap[markerId];
    if (!info) return;
    if (info.type === 'poi') {
      const court = this.data.nearbyCourts.find(c => c.id === info.id);
      if (court) this._showNearbyActions(court);
    } else if (info.type === 'court') {
      const court = this.data.courts.find(c => c.id === info.id);
      if (court) this._showCourtActions(court);
    }
  },

  async onMigrateTap() {
    wx.showLoading({ title: '迁移中...' });
    try {
      const n = await migrateLocalToCloud();
      wx.hideLoading();
      wx.showToast({ title: '已迁移 ' + n + ' 条记录', icon: 'success' });
      this.setData({ showMigrate: false });
      await this._loadCourts();
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '迁移失败: ' + e.message, icon: 'none' });
    }
  },

  onShareAppMessage() {
    return { title: '网球训练助手', path: 'pages/court/court' };
  }
});
