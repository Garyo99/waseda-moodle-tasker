chrome.storage.sync.get(["autoRedirect"], function (result) {
  if (
    result.autoRedirect &&
    window.location.href === "https://wsdmoodle.waseda.jp/"
  ) {
    window.location.href = "https://wsdmoodle.waseda.jp/my";
  }
});
