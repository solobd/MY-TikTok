// All Downloader admin panel - Firebase Web SDK v10 (modular), no build step.
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

const CONFIG_PATH = "app_config";   // Platform API credentials
const UPDATE_PATH = "app_update";   // latest_version_code, apk_download_url, update_message
const USAGE_PATH = "app_usage";     // {platform}/{current_count,max_limit}
const DEFAULT_USAGE_LIMITS = {
    tiktok: 200,
    facebook: 500,
    instagram: 1000,
};
const USAGE_PLATFORMS = Object.keys(DEFAULT_USAGE_LIMITS);

const $ = (id) => document.getElementById(id);

const els = {
    globalStatus: $("global-status"),
    configForm: $("config-form"),
    configSave: $("config-save"),
    configStatus: $("config-status"),
    updateForm: $("update-form"),
    updateSave: $("update-save"),
    updateStatus: $("update-status"),
    tiktokUsageProgress: $("tiktok-usage-progress"),
    tiktokUsagePercentage: $("tiktok-usage-percentage"),
    tiktokUsageText: $("tiktok-usage-text"),
    facebookUsageProgress: $("facebook-usage-progress"),
    facebookUsagePercentage: $("facebook-usage-percentage"),
    facebookUsageText: $("facebook-usage-text"),
    instagramUsageProgress: $("instagram-usage-progress"),
    instagramUsagePercentage: $("instagram-usage-percentage"),
    instagramUsageText: $("instagram-usage-text"),
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
        showGlobal("Paste your Firebase web config into admin.js (firebaseConfig) first.", "error");
        return false;
    }
    try {
        const app = initializeApp(firebaseConfig);
        db = getDatabase(app);
        return true;
    } catch (error) {
        showGlobal(`Firebase init failed: ${error.message}`, "error");
        return false;
    }
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
    if (!button.dataset.idleHtml) {
        button.dataset.idleHtml = button.innerHTML;
    }
    button.disabled = busy;
    if (busy) {
        button.textContent = busyLabel;
    } else {
        button.innerHTML = button.dataset.idleHtml;
    }
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

/* ----------------------------- Accordions -------------------------------- */

function setupAccordions() {
    document.querySelectorAll("[data-accordion-trigger]").forEach((trigger) => {
        trigger.addEventListener("click", () => {
            const content = $(trigger.dataset.accordionTarget);
            const icon = trigger.querySelector("[data-accordion-icon]");
            if (!content || !icon) {
                return;
            }

            const expanded = trigger.getAttribute("aria-expanded") === "true";
            const shouldExpand = !expanded;
            const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 250;
            content.getAnimations().forEach((animation) => animation.cancel());
            trigger.setAttribute("aria-expanded", String(shouldExpand));
            icon.classList.toggle("rotate-180", shouldExpand);

            if (shouldExpand) {
                content.classList.remove("hidden");
                content.animate([
                    { opacity: 0, transform: "translateY(-8px)" },
                    { opacity: 1, transform: "translateY(0)" },
                ], {
                    duration,
                    easing: "cubic-bezier(.16, 1, .3, 1)",
                });
                return;
            }

            const animation = content.animate([
                { opacity: 1, transform: "translateY(0)" },
                { opacity: 0, transform: "translateY(-8px)" },
            ], {
                duration,
                easing: "ease-in",
            });
            animation.addEventListener("finish", () => {
                if (trigger.getAttribute("aria-expanded") === "false") {
                    content.classList.add("hidden");
                }
            }, { once: true });
        });
    });
}

/* ------------------------- Section 3: API usage -------------------------- */

function renderUsage(platform, currentCount, maxLimit) {
    const prefixes = {
        tiktok: "tiktokUsage",
        facebook: "facebookUsage",
        instagram: "instagramUsage",
    };
    const prefix = prefixes[platform];
    const progressBar = els[`${prefix}Progress`];
    const percentageText = els[`${prefix}Percentage`];
    const usageText = els[`${prefix}Text`];
    const percentage = maxLimit > 0
        ? Math.min(100, Math.max(0, Math.round((currentCount / maxLimit) * 100)))
        : 0;
    progressBar.style.width = `${percentage}%`;
    percentageText.textContent = `${percentage}%`;
    const period = platform === "instagram" ? " hourly" : "";
    usageText.textContent = `Used: ${currentCount} / ${maxLimit}${period}`;

    const progress = progressBar.parentElement;
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
        const defaults = {};
        USAGE_PLATFORMS.forEach((platform) => {
            const platformData = data[platform] || {};
            const rawCurrent = Number(platformData.current_count);
            const rawLimit = Number(platformData.max_limit);
            let currentCount = Number.isFinite(rawCurrent) && rawCurrent >= 0
                ? Math.floor(rawCurrent)
                : 0;
            const maxLimit = Number.isFinite(rawLimit) && rawLimit > 0
                ? Math.floor(rawLimit)
                : DEFAULT_USAGE_LIMITS[platform];

            if (platform === "instagram") {
                const currentHour = Math.floor(Date.now() / 3600000);
                const storedHour = Number(platformData.window_hour);
                if (!Number.isFinite(storedHour) || storedHour !== currentHour) {
                    currentCount = 0;
                    defaults[`${platform}/current_count`] = 0;
                    defaults[`${platform}/window_hour`] = currentHour;
                }
            }

            renderUsage(platform, currentCount, maxLimit);
            if (platformData.current_count == null || !Number.isFinite(rawCurrent) || rawCurrent < 0) {
                defaults[`${platform}/current_count`] = 0;
            }
            if (platformData.max_limit == null || !Number.isFinite(rawLimit) || rawLimit <= 0) {
                defaults[`${platform}/max_limit`] = DEFAULT_USAGE_LIMITS[platform];
            }
        });

        // Remove keys from the previous flat schema after platform nodes are initialized.
        if (data.current_count != null) {
            defaults.current_count = null;
        }
        if (data.max_limit != null) {
            defaults.max_limit = null;
        }

        setStatus(els.usageStatus, "Live usage from Firebase.", "success");
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
    if (!window.confirm("Reset TikTok, Facebook, and Instagram usage counters to 0?")) {
        return;
    }

    setBusy(els.resetUsageButton, true, "Resetting...");
    try {
        await update(ref(db, USAGE_PATH), {
            "tiktok/current_count": 0,
            "facebook/current_count": 0,
            "instagram/current_count": 0,
            "instagram/window_hour": Math.floor(Date.now() / 3600000),
        });
        setStatus(els.usageStatus, "All counters were reset.", "success");
        showToast("All platform counters reset to 0.");
    } catch (error) {
        setStatus(els.usageStatus, `Reset failed: ${errorText(error)}`, "error");
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
        $("fb_api_key").value = data.fb_api_key ?? "";
        $("fb_api_host").value = data.fb_api_host ?? "";
        $("fb_endpoint_url").value = data.fb_endpoint_url ?? "";
        $("instagram_api_key").value = data.instagram_api_key ?? "";
        $("instagram_api_host").value = data.instagram_api_host ?? "";
        $("instagram_endpoint_url").value = data.instagram_endpoint_url ?? "";
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
    const facebookApiKey = $("fb_api_key").value.trim();
    const facebookApiHost = $("fb_api_host").value.trim();
    const facebookEndpointUrl = $("fb_endpoint_url").value.trim();
    const instagramApiKey = $("instagram_api_key").value.trim();
    const instagramApiHost = $("instagram_api_host").value.trim();
    const instagramEndpointUrl = $("instagram_endpoint_url").value.trim();

    if (!apiKey || !apiHost || !facebookApiKey || !facebookApiHost
            || !instagramApiKey || !instagramApiHost) {
        setStatus(els.configStatus, "All API keys and hosts are required.", "error");
        return;
    }
    if (!isHttpsUrl(endpointUrl)) {
        setStatus(els.configStatus, "TikTok endpoint_url must be a full https:// URL.", "error");
        return;
    }
    if (!isHttpsUrl(facebookEndpointUrl)) {
        setStatus(els.configStatus, "Facebook fb_endpoint_url must be a full https:// URL.", "error");
        return;
    }
    if (!isHttpsUrl(instagramEndpointUrl)) {
        setStatus(els.configStatus, "Instagram instagram_endpoint_url must be a full https:// URL.", "error");
        return;
    }

    setBusy(els.configSave, true, "Saving...");
    try {
        await update(ref(db, CONFIG_PATH), {
            api_key: apiKey,
            api_host: apiHost,
            endpoint_url: endpointUrl,
            fb_api_key: facebookApiKey,
            fb_api_host: facebookApiHost,
            fb_endpoint_url: facebookEndpointUrl,
            instagram_api_key: instagramApiKey,
            instagram_api_host: instagramApiHost,
            instagram_endpoint_url: instagramEndpointUrl,
        });
        setStatus(els.configStatus, "All platform settings saved.", "success");
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

document.addEventListener("DOMContentLoaded", () => {
    setupAccordions();
    if (initFirebase()) {
        loadAll();
    }
});
