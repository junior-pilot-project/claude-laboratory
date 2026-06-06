async function sendTelegram(token, chatId, message) {
  if (!token || !chatId) {
    throw new Error('TELEGRAM_TOKEN과 TELEGRAM_CHAT_ID가 .env에 설정되어야 합니다');
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`텔레그램 API 오류 (${res.status}): ${body}`);
  }
}

module.exports = { sendTelegram };
