chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ autoRedirect: true });
});

function waitForTabComplete(tabId, timeout = 10000) {
  return new Promise((resolve, reject) => {
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) return reject(new Error("Tab not found"));
      if (tab.status === "complete") return resolve();
      const listener = (updatedId, info) => {
        if (updatedId === tabId && info.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
          clearTimeout(timer);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
      const timer = setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error("Tab load timeout"));
      }, timeout);
    });
  });
}

async function extractEventsFromTab(tabId) {
  try {
    await waitForTabComplete(tabId);
  } catch {
    return { cards: 0, events: [] };
  }
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      function formatRelativeDate(text) {
        const d = new Date();
        if (text === "今日") {
          d.setDate(d.getDate());
        } else if (text === "明日") {
          d.setDate(d.getDate() + 1);
        } else {
          return text;
        }
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${yyyy}年 ${mm}月 ${dd}日`;
      }

      function formatDateTime(rawText) {
        const parts = rawText.split(",");
        const datePart = parts[0].trim();
        const timePart = parts[1] ? parts[1].trim() : "";
        const formattedDate = formatRelativeDate(datePart);
        return timePart ? `${formattedDate} ${timePart}` : formattedDate;
      }

      const cards = Array.from(document.querySelectorAll("div.card.rounded"));
      return cards.map((card) => {
        const titleEl = card.querySelector("h3.name.d-inline-block");

        const dateAnchor = card
          .querySelector("i.fa-clock-o")
          .closest(".row")
          .querySelector(".col-11 a");
        const dateContainer = dateAnchor ? dateAnchor.closest(".col-11") : null;
        const rawDate = dateContainer ? dateContainer.textContent.trim() : "";

        const courseEl = card
          .querySelector("i.fa-graduation-cap")
          .closest(".row")
          .querySelector(".col-11 a");

        const linkEl =
          card.querySelector(".card-footer a") ||
          card.querySelector("a.card-link");

        return {
          title: titleEl ? titleEl.textContent.trim() : "",
          date: formatDateTime(rawDate),
          course: courseEl ? courseEl.textContent.trim() : "",
          url: linkEl ? linkEl.href : "",
        };
      });
    },
  });

  return { cards: result.length, events: result };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "fetchEvents") {
    // 「取得する日数」を取得してからイベントをフェッチ
    chrome.storage.sync.get({ daysSetting: 14 }, ({ daysSetting }) => {
      (async () => {
        const allEvents = [];
        let prevTabId = null;
        const timestamps = Array.from({ length: daysSetting }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() + i);
          d.setHours(0, 0, 0, 0);
          return Math.floor(d.getTime() / 1000);
        });
        for (const ts of timestamps) {
          const url = `https://wsdmoodle.waseda.jp/calendar/view.php?view=day&time=${ts}`;
          const tab = await new Promise((r) =>
            chrome.tabs.create({ url, active: false }, r)
          );
          if (prevTabId) await chrome.tabs.remove(prevTabId);
          const { events } = await extractEventsFromTab(tab.id);
          if (events.length) allEvents.push(...events);
          prevTabId = tab.id;
        }
        if (prevTabId) await chrome.tabs.remove(prevTabId);
        const now = Date.now();
        await chrome.storage.sync.set({
          events: allEvents,
          lastUpdate: now,
        });
        sendResponse({ success: true, events: allEvents, lastUpdate: now });
      })();
    });
    return true;
  }
});
