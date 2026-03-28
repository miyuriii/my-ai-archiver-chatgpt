const saveBtn         = document.getElementById('saveBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const statusDot       = document.getElementById('statusDot');
const statusText      = document.getElementById('statusText');
const tokenInput      = document.getElementById('tokenInput');
const repoInput       = document.getElementById('repoInput');
const folderInput     = document.getElementById('folderInput');
const audioToggle     = document.getElementById('audioToggle');
const eyeBtn          = document.getElementById('eyeBtn');
const eyeIcon         = document.getElementById('eyeIcon');
const toast           = document.getElementById('toast');

const EYE_CLOSED = `
  <path d="M2 9 C7 16 17 16 22 9"/>
  <line x1="9"  y1="13" x2="8"  y2="16.5"/>
  <line x1="12" y1="14" x2="12" y2="17.5"/>
  <line x1="15" y1="13" x2="16" y2="16.5"/>`;

const EYE_OPEN = `
  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
  <circle cx="12" cy="12" r="3"/>`;

browser.storage.local.get(['token', 'repo', 'folder', 'audioEnabled']).then(data => {
  if (data.token)  tokenInput.value  = data.token;
  if (data.repo)   repoInput.value   = data.repo;
  if (data.folder) folderInput.value = data.folder;
  if (data.audioEnabled !== undefined) audioToggle.checked = data.audioEnabled;
});

eyeBtn.addEventListener('click', () => {
  const isHidden = tokenInput.type === 'password';
  tokenInput.type   = isHidden ? 'text' : 'password';
  eyeIcon.innerHTML = isHidden ? EYE_OPEN : EYE_CLOSED;
});

saveSettingsBtn.addEventListener('click', () => {
  browser.storage.local.set({
    token:        tokenInput.value.trim(),
    repo:         repoInput.value.trim(),
    folder:       folderInput.value.trim() || 'conversations/chatgpt',
    audioEnabled: audioToggle.checked,
  });
  showToast('✅ Settings saved!', 'success');
});

saveBtn.addEventListener('click', async () => {
  setStatus('saving');
  saveBtn.disabled = true;

  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    const response = await browser.tabs.sendMessage(tab.id, { action: 'getConversation' });

    if (!response || !response.text) {
      throw new Error('Could not get conversation. Make sure you are on chatgpt.com');
    }

    const text = response.text;
    const { token, repo, folder } = await browser.storage.local.get(['token', 'repo', 'folder']);

    if (!token || !repo) {
      throw new Error('GitHub Token and Repository are required. Check settings.');
    }

    const savedFolder = folder || 'conversations/chatgpt';
    const filename    = await saveToGitHub(text, token, repo, savedFolder);

    if (audioToggle.checked) {
      const audioFilename = filename.replace('.md', '.m4a');
      startAudioViaNative(text, audioFilename);
      showToast('✅ Saved to GitHub! 🎙️ Audio generating in background...', 'success');
    } else {
      showToast('✅ Saved to GitHub!', 'success');
    }

  } catch (err) {
    showToast('❌ ' + err.message, 'error');
    console.error('[ChatGPT Archiver]', err);
  } finally {
    setStatus('standby');
    saveBtn.disabled = false;
  }
});

async function saveToGitHub(text, token, repo, folder) {
  const now      = new Date();
  const dateStr  = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `chatgpt-${dateStr}.md`;
  const path     = `${folder}/${filename}`;
  const content  = btoa(unescape(encodeURIComponent(text)));

  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: `Save ChatGPT conversation ${dateStr}`,
      content,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`GitHub error: ${err.message}`);
  }

  return filename;
}

function startAudioViaNative(text, filename) {
  let port;
  try {
    port = browser.runtime.connectNative('com.miyuri.claudearchiver');
  } catch (e) {
    console.error('[ChatGPT Archiver] Native host error:', e);
    return;
  }

  port.onMessage.addListener((response) => {
    port.disconnect();
    console.log('[ChatGPT Archiver] Audio done:', response);
  });

  port.onDisconnect.addListener(() => {
    console.log('[ChatGPT Archiver] Native host disconnected');
  });

  port.postMessage({ text, filename });
}

function setStatus(state) {
  if (state === 'saving') {
    statusDot.classList.add('active');
    statusText.textContent = 'Saving...';
  } else {
    statusDot.classList.remove('active');
    statusText.textContent = 'Standby';
  }
}

function showToast(msg, type) {
  toast.textContent   = msg;
  toast.className     = type || '';
  toast.style.display = 'block';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.display = 'none'; }, 5000);
}
