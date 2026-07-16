const cloud = require('./utils/cloud');

App({
  onLaunch() {
    cloud.init();
    wx.getSystemInfo({
      success: res => {
        this.globalData.systemInfo = res;
      }
    });
    wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage'] });
  },
  globalData: {
    systemInfo: null
  }
});
