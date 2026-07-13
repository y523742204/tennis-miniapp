const cloud = require('./utils/cloud');

App({
  onLaunch() {
    cloud.init();
    wx.getSystemInfo({
      success: res => {
        this.globalData.systemInfo = res;
      }
    });
  },
  globalData: {
    systemInfo: null
  }
});
