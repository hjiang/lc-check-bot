const storage = require('leancloud-storage');
const fetch = require('node-fetch');

var g_region = null;

function initSdkForUS() {
  storage.applicationId = null;
  storage.init({
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
    res.send(`✓ ${g_region} Storage (read/write/delete)`);
  } catch (e) {
    res.send(`✗ ${g_region} Storage (read/write/delete): ${e}`);
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

module.exports = robot => {
  robot.respond(/check/i, async res => {
    initSdkForUS();
    await checkStorage(res);
    await checkLeanEngineWeb(res, process.env.US_LC_LE_WEB_URL);
    initSdkForCN();
    await checkStorage(res);
    await checkLeanEngineWeb(res, process.env.CN_LC_LE_WEB_URL);
  });
};
