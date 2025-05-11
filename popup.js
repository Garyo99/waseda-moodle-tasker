document.addEventListener("DOMContentLoaded", () => {
  const openSettings = document.getElementById("openSettings");
  const closeSettings = document.getElementById("closeSettings");
  const mainView = document.getElementById("mainView");
  const settingsView = document.getElementById("settingsView");
  const autoRedirectSetting = document.getElementById("autoRedirectSetting");
  const autoDoneEventSetting = document.getElementById("autoDoneEventSetting");
  const daysSettingInput = document.getElementById("daysSetting");

  const eventsList = document.getElementById("eventsList");
  const updateButton = document.getElementById("updateButton");
  const lastUpdateDiv = document.getElementById("lastUpdate");

  function formatTimestamp(ts) {
    const d = new Date(ts);
    const Y = d.getFullYear();
    const M = String(d.getMonth() + 1).padStart(2, "0");
    const D = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    const s = String(d.getSeconds()).padStart(2, "0");
    return `${Y}/${M}/${D} ${h}:${m}:${s}`;
  }

  // ストレージから初期値を読み込む
  chrome.storage.sync.get(
    {
      autoRedirect: false,
      autoDoneEvent: false,
      events: [],
      lastUpdate: 0,
      daysSetting: 14,
      done: [],
    },
    (res) => {
      autoRedirectSetting.checked = res.autoRedirect;
      autoDoneEventSetting.checked = res.autoDoneEvent || false;
      daysSettingInput.value = res.daysSetting;
      renderEvents(res.events);
      if (res.lastUpdate) {
        lastUpdateDiv.textContent =
          "最終更新: " + formatTimestamp(res.lastUpdate);
      }
    }
  );

  // メイン ⇔ 設定 の切り替え
  openSettings.addEventListener("click", () => {
    mainView.classList.add("hidden");
    settingsView.classList.remove("hidden");
  });
  closeSettings.addEventListener("click", () => {
    settingsView.classList.add("hidden");
    mainView.classList.remove("hidden");
  });

  // 設定保存
  autoRedirectSetting.addEventListener("change", () => {
    chrome.storage.sync.set({ autoRedirect: autoRedirectSetting.checked });
  });
  autoDoneEventSetting.addEventListener("change", () => {
    chrome.storage.sync.set({ autoDoneEvent: autoDoneEventSetting.checked });
  });
  daysSettingInput.addEventListener("change", () => {
    let v = parseInt(daysSettingInput.value, 10);
    if (isNaN(v) || v < 1) {
      v = 1;
      daysSettingInput.value = v;
    }
    chrome.storage.sync.set({ daysSetting: v });
  });

  // イベント描画（未完了のもののみ表示）
  function renderEvents(events) {
    chrome.storage.sync.get({ done: [] }, ({ done }) => {
      const filteredEvents = events.filter((e) => {
        const match = e.url.match(/\bid=(\d+)/);
        if (match) {
          const id = Number(match[1]);
          return !done.some((item) => item.id === id && item.status === 1);
        }
        return true;
      });

      const now = new Date();
      const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      eventsList.innerHTML =
        filteredEvents && filteredEvents.length
          ? filteredEvents
              .map((e) => {
                const m = e.date.match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/);
                let cls = "";
                if (m) {
                  const [_, Y, Mo, Da] = m;
                  const eventDay = new Date(
                    Number(Y),
                    Number(Mo) - 1,
                    Number(Da)
                  );
                  const diffDays =
                    (eventDay.getTime() - today0.getTime()) /
                    (1000 * 60 * 60 * 24);
                  if (diffDays === 0 || diffDays === 1) {
                    cls = "soon";
                  }
                }
                return `
                  <li class="${cls}" data-url="${e.url}">
                    <div class="event-date">${e.date}</div>
                    <div>${e.title}</div>
                    <div>${e.course}</div>
                  </li>`;
              })
              .join("")
          : "<li>イベントはありません</li>";
    });
  }

  function saveAndRender(events, lastUpdate) {
    chrome.storage.sync.set({ events, lastUpdate }, () => {
      renderEvents(events);
      lastUpdateDiv.textContent = "最終更新: " + formatTimestamp(lastUpdate);
    });
  }

  // イベントクリックで新規タブを開く
  eventsList.addEventListener("click", (e) => {
    const li = e.target.closest("li[data-url]");
    if (!li) return;
    chrome.tabs.create({ url: li.getAttribute("data-url") });
  });

  // 更新ボタン
  updateButton.addEventListener("click", () => {
    updateButton.disabled = true;
    chrome.runtime.sendMessage({ action: "fetchEvents" }, (res) => {
      if (res.success) {
        saveAndRender(res.events, res.lastUpdate);
      } else {
        eventsList.innerHTML = `<li style="color:red">取得失敗: ${res.error}</li>`;
      }
      updateButton.disabled = false;
    });
  });
});
