function getProfileData() {
  let name = "Unknown User";
  let headline = "";
  let about = "";

  try {
    // NAME (h2 inside profile card)
    const nameEl = document.querySelector("main h2");

    if (nameEl && nameEl.innerText.trim().length > 2) {
      name = nameEl.innerText.trim();
    }

    // HEADLINE (first meaningful <p> under name)
    const allPs = document.querySelectorAll("main p");

    for (let p of allPs) {
      const text = p.innerText.trim();

      if (
        text.length > 20 &&
        text.length < 200 &&
        !text.toLowerCase().includes("followers") &&
        !text.toLowerCase().includes("connections") &&
        !text.toLowerCase().includes("san francisco") &&
        !text.toLowerCase().includes("contact")
      ) {
        headline = text;
        break;
      }
    }

    // ABOUT (expandable text box)
    const aboutEl = document.querySelector(
      '[data-testid="expandable-text-box"]',
    );

    if (aboutEl) {
      about = aboutEl.innerText.trim().substring(0, 800);
    }
  } catch (err) {
    console.error(" Extraction error:", err);
  }

  // console.log("FINAL DATA:", { name, headline, about });

  return { name, headline, about };
}

// WAIT (no infinite hang)
function waitForProfileLoad(timeout = 5000) {
  return new Promise((resolve) => {
    const start = Date.now();

    const check = () => {
      const nameEl = document.querySelector("main h2");

      if (nameEl) {
        resolve(true);
      } else if (Date.now() - start > timeout) {
        console.warn("Timeout fallback");
        resolve(false);
      } else {
        setTimeout(check, 300);
      }
    };

    check();
  });
}

// MESSAGE LISTENER
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getProfileData") {
    waitForProfileLoad().then(() => {
      const data = getProfileData();
      sendResponse(data);
    });

    return true;
  }
});
