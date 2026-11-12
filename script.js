const API_KEY = "13e56f4a01msh744713e865da3dep1a79d6jsn4c314807c5ba";
const API_HOST = "tiktok-download-video1.p.rapidapi.com";

const fetchForm = document.querySelector("#fetch-form");
const urlInput = document.querySelector("#video-url");
const fetchButton = document.querySelector("#fetch-button");
const fetchButtonText = document.querySelector("#fetch-button-text");
const fetchIcon = document.querySelector("#fetch-icon");
const loadingIcon = document.querySelector("#loading-icon");
const formMessage = document.querySelector("#form-message");
const previewCard = document.querySelector("#preview-card");
const videoCover = document.querySelector("#video-cover");
const previewTitle = document.querySelector("#preview-title");
const downloadButton = document.querySelector("#download-button");
const downloadButtonContent = downloadButton.innerHTML;
const customDialog = document.querySelector("#custom-dialog");
const dialogMessage = document.querySelector("#dialog-message");
const dialogOkButton = document.querySelector("#dialog-ok-button");

let videoDownloadUrl = "";
let dialogCallback = null;

fetchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();

  const submittedUrl = urlInput.value.trim();
  if (!isValidTikTokUrl(submittedUrl)) {
    showMessage("Enter a valid TikTok video URL to continue.", "error");
    urlInput.focus();
    return;
  }

  setFetching(true);
  previewCard.classList.add("hidden");
  videoDownloadUrl = "";

  try {
    const endpoint = `https://${API_HOST}/getVideo?url=${encodeURIComponent(submittedUrl)}&hd=1`;
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        "x-rapidapi-key": API_KEY,
        "x-rapidapi-host": API_HOST
      }
    });

    if (!response.ok) {
      throw new Error(response.status === 429
        ? "The service is receiving too many requests. Please try again shortly."
        : `The video service returned an error (${response.status}).`);
    }

    const result = await response.json();
    const video = result.data || result;
    const cover = video.cover || video.origin_cover || video.ai_dynamic_cover;
    const title = video.title || "TikTok video";
    const downloadUrl = video.hdplay || video.play;

    if (!downloadUrl) {
      throw new Error(result.message || result.msg || "No downloadable video was found for this link.");
    }

    videoDownloadUrl = downloadUrl;
    videoCover.src = cover || "";
    videoCover.alt = `Preview for ${title}`;
    previewTitle.textContent = title;
    previewCard.classList.remove("hidden");
    previewCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (error) {
    const message = error instanceof TypeError
      ? "Unable to reach the video service. Check your connection and try again."
      : error.message;
    showMessage(message || "Something went wrong while fetching this video.", "error");
  } finally {
    setFetching(false);
  }
});

downloadButton.addEventListener("click", async () => {
  if (!videoDownloadUrl) {
    showMessage("Fetch a video before downloading.", "error");
    return;
  }

  const hdplayUrl = videoDownloadUrl;
  const proxyUrl = "https://corsproxy.io/?" + encodeURIComponent(hdplayUrl);
  downloadButton.textContent = "Downloading... Please wait";
  downloadButton.disabled = true;

  try {
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      throw new Error(`Video download failed (${response.status}).`);
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = downloadUrl;
    anchor.download = "MY_TikTok_Video.mp4";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 100);
  } catch (error) {
    console.error("Direct video download failed:", error);
    showCustomDialog(
      "Direct download blocked by browser. Video will open in a new tab. Please press the 3 dots and select Download.",
      () => window.open(hdplayUrl, "_blank")
    );
  } finally {
    downloadButton.innerHTML = downloadButtonContent;
    downloadButton.disabled = false;
  }
});

function isValidTikTokUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === "https:" && (host === "tiktok.com" || host.endsWith(".tiktok.com"));
  } catch {
    return false;
  }
}

function setFetching(isFetching) {
  fetchButton.disabled = isFetching;
  urlInput.disabled = isFetching;
  fetchButtonText.textContent = isFetching ? "Fetching..." : "Fetch Video";
  fetchIcon.classList.toggle("hidden", isFetching);
  loadingIcon.classList.toggle("hidden", !isFetching);
}

function showMessage(message, type) {
  formMessage.textContent = message;
  formMessage.className = `px-2 pb-1 pt-3 text-left text-sm font-medium ${
    type === "error" ? "text-red-600" : "text-emerald-700"
  }`;
}

function clearMessage() {
  formMessage.textContent = "";
  formMessage.className = "hidden px-2 pb-1 pt-3 text-left text-sm font-medium";
}

function showCustomDialog(message, callback) {
  dialogMessage.textContent = message;
  dialogCallback = typeof callback === "function" ? callback : null;
  customDialog.classList.remove("hidden");
  customDialog.classList.add("flex");
  document.body.classList.add("overflow-hidden");
  dialogOkButton.focus();
}

dialogOkButton.addEventListener("click", () => {
  customDialog.classList.add("hidden");
  customDialog.classList.remove("flex");
  document.body.classList.remove("overflow-hidden");

  const callback = dialogCallback;
  dialogCallback = null;
  if (callback) callback();
});
