const notifier = require('node-notifier');

function sendWindowsToast(title, message) {
  notifier.notify({
    title,
    message,
    sound: true,
    wait: false,
  });
}

module.exports = { sendWindowsToast };
