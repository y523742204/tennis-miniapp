App({
  onLaunch() {
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
