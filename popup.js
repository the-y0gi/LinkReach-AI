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
- Message should feel natural, human, and conversational (not salesy)

Rules:
- Max 300 characters
- Mention something from their headline
- Include my portfolio link
- Clearly ask for job, freelance work, or collaboration
- End with a soft question

Formatting Rules:
- Use short paragraphs (2–3 lines max)
- Add line breaks between ideas
- Do NOT write everything in one paragraph
- Keep it clean and easy to read

My Info:
- Name: Yogesh
- Role: Full Stack Developer (React, Node.js, Next.js, MongoDB, Redis, TypeScript, AWS)
- Portfolio: https://yogesh-gadhewal.vercel.app

Their Info:
- Name: ${profileData.name}
- Headline: ${profileData.headline}
- About: ${profileData.about}

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

  // console.log(response, "response");
  const data = await response.json();

  // console.log(data, "data");
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

  // console.log(message, "message");

  return cleanMessage(message);
}

function cleanMessage(message) {
  message = message
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  // paragraph formatting
  message = message.replace(/\. /g, ".\n\n");

  // Limit length
  if (message.length > 320) {
    message = message.substring(0, 317) + "...";
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
