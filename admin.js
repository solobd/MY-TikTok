// MY TikTok admin panel - Firebase Web SDK v10 (modular), no build step.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getDatabase, ref, get, onValue, update } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

/* ---------------------------------------------------------------------------
 * 1) PASTE YOUR FIREBASE WEB CONFIG HERE
 *    Firebase console > Project settings > Your apps > Web app > SDK setup.
 *    databaseURL is required for Realtime Database.
 * ------------------------------------------------------------------------- */
const firebaseConfig = {
    apiKey: "AIzaSyA5Y9Ul2ECeKItlTbN6PnPeDCUOcqAYouY",
    authDomain: "my-tiktok-1aeb4.firebaseapp.com",
    databaseURL: "https://my-tiktok-1aeb4-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "my-tiktok-1aeb4",
    storageBucket: "my-tiktok-1aeb4.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "1:132827998805:android:57f83450a331aa940602dc"
};

// Simple gate only. It is NOT real security: anyone can read this file.
// Real protection comes from Realtime Database security rules.
const ADMIN_PIN = "2026";

const CONFIG_PATH = "app_config";   // api_key, api_host, endpoint_url
const UPDATE_PATH = "app_update";   // latest_version_code, apk_download_url, update_message
const USAGE_PATH = "app_usage";     // current_count, max_limit
const DEFAULT_MAX_LIMIT = 200;

const $ = (id) => document.getElementById(id);

const els = {
    pinScreen: $("pin-screen"),
    pinForm: $("pin-form"),
    pinInput: $("pin-input"),
    pinError: $("pin-error"),
    dashboard: $("dashboard"),
    lockButton: $("lock-button"),
    globalStatus: $("global-status"),
    configForm: $("config-form"),
    configSave: $("config-save"),
    configStatus: $("config-status"),
    updateForm: $("update-form"),
    updateSave: $("update-save"),
    updateStatus: $("update-status"),
    usageProgress: $("usage-progress"),
    usagePercentage: $("usage-percentage"),
    usageText: $("usage-text"),
    usageStatus: $("usage-status"),
    resetUsageButton: $("reset-usage-button"),
    toast: $("admin-toast"),
};

let db = null;
let stopUsageListener = null;
let toastTimer = null;

function isPlaceholderConfig(config) {
    return String(config.apiKey).startsWith("YOUR_") || String(config.databaseURL).includes("YOUR_PROJECT_ID");
}

function initFirebase() {
    if (isPlaceholderConfig(firebaseConfig)) {
        showPinMessage("Paste your Firebase web config into admin.js (firebaseConfig) first.");
        return false;
    }
    try {
        const app = initializeApp(firebaseConfig);
        db = getDatabase(app);
        return true;
    } catch (error) {
        showPinMessage(`Firebase init failed: ${error.message}`);
        return false;
    }
}

// Setup errors are shown on the PIN card, because the dashboard is still hidden.
function showPinMessage(message) {
    els.pinError.textContent = message;
    els.pinError.classList.remove("hidden");
    els.pinForm.querySelectorAll("input, button").forEach((element) => {
        element.disabled = true;
    });
}

/* ----------------------------- UI helpers -------------------------------- */

function showGlobal(message, tone = "info") {
    const tones = {
        info: "bg-violet-50 text-violet-800",
        success: "bg-emerald-50 text-emerald-700",
        warn: "bg-amber-50 text-amber-800",
        error: "bg-rose-50 text-rose-700",
    };
    els.globalStatus.className = `mt-6 rounded-2xl px-4 py-3 text-sm font-medium ${tones[tone]}`;
    els.globalStatus.textContent = message;
    els.globalStatus.classList.remove("hidden");
}

function setStatus(element, message, tone = "muted") {
    const tones = {
        muted: "text-[#71809D]",
        success: "text-emerald-600",
        error: "text-rose-600",
    };
    element.className = `text-sm font-medium ${tones[tone]}`;
    element.textContent = message;
}

function setBusy(button, busy, busyLabel) {
    if (!button.dataset.idleLabel) {
        button.dataset.idleLabel = button.textContent;
    }
    button.disabled = busy;
    button.textContent = busy ? busyLabel : button.dataset.idleLabel;
}

function showToast(message, tone = "success") {
    window.clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.className = `pointer-events-none fixed bottom-5 right-5 z-50 max-w-sm rounded-xl px-5 py-4 text-sm font-semibold text-white shadow-xl ${
        tone === "success" ? "bg-emerald-600" : "bg-[#F5222D]"
    }`;
    toastTimer = window.setTimeout(() => els.toast.classList.add("hidden"), 3200);
}

function isHttpsUrl(value) {
    try {
        return new URL(value).protocol === "https:";
    } catch {
        return false;
    }
}

function errorText(error) {
    if (error && /permission_denied/i.test(error.message)) {
        return "Permission denied by Realtime Database rules.";
    }
    return error && error.message ? error.message : "Unknown error.";
}

/* ----------------------------- PIN gate ---------------------------------- */

els.pinForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (els.pinInput.value.trim() === ADMIN_PIN) {
        els.pinError.classList.add("hidden");
        els.pinScreen.classList.add("hidden");
        els.dashboard.classList.remove("hidden");
        els.pinInput.value = "";
        loadAll();
        return;
    }
    els.pinError.classList.remove("hidden");
    els.pinInput.value = "";
    els.pinInput.classList.remove("shake");
    void els.pinInput.offsetWidth; // restart animation
    els.pinInput.classList.add("shake");
});

els.lockButton.addEventListener("click", () => {
    if (stopUsageListener) {
        stopUsageListener();
        stopUsageListener = null;
    }
    els.dashboard.classList.add("hidden");
    els.pinScreen.classList.remove("hidden");
    els.globalStatus.classList.add("hidden");
    els.pinInput.focus();
});

/* ------------------------- Section 3: API usage -------------------------- */

function renderUsage(currentCount, maxLimit) {
    const percentage = maxLimit > 0
        ? Math.min(100, Math.max(0, Math.round((currentCount / maxLimit) * 100)))
        : 0;
    els.usageProgress.style.width = `${percentage}%`;
    els.usagePercentage.textContent = `${percentage}%`;
    els.usageText.textContent = `Used: ${currentCount} / ${maxLimit}`;

    const progress = els.usageProgress.parentElement;
    progress.setAttribute("aria-valuemax", String(maxLimit));
    progress.setAttribute("aria-valuenow", String(Math.min(currentCount, maxLimit)));
}

function startUsageTracker() {
    if (stopUsageListener) {
        return;
    }
    setStatus(els.usageStatus, "Loading usage...");
    const usageRef = ref(db, USAGE_PATH);

    stopUsageListener = onValue(usageRef, (snapshot) => {
        const data = snapshot.val() || {};
        const rawCurrent = Number(data.current_count);
        const rawLimit = Number(data.max_limit);
        const currentCount = Number.isFinite(rawCurrent) && rawCurrent >= 0
            ? Math.floor(rawCurrent)
            : 0;
        const maxLimit = Number.isFinite(rawLimit) && rawLimit > 0
            ? Math.floor(rawLimit)
            : DEFAULT_MAX_LIMIT;

        renderUsage(currentCount, maxLimit);
        setStatus(els.usageStatus, "Live usage from Firebase.", "success");

        // Create the required app_usage structure if either key is missing or invalid.
        const defaults = {};
        if (data.current_count == null || !Number.isFinite(rawCurrent) || rawCurrent < 0) {
            defaults.current_count = 0;
        }
        if (data.max_limit == null || !Number.isFinite(rawLimit) || rawLimit <= 0) {
            defaults.max_limit = DEFAULT_MAX_LIMIT;
        }
        if (Object.keys(defaults).length > 0) {
            update(usageRef, defaults).catch((error) => {
                setStatus(els.usageStatus, `Initialize failed: ${errorText(error)}`, "error");
            });
        }
    }, (error) => {
        setStatus(els.usageStatus, `Load failed: ${errorText(error)}`, "error");
        showToast(`Usage load failed: ${errorText(error)}`, "error");
    });
}

els.resetUsageButton.addEventListener("click", async () => {
    setBusy(els.resetUsageButton, true, "Resetting...");
    try {
        await update(ref(db, USAGE_PATH), { current_count: 0 });
        showToast("API usage counter reset to 0.");
    } catch (error) {
        showToast(`Reset failed: ${errorText(error)}`, "error");
    } finally {
        setBusy(els.resetUsageButton, false);
    }
});

/* ------------------------- Section 1: API config ------------------------- */

async function loadConfig() {
    setStatus(els.configStatus, "Loading current values...");
    try {
        const snapshot = await get(ref(db, CONFIG_PATH));
        const data = snapshot.val() || {};
        $("api_key").value = data.api_key ?? "";
        $("api_host").value = data.api_host ?? "";
        $("endpoint_url").value = data.endpoint_url ?? "";
        setStatus(els.configStatus, "Loaded from Firebase.", "success");
    } catch (error) {
        setStatus(els.configStatus, `Load failed: ${errorText(error)}`, "error");
    }
}

els.configForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const apiKey = $("api_key").value.trim();
    const apiHost = $("api_host").value.trim();
    const endpointUrl = $("endpoint_url").value.trim();

    if (!apiKey || !apiHost) {
        setStatus(els.configStatus, "api_key and api_host are required.", "error");
        return;
    }
    if (!isHttpsUrl(endpointUrl)) {
        setStatus(els.configStatus, "endpoint_url must be a full https:// URL.", "error");
        return;
    }

    setBusy(els.configSave, true, "Saving...");
    try {
        await update(ref(db, CONFIG_PATH), {
            api_key: apiKey,
            api_host: apiHost,
            endpoint_url: endpointUrl,
        });
        setStatus(els.configStatus, "Saved. Apps pick this up automatically.", "success");
    } catch (error) {
        setStatus(els.configStatus, `Save failed: ${errorText(error)}`, "error");
    } finally {
        setBusy(els.configSave, false);
    }
});

/* ------------------------- Section 2: app update ------------------------- */

async function loadUpdate() {
    setStatus(els.updateStatus, "Loading current values...");
    try {
        const snapshot = await get(ref(db, UPDATE_PATH));
        const data = snapshot.val() || {};
        $("latest_version_code").value = data.latest_version_code ?? "";
        $("apk_download_url").value = data.apk_download_url ?? "";
        $("update_message").value = data.update_message ?? "";
        setStatus(els.updateStatus, "Loaded from Firebase.", "success");
    } catch (error) {
        setStatus(els.updateStatus, `Load failed: ${errorText(error)}`, "error");
    }
}

els.updateForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const versionCode = Number($("latest_version_code").value);
    const apkUrl = $("apk_download_url").value.trim();
    const message = $("update_message").value.trim();

    if (!Number.isInteger(versionCode) || versionCode < 1) {
        setStatus(els.updateStatus, "latest_version_code must be a whole number of 1 or more.", "error");
        return;
    }
    if (!isHttpsUrl(apkUrl)) {
        setStatus(els.updateStatus, "apk_download_url must be a full https:// URL.", "error");
        return;
    }

    setBusy(els.updateSave, true, "Saving...");
    try {
        await update(ref(db, UPDATE_PATH), {
            latest_version_code: versionCode,
            apk_download_url: apkUrl,
            update_message: message,
        });
        setStatus(els.updateStatus, "Saved. Users below this version will see the update prompt.", "success");
    } catch (error) {
        setStatus(els.updateStatus, `Save failed: ${errorText(error)}`, "error");
    } finally {
        setBusy(els.updateSave, false);
    }
});

/* ------------------------------ Bootstrap -------------------------------- */

async function loadAll() {
    if (!db) {
        return;
    }
    startUsageTracker();
    await Promise.all([loadConfig(), loadUpdate()]);
}

initFirebase();
