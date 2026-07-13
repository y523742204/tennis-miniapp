const { CourtStorage, migrateLocalToCloud } = require('../../utils/storage');
const { searchNearbyPOI, geocodeAddress, AMAP_KEY } = require('../../utils/map');

Page({
  data: {
    courts: [],
    markers: [],
    mode: 'list',
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
    showMigrate: false
  },

  async onShow() {
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
  },

  async _loadCourts() {
    const courts = await CourtStorage.getAll();
    const markers = courts.filter(c => c.latitude).map((c) => ({
      id: c.id,
      latitude: c.latitude,
      longitude: c.longitude,
      title: c.name,
      iconPath: '/images/marker.png',
      width: 40,
      height: 40
    }));
    this.setData({ courts, markers, nearbyCourts: [] });
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
    const radii = [500, 1000, 2000, 5000];
    this.setData({ radiusIndex: idx, searchRadius: radii[idx] });
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
    wx.authorize({
      scope: 'scope.userLocation',
      success: () => {
        wx.getLocation({
          type: 'gcj02',
          success: (loc) => {
            this.setData({ mapLatitude: loc.latitude, mapLongitude: loc.longitude });
            searchNearbyPOI(loc.latitude, loc.longitude, this.data.searchRadius, '网球场')
              .then(async (pois) => {
                const nx = pois.map(p => ({
                  id: 'poi_' + p.id,
                  latitude: p.latitude,
                  longitude: p.longitude,
                  title: p.name,
                  iconPath: '/images/marker.png',
                  width: 40,
                  height: 40
                }));
                const saved = (await CourtStorage.getAll()).filter(c => c.latitude).map(c => ({
                  id: c.id,
                  latitude: c.latitude,
                  longitude: c.longitude,
                  title: c.name,
                  iconPath: '/images/marker.png',
                  width: 40,
                  height: 40
                }));
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
          },
          fail: () => {
            wx.showToast({ title: '获取位置失败', icon: 'none' });
            this.setData({ searching: false });
          }
        });
      },
      fail: () => {
        wx.showToast({ title: '需授权位置信息才能搜索', icon: 'none' });
        this.setData({ searching: false });
      }
    });
  },

  onNearbyTap(e) {
    const idx = e.currentTarget.dataset.idx;
    const court = this.data.nearbyCourts[idx];
    if (!court) return;
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
    if (court) {
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
          } else if (res.tapIndex === 2) {
            wx.showModal({
              title: '确认删除',
              content: `删除「${court.name}」？`,
          success: async (r) => {
            if (r.confirm) {
              await CourtStorage.remove(id);
              await this._loadCourts();
            }
          }
            });
          }
        }
      });
    }
  },

  async onMapMarkerTap(e) {
    const id = e.detail.markerId;
    const court = await CourtStorage.get(String(id));
    if (court) {
      wx.showActionSheet({
        itemList: ['查看详情', '地图导航'],
        success: async (res) => {
          if (res.tapIndex === 1 && court.latitude) {
            wx.openLocation({
              latitude: court.latitude,
              longitude: court.longitude,
              name: court.name
            });
          }
        }
      });
      return;
    }
    const poi = this.data.nearbyCourts.find(p => 'poi_' + p.id === id);
    if (poi) {
      wx.showActionSheet({
        itemList: ['地图导航', '保存到本地球场'],
        success: async (res) => {
          if (res.tapIndex === 0) {
            wx.openLocation({
              latitude: poi.latitude,
              longitude: poi.longitude,
              name: poi.name
            });
          } else if (res.tapIndex === 1) {
            await CourtStorage.save({
              name: poi.name,
              address: poi.address || '',

              rating: 3,
              latitude: poi.latitude,
              longitude: poi.longitude
            });
            wx.showToast({ title: '已保存', icon: 'success' });
            await this._loadCourts();
          }
        }
      });
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
  }
});
