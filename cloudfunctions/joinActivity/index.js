const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { action, activityId, name, gender, level } = event;

  const { data } = await db.collection('activity').doc(activityId).get();
  if (!data) return { success: false, error: 'not_found' };

  let participants = data.participants || [];
  let waitlist = data.waitlist || [];

  if (action === 'join') {
    const isFull = gender === 'male'
      ? participants.filter(p => p.gender === 'male').length >= data.maxMale
      : participants.filter(p => p.gender === 'female').length >= data.maxFemale;
    var obj = { name: name, gender: gender, level: level, openid: OPENID };
    if (isFull) waitlist.push(obj);
    else participants.push(obj);
    await db.collection('activity').doc(activityId).update({ data: { participants: participants, waitlist: waitlist } });
    return { success: true, waitlisted: isFull };
  }

  if (action === 'leave') {
    var found = false;
    for (var i = 0; i < participants.length; i++) {
      if (participants[i].openid === OPENID && (!name || participants[i].name === name)) {
        var p = participants[i];
        participants.splice(i, 1);
        for (var j = 0; j < waitlist.length; j++) {
          if (waitlist[j].gender === p.gender) {
            participants.push(waitlist.splice(j, 1)[0]);
            break;
          }
        }
        found = true;
        break;
      }
    }
    if (!found) {
      for (var i = 0; i < waitlist.length; i++) {
        if (waitlist[i].openid === OPENID && (!name || waitlist[i].name === name)) {
          waitlist.splice(i, 1);
          found = true;
          break;
        }
      }
    }
    if (!found) return { success: false, error: 'not_found' };
    await db.collection('activity').doc(activityId).update({ data: { participants: participants, waitlist: waitlist } });
    return { success: true };
  }

  return { success: false, error: 'unknown_action' };
};
