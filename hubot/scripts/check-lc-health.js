const storage = require('leancloud-storage');
const LiveQuery = require('leancloud-storage/live-query');
const { Realtime, TextMessage, Event } = require('leancloud-realtime');
const fetch = require('node-fetch');
const play = require('@leancloud/play');

var g_region = null;
var g_rtm = null;
const PASS = '**✓**';
const FAIL = '**✘**';

function initSdkForUS() {
  storage.applicationId = null;
  storage.init({
    appId: process.env.US_LC_APP_ID,
    appKey: process.env.US_LC_APP_KEY
  });
  g_rtm = new Realtime({
    appId: process.env.US_LC_APP_ID,
    appKey: process.env.US_LC_APP_KEY
  });
  play.play.init({
    appId: process.env.US_LC_APP_ID,
    appKey: process.env.US_LC_APP_KEY,
    region: play.Region.NorthAmerica,
  });
  g_region = '🇺🇸 '
}

function initSdkForCN() {
  storage.applicationId = null;
  storage._config.serverURLs = {};
  storage.init({
    appId: process.env.CN_LC_APP_ID,
    appKey: process.env.CN_LC_APP_KEY
  });
  g_rtm = new Realtime({
    appId: process.env.CN_LC_APP_ID,
    appKey: process.env.CN_LC_APP_KEY
  });
  play.play.init({
    appId: process.env.CN_LC_APP_ID,
    appKey: process.env.CN_LC_APP_KEY,
    region: play.Region.NorthChina,
  });
  g_region = '🇨🇳 '
}

function waitUntil(cond, seconds) {
  var remainingAttempts = seconds || 10;
  return new Promise((resolve, reject) => {
    const _wait = () => {
      remainingAttempts--;
      if (cond()) {
        resolve();
      } else if (remainingAttempts <= 0) {
        reject('Timeout reached but expected condition is not met.');
      } else {
        setTimeout(_wait, 1000);
      }
    }
    _wait();
  });
}

async function checkStorage(sender) {
  try {
    const TestClass = storage.Object.extend('TestClass');

    const query = new storage.Query(TestClass);
    const newObj = new TestClass();
    newObj.set('msg', 'testmsg');
    const savedObj = await newObj.save();
    const id = savedObj.getObjectId();
    if (!id || id.length === 0) {
      throw new Error('Invalid ObjectId');
    }

    const testObj = await query.first();
    if (!testObj.get('msg') || testObj.get('msg').length === 0) {
      throw new Error('Did not receive expected data');
    }

    await testObj.destroy();
    sender.pass(`LeanStorage (read/write/delete)`);
  } catch (e) {
    sender.fail(`LeanStorage (read/write/delete): ${e}`);
  }
}

async function checkLeanEngineWeb(sender, url) {
  try {
    const response = await fetch(url);
    if (response.ok) {
      sender.pass(`LeanEngine - web hosting`);
    } else {
      throw new Error(`Received HTTP Error ${response.status}`);
    }
  } catch (e) {
    sender.fail(`LeanEngine - web hosting: ${e}`);
  }
}

async function checkRTM(sender) {
  var alice = null;
  var bob = null
  try {
    alice = await g_rtm.createIMClient('alice');
    bob = await g_rtm.createIMClient('bob');
    var bobReceivedMessage = false;
    const conv = await alice.createConversation({ members: ['bob'], name: 'test' });
    bob.on(Event.MESSAGE, function (msg, _) {
      if (msg.getText() === 'test msg') {
        bobReceivedMessage = true;
      } else {
        sender.fail(`LeanMessage: Error: bob received unmatching message!`);
      }
    });
    const msg = await conv.send(new TextMessage('test msg'));
    if (msg.getText() !== 'test msg') {
      throw new Error('Alice did not receive back expected message.');
    }
    await waitUntil(() => bobReceivedMessage);
    sender.pass(`LeanMessage`);
  } catch (e) {
    sender.fail(`LeanMessage: ${e}`);
  } finally {
    alice && alice.close();
    bob && bob.close();
  }
}

async function checkLiveQuery(sender) {
  var newObj = null;
  var liveQuery = null;
  try {
    const TestClass = LiveQuery.Object.extend('TestClass');
    const query = new LiveQuery.Query(TestClass);
    query.equalTo('msg', 'test lq');
    liveQuery = await query.subscribe();
    var receivedNewItem = false;
    liveQuery.on('create', item => {
      if (item.get('msg') === 'test lq') {
        receivedNewItem = true;
      } else {
        sender.fail(`LiveQuery: received unmatching data!`);
      }
    });
    newObj = new TestClass();
    newObj.set('msg', 'test lq');
    await newObj.save();
    await waitUntil(() => receivedNewItem);
    sender.pass(`LiveQuery`);
  } catch (e) {
    sender.fail(`LiveQuery: ${e}`)
  } finally {
    liveQuery && await liveQuery.unsubscribe();
    newObj && await newObj.destroy();
  }
}

async function checkPlay(sender) {
  play.play.userId = 'ftwlol';
  try {
    var roomJoined = false;
    play.play.on(play.Event.Error, (err) => {
      const { code, detail } = err;
      sender.fail(`Play: (${code}) ${detail}`);
    });
    play.play.on(play.Event.CONNECTED, () => {
      play.play.joinOrCreateRoom('deathmatch');
    });
    play.play.on(play.Event.ROOM_JOINED, () => {
      roomJoined = true;
    });
    play.play.on(play.Event.CONNECT_FAILED, (error) => {
      sender.fail(`Play: Failed to connect: (${error.code}) ${error.detail}`);
    });
    play.play.on(play.Event.ROOM_JOIN_FAILED, (error) => {
      sender.fail(`Play: Failed to join room: (${error.code}) ${error.detail}`);
    });
    play.play.on(play.Event.ROOM_CREATE_FAILED, (error) => {
      sender.fail(`Play: Failed to create room: (${error.code}) ${error.detail}`);
    });
    play.play.connect();
    await waitUntil(() => roomJoined);
    sender.pass(`Play`);
  } catch (e) {
    sender.fail(`Play: ${e}`)
  } finally {
    play.play.disconnect();
    play.play.removeAllListeners();
  }
}

var g_monitor_us = false;

async function startUSMonitor(robot) {
  const sender = {
    pass: _ => {},
    fail: msg => {
      robot.messageRoom('stream:ops-support topic:R2', `${FAIL} ${g_region} ${msg}`);
      robot.messageRoom('pm-with:hjiang', `${FAIL} ${g_region} ${msg}`);
    }
  }
  const check = async () => {
    initSdkForUS();
    await checkStorage(sender);
    await checkLeanEngineWeb(sender, process.env.US_LC_LE_WEB_URL);
    await checkRTM(sender);
    await checkLiveQuery(sender);
    if (g_monitor_us) {
      setTimeout(check, 300000);
    }
  }
  await check();
}

module.exports = robot => {
  robot.respond(/monitor-us (\S*)/, async res => {
    const action = res.match[1];
    if (action === 'start') {
      if (g_monitor_us) return;
      res.send('Started monitoring LeanCloud US. Errors will be sent to "stream:ops-support topic:R2".');
      g_monitor_us = true;
      await startUSMonitor(robot);
    } else if (action === 'stop') {
      res.send('Turning off monitoring.');
      g_monitor_us = false;
    } else if (action === 'status') {
      res.send(`Monitoring is ${g_monitor_us ? 'on' : 'off'}`);
    }
  });

  robot.respond(/check/i, async res => {
    const sender = {
      pass: msg => {
        res.send(`${PASS} ${g_region} ${msg}`);
      },
      fail: msg => {
        res.send(`${FAIL} ${g_region} ${msg}`);
      }
    };
    res.send('Manual check started.');
    initSdkForUS();
    await checkStorage(sender);
    await checkLeanEngineWeb(sender, process.env.US_LC_LE_WEB_URL);
    await checkRTM(sender);
    await checkLiveQuery(sender);
    // await checkPlay(res);
    initSdkForCN();
    await checkStorage(sender);
    await checkLeanEngineWeb(sender, process.env.CN_LC_LE_WEB_URL);
    await checkRTM(sender);
    await checkLiveQuery(sender);
    await checkPlay(sender);
    res.send('Manual check finished.')
  });

  robot.respond(/play/i, async res => {
    const sender = {
      pass: msg => {
        res.send(`${PASS} ${g_region} ${msg}`);
      },
      fail: msg => {
        res.send(`${FAIL} ${g_region} ${msg}`);
      }
    };
    res.send('Manual check started.');
    initSdkForCN();
    await checkPlay(sender);
    res.send('Manual check finished.')
  });
};
