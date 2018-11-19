const storage = require('leancloud-storage');
const LiveQuery = require('leancloud-storage/live-query');
const { Realtime, TextMessage, Event } = require('leancloud-realtime');
const fetch = require('node-fetch');
const play = require('@leancloud/play');

var g_region = null;
var g_rtm = null;
const PASS = '**✓**'
const FAIL = '**✘**'

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
        reject('Timeout reached');
      } else {
        setTimeout(_wait, 1000);
      }
    }
    _wait();
  });
}

async function checkStorage(res) {
  try {
    const TestClass = storage.Object.extend('TestClass');

    const query = new storage.Query(TestClass);
    const newObj = new TestClass();
    newObj.set('msg', 'testmsg');
    const savedObj = await newObj.save();
    const id = savedObj.getObjectId()
    if (!id || id.length === 0) {
      throw new Error('Invalid ObjectId');
    }

    const testObj = await query.first();
    if (!testObj.get('msg') || testObj.get('msg').length === 0) {
      throw new Error('Did not receive expected data');
    }

    await testObj.destroy();
    res.send(`${PASS} ${g_region} LeanStorage (read/write/delete)`);
  } catch (e) {
    res.send(`${FAIL} ${g_region} LeanStorage (read/write/delete): ${e}`);
  }
}

async function checkLeanEngineWeb(res, url) {
  try {
    const response = await fetch(url);
    if (response.ok) {
      res.send(`${PASS} ${g_region} LeanEngine - web hosting`);
    } else {
      throw new Error(`Received HTTP Error ${response.status}`);
    }
  } catch (e) {
    res.send(`${FAIL} ${g_region} LeanEngine - web hosting: ${e}`);
  }
}

async function checkRTM(res) {
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
        res.send(`${FAIL} ${g_region} LeanMessage: Error: bob received unmatching message!`);
      }
    });
    const msg = await conv.send(new TextMessage('test msg'));
    if (msg.getText() !== 'test msg') {
      throw new Error('Alice did not receive back expected message.');
    }
    await waitUntil(() => bobReceivedMessage);
    res.send(`${PASS} ${g_region} LeanMessage`);
  } catch (e) {
    res.send(`${FAIL} ${g_region} LeanMessage: ${e}`);
  } finally {
    alice && alice.close();
    bob && bob.close();
  }
}

async function checkLiveQuery(res) {
  var newObj = null;
  try {
    const TestClass = LiveQuery.Object.extend('TestClass');
    const query = new LiveQuery.Query(TestClass);
    query.equalTo('msg', 'test lq');
    const liveQuery = await query.subscribe();
    var receivedNewItem = false;
    liveQuery.on('create', item => {
      if (item.get('msg') === 'test lq') {
        receivedNewItem = true;
      } else {
        res.send(`${FAIL} ${g_region} LiveQuery: received unmatching data!`);
      }
    });
    newObj = new TestClass();
    newObj.set('msg', 'test lq');
    await newObj.save();
    await waitUntil(() => receivedNewItem);
    res.send(`${PASS} ${g_region} LiveQuery`);
  } catch (e) {
    res.send(`${FAIL} ${g_region} LiveQuery: ${e}`)
  } finally {
    newObj && await newObj.destroy();
  }
}

async function checkPlay(res) {
  play.play.userId = 'ftwlol'
  try {
    var roomJoined = false;
    play.play.on(play.Event.Error, (err) => {
      const { code, detail } = err;
      res.send(`${FAIL} ${g_region} Play: (${code}) ${detail}`);
    });
    play.play.on(play.Event.CONNECTED, () => {
      play.play.joinOrCreateRoom('deathmatch');
    });
    play.play.on(play.Event.ROOM_CREATED, () => {
      roomJoined = true;
    });
    play.play.on(play.Event.ROOM_JOINED, () => {
      roomJoined = true;
    });
    play.play.on(play.Event.CONNECT_FAILED, (error) => {
      res.send(`${FAIL} ${g_region} Play: Failed to connect`);
    });
    play.play.on(play.Event.ROOM_JOIN_FAILED, () => {
      res.send(`${FAIL} ${g_region} Play: Failed to join room`);
    });
    play.play.on(play.Event.ROOM_CREATE_FAILED, () => {
      res.send(`${FAIL} ${g_region} Play: Failed to create room`);
    });
    play.play.connect();
    await waitUntil(() => roomJoined);
    res.send(`${PASS} ${g_region} Play`);
  } catch (e) {
    res.send(`${FAIL} ${g_region} Play: ${e}`)
  } finally {
    play.play.disconnect();
  }
}

module.exports = robot => {
  robot.respond(/check/i, async res => {
    initSdkForUS();
    await checkStorage(res);
    await checkLeanEngineWeb(res, process.env.US_LC_LE_WEB_URL);
    await checkRTM(res);
    await checkLiveQuery(res);
    // await checkPlay(res);
    initSdkForCN();
    await checkStorage(res);
    await checkLeanEngineWeb(res, process.env.CN_LC_LE_WEB_URL);
    await checkRTM(res);
    await checkLiveQuery(res);
    await checkPlay(res);
  });
};
