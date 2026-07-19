const cloud = require('wx-server-sdk');
cloud.init();
const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext();
  const { action, activityId, name, gender, level } = event;

  const { data } = await db.collection('activity').doc(activityId).get();
  if (!data) return { success: false, error: 'not_found' };

  const participants = data.participants || [];
  const waitlist = data.waitlist || [];

  if (action === 'join') {
    const isFull = gender === 'male'
      ? participants.filter(p => p.gender === 'male').length >= data.maxMale
      : participants.filter(p => p.gender === 'female').length >= data.maxFemale;
    const obj = { name, gender, level, openid: OPENID };
    if (isFull) {
      await db.collection('activity').doc(activityId).update({ data: { waitlist: _.push([obj]) } });
    } else {
      await db.collection('activity').doc(activityId).update({ data: { participants: _.push([obj]) } });
    }
    return { success: true, waitlisted: isFull };
  }

  if (action === 'leave') {
    const activityRef = db.collection('activity').doc(activityId);
    let found = false;
    for (let i = 0; i < participants.length; i++) {
      if (participants[i].openid === OPENID && (!name || participants[i].name === name)) {
        const p = participants[i];
        participants.splice(i, 1);
        for (let j = 0; j < waitlist.length; j++) {
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
      for (let i = 0; i < waitlist.length; i++) {
        if (waitlist[i].openid === OPENID && (!name || waitlist[i].name === name)) {
          waitlist.splice(i, 1);
          found = true;
          break;
        }
      }
    }
    if (!found) return { success: false, error: 'not_found' };
    await activityRef.update({ data: { participants, waitlist } });
    return { success: true };
  }

  return { success: false, error: 'unknown_action' };
};
