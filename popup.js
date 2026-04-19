const apiKeyInput = document.getElementById("apiKey");
const customPromptInput = document.getElementById("customPrompt");
const generateBtn = document.getElementById("generateBtn");
const copyBtn = document.getElementById("copyBtn");
const resultDiv = document.getElementById("result");
const statusDiv = document.getElementById("status");

// Load saved data
chrome.storage.local.get(["geminiApiKey", "savedCustomPrompt"], (data) => {
  if (data.geminiApiKey) apiKeyInput.value = data.geminiApiKey;
  if (data.savedCustomPrompt) customPromptInput.value = data.savedCustomPrompt;
});

generateBtn.addEventListener("click", async () => {
  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) {
    return showError("Please enter your Gemini API Key first!");
  }

  // Save data
  chrome.storage.local.set({
    geminiApiKey: apiKey,
    savedCustomPrompt: customPromptInput.value.trim(),
  });

  setLoading(true, "Fetching profile data...");
  resetUI();

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab.url.includes("linkedin.com/in/")) {
      throw new Error("Please open a LinkedIn profile page");
    }

    // Inject content script
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });

    chrome.tabs.sendMessage(
      tab.id,
      { action: "getProfileData" },
      async (profileData) => {
        if (chrome.runtime.lastError) {
          return handleError("Refresh LinkedIn page and try again.");
        }

        if (!profileData?.name || profileData.name === "Unknown User") {
          return handleError("Failed to extract profile.");
        }

        setLoading(true, "Generating personalized message...");

        const systemPrompt = buildPrompt(profileData);

        try {
          const message = await generateMessage(apiKey, systemPrompt);

          displayResult(message);
        } catch (err) {
          handleError(err.message);
        }
      },
    );
  } catch (err) {
    handleError(err.message);
  }
});

function buildPrompt(profileData) {
  return `
You are writing a LinkedIn outreach message.

Goal:
- I am looking for job or freelance opportunities
- Message should feel natural and human (not salesy)

Rules:
- Max 280 characters
- Mention something from their headline
- Include my portfolio link
- Clearly ask for job, freelance work, or collaboration
- End with a soft question

My Info:
- Name: Yogesh
- Role: Full Stack Developer (React, Node.js, Next.js, MongoDB, Redis, TypeScript, AWS)
- Portfolio: https://yogesh-gadhewal.vercel.app

Their Info:
- Name: ${profileData.name}
- Headline: ${profileData.headline}

Custom Instructions:
${customPromptInput.value || "Keep it short, friendly, and value-focused."}
`;
}

async function generateMessage(apiKey, prompt) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    },
  );

  if (!response.ok) {
    throw new Error("Gemini API error");
  }

  const data = await response.json();

  let message = "";

  if (data?.candidates?.length > 0) {
    const parts = data.candidates[0]?.content?.parts || [];
    message = parts
      .map((p) => p.text || "")
      .join(" ")
      .trim();
  }

  if (!message) {
    throw new Error("No message generated");
  }

  return cleanMessage(message);
}

function cleanMessage(message) {
  message = message.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();

  if (message.length > 280) {
    message = message.substring(0, 277) + "...";
  }

  return message;
}

function displayResult(message) {
  resultDiv.textContent = message;
  resultDiv.style.display = "block";
  copyBtn.style.display = "block";
  statusDiv.textContent = "Message generated!";

  copyBtn.onclick = () => {
    navigator.clipboard.writeText(message);
    copyBtn.textContent = "Copied!";
    setTimeout(() => {
      copyBtn.textContent = "Copy Message to Clipboard";
    }, 1500);
  };

  setLoading(false);
}

function handleError(msg) {
  showError(msg);
  setLoading(false);
}

function showError(msg) {
  statusDiv.innerHTML = `<span style="color:red">${msg}</span>`;
}

function setLoading(isLoading, text = "") {
  generateBtn.disabled = isLoading;
  generateBtn.textContent = isLoading
    ? "Loading..."
    : "Generate Personalized Message";
  if (text) statusDiv.textContent = text;
}

function resetUI() {
  resultDiv.style.display = "none";
  copyBtn.style.display = "none";
}
