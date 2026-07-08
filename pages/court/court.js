const { CourtStorage } = require('../../utils/storage');

Page({
  data: {
    courts: [],
    markers: [],
    mode: 'list',
    showForm: false,
    formMode: 'add',
    formData: {}
  },

  onShow() {
    this._loadCourts();
  },

  _loadCourts() {
    const courts = CourtStorage.getAll();
    const markers = courts.filter(c => c.latitude).map((c) => ({
      id: c.id,
      latitude: c.latitude,
      longitude: c.longitude,
      title: c.name,
      iconPath: '/images/marker.png',
      width: 40,
      height: 40
    }));
    this.setData({ courts, markers });
  },

  switchMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ mode });
    if (mode === 'map') {
      this._loadMap();
    }
  },

  _loadMap() {
    this.setData({
      mapLongitude: 116.4,
      mapLatitude: 39.9
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

  callCourt(e) {
    const phone = e.currentTarget.dataset.phone;
    if (phone) {
      wx.makePhoneCall({ phoneNumber: phone });
    }
  },

  showAddForm() {
    this.setData({
      formMode: 'add',
      showForm: true,
      formData: {
        name: '',
        address: '',
        phone: '',
        rating: 3
      }
    });
  },

  closeForm() {
    this.setData({ showForm: false });
  },

  formInput(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [`formData.${field}`]: e.detail.value });
  },

  formRating(e) {
    this.setData({ 'formData.rating': parseInt(e.currentTarget.dataset.star) });
  },

  submitForm() {
    const fd = this.data.formData;
    if (!fd.name) {
      wx.showToast({ title: '请输入球场名称', icon: 'none' });
      return;
    }
    const record = {
      id: fd.id || undefined,
      name: fd.name,
      address: fd.address || '',
      phone: fd.phone || '',
      rating: fd.rating || 3,
      latitude: fd.latitude || 0,
      longitude: fd.longitude || 0
    };
    CourtStorage.save(record);
    this.setData({ showForm: false });
    wx.showToast({ title: fd.id ? '已更新' : '已添加', icon: 'success' });
    this._loadCourts();
  },

  onCourtTap(e) {
    const id = e.currentTarget.dataset.id;
    const court = CourtStorage.get(id);
    if (court) {
      wx.showActionSheet({
        itemList: ['编辑', '地图导航', '删除'],
        success: (res) => {
          if (res.tapIndex === 0) {
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
            } else {
              wx.showToast({ title: '该球场暂无位置信息', icon: 'none' });
            }
          } else if (res.tapIndex === 2) {
            wx.showModal({
              title: '确认删除',
              content: `删除「${court.name}」？`,
              success: (r) => {
                if (r.confirm) {
                  CourtStorage.remove(id);
                  this._loadCourts();
                }
              }
            });
          }
        }
      });
    }
  },

  onMapMarkerTap(e) {
    const id = e.detail.markerId;
    const court = CourtStorage.get(String(id));
    if (court) {
      wx.showActionSheet({
        itemList: ['查看详情', '地图导航'],
        success: (res) => {
          if (res.tapIndex === 1 && court.latitude) {
            wx.openLocation({
              latitude: court.latitude,
              longitude: court.longitude,
              name: court.name
            });
          }
        }
      });
    }
  }
});
