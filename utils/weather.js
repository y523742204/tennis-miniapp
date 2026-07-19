const { getAMap } = require('./map');

function getLiveWeather(latitude, longitude) {
  return new Promise((resolve, reject) => {
    const amap = getAMap();
    amap.getRegeo({
      location: longitude + ',' + latitude,
      success: (res) => {
        const comp = res[0]?.regeocodeData?.addressComponent;
        const city = comp?.city || comp?.province;
        if (!city) { reject(new Error('无法获取城市')); return; }
        amap.getWeather({
          type: 'base', city,
          success: (w) => resolve(w.liveData),
          fail: reject
        });
      },
      fail: reject
    });
  });
}

module.exports = { getLiveWeather };
