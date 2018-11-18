const storage = require('leancloud-storage');
const { Realtime, TextMessage } = require('leancloud-realtime');
const fetch = require('node-fetch');

var g_region = null;
var g_rtm = null;

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
  g_region = 'US'
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
  g_region = 'CN'
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
    res.send(`✓ ${g_region} LeanStorage (read/write/delete)`);
  } catch (e) {
    res.send(`✗ ${g_region} LeanStorage (read/write/delete): ${e}`);
  }
}

async function checkLeanEngineWeb(res, url) {
  try {
    const response = await fetch(url);
    if (response.ok) {
      res.send(`✓ ${g_region} LeanEngine - web hosting`);
    } else {
      throw new Error(`Received HTTP Error ${response.status}`);
    }
  } catch (e) {
    res.send(`✗ ${g_region} LeanEngine - web hosting: ${e}`);
  }
}

async function checkRTM(res) {
  try {
    const alice = await g_rtm.createIMClient('alice');
    const conv = await alice.createConversation({members: ['bob'], name: 'test'});
    const msg = await conv.send(new TextMessage('test msg'));
    if (msg.getText() !== 'test msg') {
      throw new Error('Alice did not receive back expected message.');
    }
    res.send(`✓ ${g_region} LeanMessage`);
  } catch (e) {
    res.send(`✗ ${g_region} LeanMessage: ${e}`);
  }
}

module.exports = robot => {
  robot.respond(/check/i, async res => {
    initSdkForUS();
    await checkStorage(res);
    await checkLeanEngineWeb(res, process.env.US_LC_LE_WEB_URL);
    await checkRTM(res);
    initSdkForCN();
    await checkStorage(res);
    await checkLeanEngineWeb(res, process.env.CN_LC_LE_WEB_URL);
    await checkRTM(res);
  });
};
