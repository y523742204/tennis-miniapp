const AMAP_KEY = 'cb68b4954095ef328540269843d27e6b';

function searchNearbyPOI(latitude, longitude, radius, keywords) {
  return new Promise((resolve, reject) => {
    if (!AMAP_KEY) { reject(new Error('未配置地图API Key')); return; }
    wx.request({
      url: 'https://restapi.amap.com/v3/place/around',
      data: {
        key: AMAP_KEY,
        location: longitude + ',' + latitude,
        radius: radius || 2000,
        keywords: keywords || '网球场',
        offset: 25,
        page: 1,
        extensions: 'base'
      },
      success: (res) => {
        if (res.data && res.data.status === '1' && res.data.pois) {
          resolve(res.data.pois.map(p => ({
            id: p.id,
            name: p.name,
            address: p.address,
            latitude: parseFloat(p.location.split(',')[1]),
            longitude: parseFloat(p.location.split(',')[0]),
            distance: parseInt(p.distance) || 0,
            phone: p.tel || ''
          })));
        } else {
          reject(new Error((res.data && res.data.info) || '搜索失败'));
        }
      },
      fail: reject
    });
  });
}

function geocodeAddress(address) {
  return new Promise((resolve, reject) => {
    if (!AMAP_KEY) { reject(new Error('未配置地图API Key')); return; }
    wx.request({
      url: 'https://restapi.amap.com/v3/geocode/geo',
      data: {
        key: AMAP_KEY,
        address: address,
        city: '成都',
        output: 'JSON'
      },
      success: (res) => {
        if (res.data && res.data.status === '1' && res.data.geocodes && res.data.geocodes.length) {
          const loc = res.data.geocodes[0].location.split(',');
          resolve({ latitude: parseFloat(loc[1]), longitude: parseFloat(loc[0]) });
        } else {
          reject(new Error('未找到该地址'));
        }
      },
      fail: reject
    });
  });
}

module.exports = { searchNearbyPOI, geocodeAddress, AMAP_KEY };
