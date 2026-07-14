exports.main = async (event, context) => {
  return { openid: context.OPENID };
};