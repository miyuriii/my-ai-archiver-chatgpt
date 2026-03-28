// ── background.js ─────────────────────────────────────────
browser.runtime.onInstalled.addListener(() => {
  console.log('[Claude Archiver] Installed and ready.');
});

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'generateAudio') {
    handleAudioGeneration(message.text, message.filename)
      .then(path => {
        browser.runtime.sendMessage({ action: 'audioResult', success: true, path });
      })
      .catch(err => {
        browser.runtime.sendMessage({ action: 'audioResult', success: false, error: err.message });
      });
    return false;
  }
});

async function handleAudioGeneration(text, filename) {
  return new Promise((resolve, reject) => {
    let port;
    let messageReceived = false;

    try {
      port = browser.runtime.connectNative('com.miyuri.claudearchiver');
    } catch (e) {
      reject(new Error('Native host not installed.'));
      return;
    }

    const timer = setTimeout(() => {
      port.disconnect();
      reject(new Error('Audio generation timed out.'));
    }, 600000);

    port.onMessage.addListener((response) => {
      messageReceived = true;
      clearTimeout(timer);
      port.disconnect();
      if (response.success) {
        resolve(response.path);
      } else {
        reject(new Error(response.error || 'Audio generation failed'));
      }
    });

    port.onDisconnect.addListener(() => {
      clearTimeout(timer);
      if (!messageReceived) {
        const err = browser.runtime.lastError;
        reject(new Error(err ? err.message : 'Native host disconnected unexpectedly'));
      }
    });

    port.postMessage({ text, filename });
  });
}

