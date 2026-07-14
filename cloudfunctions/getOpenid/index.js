const cloud = require('wx-server-sdk');

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  return { openid: OPENID };
};