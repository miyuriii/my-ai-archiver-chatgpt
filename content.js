browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'getConversation') {
    const text = extractConversation();
    sendResponse({ text });
  }
  return true;
});

function getCleanText(el) {
  const clone = el.cloneNode(true);
  const removeSelectors = ['svg', 'button', '[class*="sr-only"]', 'cite'];
  removeSelectors.forEach(sel => {
    clone.querySelectorAll(sel).forEach(node => node.remove());
  });
  return clone.innerText.trim();
}

function extractConversation() {
  const lines = [];
  const now = new Date();
  const url = window.location.href;

  lines.push(`# ChatGPT Conversation`);
  lines.push(`Date: ${now.toLocaleString('ja-JP')}`);
  lines.push(`URL: ${url}`);
  lines.push('');

  const allTurns = document.querySelectorAll('[data-message-author-role]');

  if (allTurns.length > 0) {
    const merged = [];
    for (const el of allTurns) {
      const role = el.getAttribute('data-message-author-role');
      if (role !== 'user' && role !== 'assistant') continue;
      const last = merged[merged.length - 1];
      const text = getCleanText(el);
      if (last && last.role === role) {
        const alreadyIncluded = last.texts.some(
          t => t.includes(text) || text.includes(t)
        );
        if (!alreadyIncluded) {
          last.texts.push(text);
        }
      } else {
        merged.push({ role, texts: [text] });
      }
    }

    for (const { role, texts } of merged) {
      const label = role === 'user' ? '👩 みゆり' : '🤖 ChatGPT';
      const text = texts.filter(Boolean).join('\n\n');
      if (text) {
        lines.push(`## ${label}`);
        lines.push('');
        lines.push(text);
        lines.push('');
      }
    }
    return lines.join('\n');
  }

  lines.push('(No conversation found. Make sure you are on a chatgpt.com conversation page.)');
  return lines.join('\n');
}
