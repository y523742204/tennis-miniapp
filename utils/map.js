const AMAP_KEY = 'cb68b4954095ef328540269843d27e6b';
var amapFile = require('./amap-wx');
var _amap = null;
function getAMap() {
  if (!_amap) _amap = new amapFile.AMapWX({ key: AMAP_KEY });
  return _amap;
}

function searchNearbyPOI(latitude, longitude, radius, keywords) {
  return new Promise(function(resolve, reject) {
    if (!AMAP_KEY) { reject(new Error('未配置地图API Key')); return; }
    getAMap().getPoiAround({
      location: longitude + ',' + latitude,
      querykeywords: keywords || '网球场',
      radius: radius || 2000,
      success: function(data) {
        var raw = data.poisData || [];
        resolve(raw.map(function(p) {
          var loc = p.location ? p.location.split(',') : [];
          return {
            id: p.id || '',
            name: p.name || '',
            address: p.address || '',
            latitude: loc.length > 1 ? parseFloat(loc[1]) : 0,
            longitude: loc.length > 1 ? parseFloat(loc[0]) : 0,
            distance: parseInt(p.distance) || 0,
            phone: p.tel || ''
          };
        }));
      },
      fail: function(err) {
        reject(new Error(err.errMsg || (err.errCode ? '错误码:' + err.errCode : '搜索失败')));
      }
    });
  });
}

function geocodeAddress(address) {
  return new Promise(function(resolve, reject) {
    if (!AMAP_KEY) { reject(new Error('未配置地图API Key')); return; }
    getAMap().getGeo({
      address: address,
      city: '成都',
      success: function(data) {
        if (data.geocodes && data.geocodes.length) {
          var loc = data.geocodes[0].location.split(',');
          resolve({ latitude: parseFloat(loc[1]), longitude: parseFloat(loc[0]) });
        } else {
          reject(new Error('未找到该地址'));
        }
      },
      fail: function(err) {
        reject(new Error(err.errMsg || '地理编码失败'));
      }
    });
  });
}

function searchByKeyword(keywords, location, radius) {
  return new Promise(function(resolve, reject) {
    if (!AMAP_KEY) { reject(new Error('未配置地图API Key')); return; }
    getAMap().getPoiAround({
      location: location,
      querykeywords: keywords,
      radius: radius || 50000,
      success: function(data) {
        var raw = data.poisData || [];
        resolve(raw.map(function(p) {
          var loc = (p.location || '').split(',');
          return {
            id: p.id || '',
            name: p.name || '',
            address: p.address || '',
            latitude: loc.length > 1 ? parseFloat(loc[1]) : 0,
            longitude: loc.length > 1 ? parseFloat(loc[0]) : 0,
            distance: parseInt(p.distance) || 0,
            phone: p.tel || ''
          };
        }));
      },
      fail: function(err) {
        reject(new Error(err.errMsg || (err.errCode ? '错误码:' + err.errCode : '搜索失败')));
      }
    });
  });
}

module.exports = { getAMap, searchNearbyPOI, geocodeAddress, searchByKeyword, AMAP_KEY };