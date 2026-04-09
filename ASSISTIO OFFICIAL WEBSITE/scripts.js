(function () {
  "use strict";

  const config = window.ASSISTIO_SITE_CONFIG || {};
  const COMPANY = config.company || {};
  const CONTACTS = Array.isArray(config.contacts) ? config.contacts : [];
  const SOCIAL_LINKS = Array.isArray(config.socialLinks) ? config.socialLinks : [];
  const CHATWOOT = config.chatwoot || {};
  const BOOKING_URL = config.bookingUrl || "https://calendar.app.google/mF4N138gHQZpTKqc6";
  const CONTACT_FORM_ENDPOINT = config.contactFormEndpoint || "";
  const LOCALE_VERSION = config.localeVersion || "2026-04-07";
  const LOCALE_PATHS = Object.assign(
    {
      en: "./locales/en.json",
      ro: "./locales/ro.json",
      ar: "./locales/ar.json"
    },
    config.localePaths || {}
  );
  const THEME_STORAGE_KEY = "assistio_theme";
  const LANG_STORAGE_KEY = "assistio_lang";
  const NAV_BREAKPOINT = 1180;
  const THEME_COLORS = {
    light: "#eff5ff",
    dark: "#08111f"
  };
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const doc = document.documentElement;
  const body = document.body;
  const page = body.getAttribute("data-page") || "home";
  const header = document.querySelector("[data-header]");
  const navToggle = document.querySelector("[data-nav-toggle]");
  const navPanel = document.querySelector("[data-nav-panel]");
  const navOverlay = document.querySelector("[data-nav-overlay]");
  const navLinks = Array.from(document.querySelectorAll("[data-nav-link]"));
  const navPanelLinks = Array.from(document.querySelectorAll(".nav-panel a"));
  const langButtons = Array.from(document.querySelectorAll(".lang-button"));
  const themeToggles = Array.from(document.querySelectorAll("[data-theme-toggle]"));
  const chatLaunchers = Array.from(document.querySelectorAll("[data-chat-launcher]"));
  const revealElements = Array.from(document.querySelectorAll("[data-reveal]"));
  const sectionElements = Array.from(document.querySelectorAll("[data-section]"));
  const bookingLinks = Array.from(document.querySelectorAll("[data-booking-link]"));
  const form = document.querySelector("[data-contact-form]");
  const formStatus = document.querySelector("[data-form-status]");
  const formSubmit = document.querySelector("[data-form-submit]");
  const contactList = document.querySelector("[data-contact-list]");
  const socialLinkContainers = Array.from(document.querySelectorAll("[data-social-links]"));
  const exampleButtons = Array.from(document.querySelectorAll("[data-example-tab]"));
  const exampleTargets = {
    user: document.querySelector('[data-example="user"]'),
    assistant: document.querySelector('[data-example="assistant"]'),
    capture: document.querySelector('[data-example="capture"]'),
    next: document.querySelector('[data-example="next"]'),
    step1: document.querySelector('[data-example="step1"]'),
    step2: document.querySelector('[data-example="step2"]'),
    step3: document.querySelector('[data-example="step3"]')
  };
  const i18nTextElements = Array.from(document.querySelectorAll("[data-i18n]"));
  const i18nPlaceholderElements = Array.from(document.querySelectorAll("[data-i18n-placeholder]"));
  const i18nContentElements = Array.from(document.querySelectorAll("[data-i18n-content]"));
  const i18nAriaElements = Array.from(document.querySelectorAll("[data-i18n-aria-label]"));
  const formDirectionFields = Array.from(document.querySelectorAll("input, textarea, select"));
  const companyTextElements = Array.from(document.querySelectorAll("[data-company-text]"));
  const companyLinkElements = Array.from(document.querySelectorAll("[data-company-link]"));
  const yearElements = Array.from(document.querySelectorAll("[data-year]"));
  const stateManagedLinks = Array.from(document.querySelectorAll("a[href]")).filter((link) => {
    return link instanceof HTMLAnchorElement && !link.hasAttribute("data-booking-link");
  });
  const hashLinks = Array.from(document.querySelectorAll('a[href^="#"]'));
  const documentTitleTarget = document.querySelector("[data-i18n-document-title]");

  const localeCache = new Map();
  const localePromiseCache = new Map();
  const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(",");
  let activeTheme = normalizeTheme(readQueryParam("theme") || readStored(THEME_STORAGE_KEY) || doc.getAttribute("data-theme"));
  let activeLang = normalizeLang(readQueryParam("lang") || readStored(LANG_STORAGE_KEY) || doc.lang || "en");
  let activeLocale = {};
  let activeExample = "whatsapp";
  let localeRequestId = 0;
  let chatwootPromise = null;
  let chatwootReady = false;
  let chatwootBooted = false;
  let lastNavFocusedElement = null;
  let lastStateUrl = "";
  let lastLinkStateSignature = "";
  let headerScrollFrame = 0;

  function readStored(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function writeStored(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
    }
  }

  function readQueryParam(key) {
    try {
      const url = new URL(window.location.href);
      return url.searchParams.get(key);
    } catch (error) {
      return null;
    }
  }

  function normalizeTheme(value) {
    return value === "dark" ? "dark" : "light";
  }

  function normalizeLang(value) {
    return ["en", "ro", "ar"].includes(value) ? value : "en";
  }

  function localeStorageKey(lang) {
    return "assistio_locale_" + LOCALE_VERSION + "_" + lang;
  }

  function parseCachedLocale(value) {
    if (!value) return null;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  function lookup(source, key) {
    if (!source || !key) return undefined;
    return key.split(".").reduce((acc, part) => {
      if (acc && Object.prototype.hasOwnProperty.call(acc, part)) {
        return acc[part];
      }
      return undefined;
    }, source);
  }

  function getCompanyValue(key) {
    const value = COMPANY[key];
    if (!value) return "";
    if (typeof value === "object" && !Array.isArray(value)) {
      return value[activeLang] || value.en || "";
    }
    return String(value);
  }

  function translate(key, fallback) {
    const value = lookup(activeLocale, key);
    if (value === undefined || value === null || value === "") {
      return fallback || "";
    }
    return String(value);
  }

  function rememberDefault(el, datasetKey, value) {
    if (!el.dataset[datasetKey]) {
      el.dataset[datasetKey] = value;
    }
    return el.dataset[datasetKey];
  }

  function appendVersion(url) {
    return url + (url.indexOf("?") >= 0 ? "&" : "?") + "v=" + encodeURIComponent(LOCALE_VERSION);
  }

  function buildLocaleCandidates(lang) {
    const configuredPath = LOCALE_PATHS[lang] || ("./locales/" + lang + ".json");
    const candidates = [configuredPath, "./locales/" + lang + ".json", "/locales/" + lang + ".json"];

    return Array.from(new Set(candidates.map((candidate) => {
      try {
        return new URL(candidate, window.location.href).toString();
      } catch (error) {
        return candidate;
      }
    })));
  }

  async function fetchLocale(lang) {
    const candidates = buildLocaleCandidates(lang);
    let lastError = new Error("Unable to load locale");

    for (const candidate of candidates) {
      try {
        const response = await fetch(appendVersion(candidate), {
          cache: "default",
          credentials: "same-origin"
        });

        if (!response.ok) {
          throw new Error("Unable to load locale");
        }

        return await response.json();
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError;
  }

  async function loadLocale(lang) {
    if (lang === "en") {
      return {};
    }

    if (localeCache.has(lang)) {
      return localeCache.get(lang);
    }

    if (localePromiseCache.has(lang)) {
      return localePromiseCache.get(lang);
    }

    const embeddedLocale = config.embeddedLocales && config.embeddedLocales[lang];
    if (embeddedLocale && typeof embeddedLocale === "object") {
      localeCache.set(lang, embeddedLocale);
      return embeddedLocale;
    }

    const cachedLocale = parseCachedLocale(readStored(localeStorageKey(lang)));

    const localePromise = fetchLocale(lang)
      .then((locale) => {
        localeCache.set(lang, locale);
        writeStored(localeStorageKey(lang), JSON.stringify(locale));
        return locale;
      })
      .catch((error) => {
        if (cachedLocale) {
          localeCache.set(lang, cachedLocale);
          return cachedLocale;
        }
        throw error;
      })
      .finally(() => {
        localePromiseCache.delete(lang);
      });
    localePromiseCache.set(lang, localePromise);
    return localePromise;
  }

  function applyThemeMeta() {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", THEME_COLORS[activeTheme]);
    }
  }

  function applyTheme() {
    doc.setAttribute("data-theme", activeTheme);
    doc.style.colorScheme = activeTheme;
    applyThemeMeta();
  }

  function applyLanguageAttributes(lang) {
    doc.lang = lang;
    doc.dir = lang === "ar" ? "rtl" : "ltr";
    body.setAttribute("data-lang", lang);
  }

  function isSameOriginUrl(url) {
    return url.protocol === window.location.protocol && url.host === window.location.host;
  }

  function isStateManagedPath(pathname) {
    return /(?:^|\/)(?:index|privacy|terms)\.html$/i.test(pathname || "") || pathname === "/" || /\/$/.test(pathname || "");
  }

  function buildStatefulHref(rawHref) {
    if (!rawHref || rawHref === "#" || rawHref.charAt(0) === "#") {
      return rawHref;
    }

    if (/^(mailto:|tel:|javascript:)/i.test(rawHref)) {
      return rawHref;
    }

    let url;
    try {
      url = new URL(rawHref, window.location.href);
    } catch (error) {
      return rawHref;
    }

    if (!isSameOriginUrl(url) || !isStateManagedPath(url.pathname)) {
      return rawHref;
    }

    url.searchParams.delete("lang");
    url.searchParams.delete("theme");
    return url.toString();
  }

  function updateUrlState() {
    let currentUrl;
    try {
      currentUrl = new URL(window.location.href);
    } catch (error) {
      return;
    }

    currentUrl.searchParams.delete("lang");
    currentUrl.searchParams.delete("theme");

    const nextStateUrl = currentUrl.toString();
    if (nextStateUrl === lastStateUrl) {
      return;
    }

    try {
      window.history.replaceState(null, "", nextStateUrl);
      lastStateUrl = nextStateUrl;
    } catch (error) {
    }
  }

  function syncInternalStateLinks() {
    const signature = activeLang + "|" + activeTheme;
    if (signature === lastLinkStateSignature) {
      return;
    }

    stateManagedLinks.forEach((link) => {
      const baseHref = rememberDefault(link, "baseHref", link.getAttribute("href") || "");
      const nextHref = buildStatefulHref(baseHref);
      if (nextHref) {
        link.setAttribute("href", nextHref);
      }
    });
    lastLinkStateSignature = signature;
  }

  function finishBoot() {
    if (window.__assistioBootTimeout) {
      window.clearTimeout(window.__assistioBootTimeout);
      window.__assistioBootTimeout = null;
    }
    doc.classList.remove("site-booting");
  }

  function updateThemeButtons() {
    const currentLabel = translate(
      activeTheme === "dark" ? "ui.themeDark" : "ui.themeLight",
      activeTheme === "dark" ? "Dark" : "Light"
    );
    const nextLabel = translate(
      activeTheme === "dark" ? "ui.themeToggleToLight" : "ui.themeToggleToDark",
      activeTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"
    );

    themeToggles.forEach((button) => {
      button.setAttribute("aria-label", nextLabel);
      const label = button.querySelector("[data-theme-label]");
      if (label) {
        label.textContent = currentLabel;
      }
    });
  }

  function setTheme(nextTheme, persist) {
    activeTheme = normalizeTheme(nextTheme);
    applyTheme();
    updateThemeButtons();
    if (persist !== false) {
      writeStored(THEME_STORAGE_KEY, activeTheme);
    }
    updateUrlState();
    syncInternalStateLinks();
    syncChatwootSettings();
  }

  function updateLangButtons() {
    langButtons.forEach((button) => {
      const isActive = button.getAttribute("data-lang") === activeLang;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  function updateNavToggleLabel() {
    if (!navToggle || !navPanel) return;
    const isOpen = navPanel.classList.contains("is-open");
    navToggle.setAttribute("aria-label", translate(isOpen ? "ui.navClose" : "ui.navOpen", isOpen ? "Close menu" : "Open menu"));
  }

  function getFocusableElements(root) {
    if (!root) return [];
    return Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR)).filter((element) => {
      if (!(element instanceof HTMLElement)) return false;
      if (element.hasAttribute("hidden")) return false;
      if (element.getAttribute("aria-hidden") === "true") return false;
      return window.getComputedStyle(element).display !== "none" && window.getComputedStyle(element).visibility !== "hidden";
    });
  }

  function safeFocus(element) {
    if (!(element instanceof HTMLElement)) return;
    try {
      element.focus({ preventScroll: true });
    } catch (error) {
      try {
        element.focus();
      } catch (nestedError) {
      }
    }
  }

  function bindPress(target, handler) {
    if (!target) return;

    let lastTouchTime = 0;
    target.addEventListener("touchend", (event) => {
      lastTouchTime = Date.now();
      event.preventDefault();
      handler(event);
    }, { passive: false });

    target.addEventListener("click", (event) => {
      if (Date.now() - lastTouchTime < 700) {
        return;
      }
      handler(event);
    });
  }

  function isNavOpen() {
    return Boolean(navPanel && navPanel.classList.contains("is-open"));
  }

  function applyTranslations() {
    applyLanguageAttributes(activeLang);

    i18nTextElements.forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const fallback = rememberDefault(el, "defaultText", el.textContent.trim());
      const value = translate(key, fallback);
      if (value) {
        el.textContent = value;
      }
    });

    i18nPlaceholderElements.forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      const fallback = rememberDefault(el, "defaultPlaceholder", el.getAttribute("placeholder") || "");
      const value = translate(key, fallback);
      if (value) {
        el.setAttribute("placeholder", value);
      }
    });

    i18nContentElements.forEach((el) => {
      const key = el.getAttribute("data-i18n-content");
      const fallback = rememberDefault(el, "defaultContent", el.getAttribute("content") || "");
      const value = translate(key, fallback);
      if (value) {
        el.setAttribute("content", value);
      }
    });

    i18nAriaElements.forEach((el) => {
      const key = el.getAttribute("data-i18n-aria-label");
      const fallback = rememberDefault(el, "defaultAria", el.getAttribute("aria-label") || "");
      const value = translate(key, fallback);
      if (value) {
        el.setAttribute("aria-label", value);
      }
    });

    if (documentTitleTarget) {
      const key = documentTitleTarget.getAttribute("data-i18n-document-title");
      document.title = translate(key, documentTitleTarget.textContent.trim());
    }

    formDirectionFields.forEach((field) => {
      field.dir = activeLang === "ar" ? "rtl" : "ltr";
    });
  }

  function applyCompanyDetails() {
    companyTextElements.forEach((el) => {
      const key = el.getAttribute("data-company-text");
      const value = getCompanyValue(key);
      if (value) {
        el.textContent = value;
      }
    });

    companyLinkElements.forEach((el) => {
      const key = el.getAttribute("data-company-link");
      const value = key === "siteUrl" ? (config.siteUrl || "") : getCompanyValue(key);
      if (!value) return;

      if (key === "siteUrl") {
        el.setAttribute("href", value);
        el.textContent = value;
      } else {
        el.setAttribute("href", "mailto:" + value);
        el.textContent = value;
      }
    });
  }

  function getSocialLabel(id) {
    const fallbackLabels = {
      whatsapp: "WhatsApp",
      email: "Email",
      bookDemo: "Book a demo",
      website: "Website",
      linkedin: "LinkedIn",
      instagram: "Instagram",
      facebook: "Facebook",
      x: "X",
      tiktok: "TikTok"
    };
    return translate("footer.socials." + id, fallbackLabels[id] || "Channel");
  }

  function getSocialAriaLabel(id) {
    const fallbackLabels = {
      whatsapp: "Open Assistio on WhatsApp",
      email: "Email Assistio",
      bookDemo: "Book a demo with Assistio",
      website: "Open the Assistio website",
      linkedin: "Open Assistio on LinkedIn",
      instagram: "Open Assistio on Instagram",
      facebook: "Open Assistio on Facebook",
      x: "Open Assistio on X",
      youtube: "Open Assistio on YouTube",
      tiktok: "Open Assistio on TikTok"
    };
    return translate("footer.socialAria." + id, fallbackLabels[id] || "Open channel");
  }

  function getSocialIcon(id) {
    const icons = {
      whatsapp:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2A8.8 8.8 0 0 0 4.4 16.5L3 21l4.7-1.2A8.8 8.8 0 1 0 12 3.2Zm0 15.8c-1.4 0-2.7-.4-3.8-1.1l-.3-.2-2.8.7.8-2.7-.2-.3A6.9 6.9 0 1 1 12 19Zm3.8-5.2-.5-.2c-.3-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.5.6c-.1.2-.3.2-.5.1-.2-.1-.9-.3-1.7-1-.6-.5-1-1.2-1.1-1.4-.1-.2 0-.3.1-.4l.4-.4c.1-.1.2-.2.3-.4.1-.1 0-.3 0-.4l-.7-1.7c-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2.9 2.4c.1.1 1.6 2.5 4 3.4 1.9.7 2.4.5 2.8.5.4-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2-.1-.1-.3-.2-.6-.3Z" fill="currentColor"/></svg>',
      email:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm0 2v.3l8 5.4 8-5.4V7H4Zm16 10V9.7l-7.4 5a1 1 0 0 1-1.2 0L4 9.7V17h16Z" fill="currentColor"/></svg>',
      bookDemo:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 2h2v2h6V2h2v2h3a2 2 0 0 1 2 2v12a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V6a2 2 0 0 1 2-2h3V2Zm13 8H4v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8ZM4 8h16V6H4v2Zm4 4h3v3H8v-3Z" fill="currentColor"/></svg>',
      website:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm5.9 8h-3.1a15.2 15.2 0 0 0-1-5A7.1 7.1 0 0 1 17.9 11Zm-5.9 8c-.6 0-1.8-2-2.1-6h4.2c-.3 4-1.5 6-2.1 6Zm-2.1-8c.3-4 1.5-6 2.1-6s1.8 2 2.1 6H9.9ZM10.2 6A15.2 15.2 0 0 0 9.2 11H6.1A7.1 7.1 0 0 1 10.2 6Zm-4.1 7h3.1a15.2 15.2 0 0 0 1 5A7.1 7.1 0 0 1 6.1 13Zm7.7 5a15.2 15.2 0 0 0 1-5h3.1a7.1 7.1 0 0 1-4.1 5Z" fill="currentColor"/></svg>',
      linkedin:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 8.2A1.7 1.7 0 1 0 6.5 4.8a1.7 1.7 0 0 0 0 3.4ZM5 9.8h3V19H5V9.8Zm4.8 0h2.9v1.3h.1c.4-.8 1.4-1.6 2.9-1.6 3.1 0 3.7 2 3.7 4.6V19h-3v-4.3c0-1 0-2.3-1.4-2.3s-1.6 1.1-1.6 2.2V19h-3V9.8Z" fill="currentColor"/></svg>',
      instagram:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 3h9A4.5 4.5 0 0 1 21 7.5v9a4.5 4.5 0 0 1-4.5 4.5h-9A4.5 4.5 0 0 1 3 16.5v-9A4.5 4.5 0 0 1 7.5 3Zm0 1.8A2.7 2.7 0 0 0 4.8 7.5v9a2.7 2.7 0 0 0 2.7 2.7h9a2.7 2.7 0 0 0 2.7-2.7v-9a2.7 2.7 0 0 0-2.7-2.7h-9Zm9.7 1.3a1.1 1.1 0 1 1 0 2.1 1.1 1.1 0 0 1 0-2.1ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.8A3.2 3.2 0 1 0 12 15.2 3.2 3.2 0 0 0 12 8.8Z" fill="currentColor"/></svg>',
      facebook:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.4 21v-7.6H16l.4-3h-3v-1.9c0-.9.2-1.5 1.5-1.5h1.6V4.3c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.4H8v3h2.6V21h2.8Z" fill="currentColor"/></svg>',
      x:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h4.2l4.1 5.6L17 4H20l-6.3 7.1L20.4 20h-4.2l-4.5-6.1L6.5 20H3.6l6.5-7.4L4 4Zm3 1.8 9.3 12.4h1.1L8.1 5.8H7Z" fill="currentColor"/></svg>',
      youtube:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.1 7.2a2.8 2.8 0 0 0-2-2C17.4 4.7 12 4.7 12 4.7s-5.4 0-7 .5a2.8 2.8 0 0 0-2 2C2.5 8.8 2.5 12 2.5 12s0 3.2.5 4.8a2.8 2.8 0 0 0 2 2c1.6.5 7 .5 7 .5s5.4 0 7-.5a2.8 2.8 0 0 0 2-2c.5-1.6.5-4.8.5-4.8s0-3.2-.5-4.8ZM10.2 15.3V8.7l5.2 3.3-5.2 3.3Z" fill="currentColor"/></svg>',
      tiktok:
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.7 3c.4 1.5 1.3 2.7 2.7 3.4.8.4 1.6.6 2.5.6V10a7 7 0 0 1-3.7-1v5.7a5.7 5.7 0 1 1-4.4-5.6v3c-.4-.2-.8-.2-1.2-.2a2.8 2.8 0 1 0 2.8 2.8V3h3.3Z" fill="currentColor"/></svg>'
    };
    return icons[id] || icons.website;
  }

  function shouldOpenSocialInApp(id) {
    return ["whatsapp", "linkedin", "instagram", "facebook", "x", "youtube", "tiktok"].includes(id);
  }

  function renderSocialLinks() {
    if (!socialLinkContainers.length) return;

    const entries = SOCIAL_LINKS
      .filter((link) => link && typeof link.href === "string" && link.href.trim())
      .map((link) => ({
        id: String(link.id || link.key || "channel"),
        href: String(link.href).trim()
      }));

    socialLinkContainers.forEach((container) => {
      const shell = container.closest("[data-social-shell]");
      container.innerHTML = "";

      if (!entries.length) {
        if (shell) {
          shell.hidden = true;
        }
        return;
      }

      entries.forEach((entry) => {
        const link = document.createElement("a");
        link.className = "social-pill";
        link.dataset.socialId = entry.id;
        link.href = entry.href;
        link.setAttribute("aria-label", getSocialAriaLabel(entry.id));
        link.setAttribute("title", getSocialLabel(entry.id));
        link.innerHTML =
          '<span class="social-icon" aria-hidden="true">' + getSocialIcon(entry.id) + '</span>' +
          '<span class="social-label sr-only"></span>';
        link.querySelector(".social-label").textContent = getSocialLabel(entry.id);

        if (/^https?:\/\//i.test(entry.href)) {
          if (!shouldOpenSocialInApp(entry.id)) {
            link.target = "_blank";
            link.rel = "noopener noreferrer";
          }
        }

        container.appendChild(link);
      });

      if (shell) {
        shell.hidden = false;
      }
    });
  }

  function renderContacts() {
    if (!contactList) return;
    const roleLabel = translate("contact.teamRole", "Co-founder");
    contactList.innerHTML = "";

    CONTACTS.forEach((contact) => {
      const item = document.createElement("article");
      item.className = "team-card";
      item.innerHTML =
        '<strong class="team-name"></strong>' +
        '<span class="team-role"></span>' +
        '<div class="team-links">' +
          '<a class="team-link team-link-phone"></a>' +
          '<a class="team-link team-link-email"></a>' +
        "</div>";
      item.querySelector(".team-name").textContent = contact.name;
      item.querySelector(".team-role").textContent = translate(contact.roleKey || "", roleLabel);
      item.querySelector(".team-link-phone").setAttribute("href", contact.phoneHref);
      item.querySelector(".team-link-phone").textContent = contact.phoneLabel;
      item.querySelector(".team-link-email").setAttribute("href", "mailto:" + contact.email);
      item.querySelector(".team-link-email").textContent = contact.email;
      contactList.appendChild(item);
    });
  }

  function setLanguage(lang, options) {
    const requestId = ++localeRequestId;
    const nextLang = normalizeLang(lang);
    const shouldPersist = !options || options.persist !== false;

    activeLang = nextLang;
    applyLanguageAttributes(activeLang);
    updateLangButtons();
    if (shouldPersist) {
      writeStored(LANG_STORAGE_KEY, activeLang);
    }
    updateUrlState();
    syncInternalStateLinks();
    syncChatwootSettings();

    return loadLocale(nextLang)
      .then((locale) => {
        if (requestId !== localeRequestId) return;
        activeLocale = locale;
        applyTranslations();
        applyCompanyDetails();
        renderSocialLinks();
        renderContacts();
        updateLangButtons();
        updateThemeButtons();
        updateNavToggleLabel();
        applyExample(activeExample);
        syncChatwootSettings();
        updateUrlState();
        syncInternalStateLinks();
      })
      .catch(() => {
        if (requestId !== localeRequestId) return;
        activeLang = "en";
        activeLocale = {};
        applyLanguageAttributes(activeLang);
        applyTranslations();
        applyCompanyDetails();
        renderSocialLinks();
        renderContacts();
        updateLangButtons();
        updateThemeButtons();
        updateNavToggleLabel();
        applyExample(activeExample);
        if (shouldPersist) {
          writeStored(LANG_STORAGE_KEY, activeLang);
        }
        updateUrlState();
        syncInternalStateLinks();
      });
  }

  function getExampleContent(exampleName) {
    return lookup(activeLocale, "examples." + exampleName) || lookup(activeLocale, "examples.whatsapp") || {};
  }

  function applyExample(exampleName) {
    if (!exampleTargets.user) return;
    activeExample = exampleName;
    const content = getExampleContent(exampleName);

    Object.keys(exampleTargets).forEach((key) => {
      if (exampleTargets[key] && content[key]) {
        exampleTargets[key].textContent = content[key];
      }
    });

    exampleButtons.forEach((button) => {
      const isActive = button.getAttribute("data-example-tab") === exampleName;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
  }

  function setHeaderState() {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 10);
  }

  function requestHeaderState() {
    if (headerScrollFrame) return;
    headerScrollFrame = window.requestAnimationFrame(() => {
      headerScrollFrame = 0;
      setHeaderState();
    });
  }

  function getHashTarget(hashValue) {
    if (!hashValue || hashValue === "#") return null;
    const id = hashValue.charAt(0) === "#" ? hashValue.slice(1) : hashValue;
    if (!id) return null;
    return document.getElementById(id);
  }

  function scrollToHashTarget(hashValue, smooth) {
    const target = getHashTarget(hashValue);
    if (!target) return false;

    const prefersSmooth = Boolean(smooth && !prefersReducedMotion.matches);
    target.scrollIntoView({
      behavior: prefersSmooth ? "smooth" : "auto",
      block: "start"
    });
    return true;
  }

  function restoreHashPosition(hashValue, smooth) {
    if (!hashValue) return;
    [0, 180, 560].forEach((delay) => {
      window.setTimeout(() => {
        scrollToHashTarget(hashValue, smooth && delay > 0);
      }, delay);
    });
  }

  function markActiveSection(id) {
    navLinks.forEach((link) => {
      const isActive = link.getAttribute("data-nav-link") === id;
      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  function setupSectionObserver() {
    if (page !== "home" || !sectionElements.length || !("IntersectionObserver" in window)) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible && visible.target.id) {
          markActiveSection(visible.target.id);
        }
      },
      {
        rootMargin: "-38% 0px -44% 0px",
        threshold: [0.2, 0.4, 0.65]
      }
    );

    sectionElements.forEach((section) => observer.observe(section));
  }

  function setupRevealObserver() {
    if (!revealElements.length) return;
    if (prefersReducedMotion.matches || !("IntersectionObserver" in window)) {
      revealElements.forEach((el) => el.classList.add("is-visible"));
      return;
    }

    revealElements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.92) {
        el.classList.add("is-visible");
      }
    });

    const observer = new IntersectionObserver(
      (entries, revealObserver) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        });
      },
      {
        threshold: 0.16
      }
    );

    revealElements.forEach((el) => observer.observe(el));
  }

  function setNavState(isOpen) {
    if (!navPanel || !navToggle) return;
    const shouldOpen = Boolean(isOpen);
    const wasOpen = navPanel.classList.contains("is-open");
    if (shouldOpen === wasOpen) {
      navPanel.setAttribute("aria-hidden", String(!shouldOpen));
      if (navOverlay) {
        navOverlay.hidden = !shouldOpen;
      }
      return;
    }

    if (shouldOpen) {
      lastNavFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }

    navPanel.classList.toggle("is-open", shouldOpen);
    navPanel.setAttribute("aria-hidden", String(!shouldOpen));
    navToggle.setAttribute("aria-expanded", String(shouldOpen));
    if (navOverlay) {
      navOverlay.hidden = !shouldOpen;
    }
    body.classList.toggle("nav-open", shouldOpen);
    updateNavToggleLabel();

    if (shouldOpen) {
      window.requestAnimationFrame(() => {
        const focusables = getFocusableElements(navPanel);
        if (focusables[0]) {
          safeFocus(focusables[0]);
        }
      });
      return;
    }

    if (document.activeElement instanceof HTMLElement && navPanel.contains(document.activeElement)) {
      safeFocus(navToggle);
    } else if (lastNavFocusedElement && lastNavFocusedElement.isConnected && lastNavFocusedElement !== body) {
      safeFocus(lastNavFocusedElement);
    }
  }

  function closeNav() {
    setNavState(false);
  }

  function toggleNav() {
    if (!navPanel) return;
    setNavState(!navPanel.classList.contains("is-open"));
  }

  function syncBookingLinks() {
    bookingLinks.forEach((link) => {
      link.setAttribute("href", BOOKING_URL);
      link.setAttribute("target", "_blank");
      link.setAttribute("rel", "noopener noreferrer");
    });
  }

  function syncChatLaunchers() {
    if (!chatLaunchers.length) return;
    const enabled = isChatwootConfigured();

    chatLaunchers.forEach((button) => {
      const shouldHide = !enabled;
      button.hidden = shouldHide;
      button.setAttribute("aria-hidden", String(shouldHide));
      if (shouldHide) {
        button.setAttribute("disabled", "disabled");
      } else {
        button.removeAttribute("disabled");
      }
    });
  }

  function setFormStatus(message, tone) {
    if (!formStatus) return;
    formStatus.textContent = message || "";
    formStatus.classList.remove("is-success", "is-error", "is-loading");
    if (tone) {
      formStatus.classList.add(tone);
    }
  }

  function initContactForm() {
    if (!form) return;
    if (CONTACT_FORM_ENDPOINT) {
      form.setAttribute("action", CONTACT_FORM_ENDPOINT);
    }

    form.addEventListener("submit", async (event) => {
      if (!CONTACT_FORM_ENDPOINT) {
        return;
      }

      event.preventDefault();
      if (!form.reportValidity()) {
        return;
      }

      const formData = new FormData(form);
      formData.append("_subject", "Assistio website inquiry");

      if (formSubmit) {
        formSubmit.disabled = true;
        formSubmit.setAttribute("aria-busy", "true");
      }
      setFormStatus(translate("contact.form.sending", "Sending request..."), "is-loading");

      try {
        const response = await fetch(CONTACT_FORM_ENDPOINT, {
          method: "POST",
          headers: {
            Accept: "application/json"
          },
          body: formData
        });

        if (!response.ok) {
          throw new Error("Form submission failed");
        }

        form.reset();
        setFormStatus(translate("contact.form.success", "Thanks. We will get back to you shortly."), "is-success");
      } catch (error) {
        setFormStatus(translate("contact.form.error", "We could not send your request right now. Please try again or email us directly."), "is-error");
      } finally {
        if (formSubmit) {
          formSubmit.disabled = false;
          formSubmit.removeAttribute("aria-busy");
        }
      }
    });
  }

  function isChatwootConfigured() {
    return Boolean(CHATWOOT.enabled && CHATWOOT.baseUrl && CHATWOOT.websiteToken);
  }

  function syncChatwootSettings() {
    window.chatwootSettings = {
      hideMessageBubble: CHATWOOT.hideMessageBubble === true,
      showUnreadMessagesDialog: false,
      position: CHATWOOT.position === "left" ? "left" : "right",
      locale: activeLang,
      useBrowserLanguage: false,
      darkMode: activeTheme
    };

    if (chatwootReady && window.$chatwoot && typeof window.$chatwoot.setLocale === "function") {
      try {
        window.$chatwoot.setLocale(activeLang);
      } catch (error) {
      }
    }

    if (chatwootReady && window.$chatwoot && typeof window.$chatwoot.toggleBubbleVisibility === "function") {
      try {
        window.$chatwoot.toggleBubbleVisibility(CHATWOOT.hideMessageBubble === true ? "hide" : "show");
      } catch (error) {
      }
    }
  }

  function loadChatwoot() {
    if (!isChatwootConfigured()) {
      return Promise.reject(new Error("Chatwoot is not configured"));
    }

    if (window.$chatwoot) {
      chatwootReady = true;
      syncChatwootSettings();
      return Promise.resolve(window.$chatwoot);
    }

    if (chatwootPromise) {
      return chatwootPromise;
    }

    syncChatwootSettings();

    chatwootPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector('script[data-chatwoot-sdk="true"]');
      const script = existingScript || document.createElement("script");
      const chatwootBaseUrl = String(CHATWOOT.baseUrl || "").replace(/\/+$/, "");
      const timeout = window.setTimeout(() => reject(new Error("Chatwoot timed out")), 15000);

      function bootSdk() {
        if (!window.chatwootSDK || typeof window.chatwootSDK.run !== "function") {
          return false;
        }

        if (chatwootBooted) {
          return true;
        }

        chatwootBooted = true;
        window.chatwootSDK.run({
          websiteToken: CHATWOOT.websiteToken,
          baseUrl: chatwootBaseUrl
        });
        return true;
      }

      function onReady() {
        window.clearTimeout(timeout);
        chatwootReady = true;
        syncChatwootSettings();
        resolve(window.$chatwoot);
      }

      window.addEventListener("chatwoot:ready", onReady, { once: true });

      script.src = chatwootBaseUrl + "/packs/js/sdk.js";
      script.async = true;
      script.dataset.chatwootSdk = "true";
      script.onload = function () {
        if (bootSdk()) {
          return;
        }
        window.clearTimeout(timeout);
        reject(new Error("Chatwoot SDK unavailable"));
      };
      script.onerror = function () {
        window.clearTimeout(timeout);
        reject(new Error("Unable to load Chatwoot"));
      };

      if (!existingScript) {
        document.head.appendChild(script);
      } else if (bootSdk()) {
        return;
      }
    }).catch((error) => {
      chatwootPromise = null;
      chatwootReady = false;
      chatwootBooted = false;
      throw error;
    });

    return chatwootPromise;
  }

  function prefetchLocales() {
    const runner = () => {
      ["en", "ro", "ar"].forEach((lang, index) => {
        if (lang === activeLang || localeCache.has(lang)) return;
        window.setTimeout(() => {
          loadLocale(lang).catch(() => {});
        }, 500 + (index * 260));
      });
    };

    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(runner, { timeout: 1800 });
      return;
    }

    window.setTimeout(runner, 1200);
  }

  function warmChatwoot() {
    if (!isChatwootConfigured()) return;

    const runner = () => {
      loadChatwoot().catch(() => {});
    };

    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(runner, { timeout: 2200 });
      return;
    }

    window.setTimeout(runner, 1200);
  }

  applyTheme();
  body.classList.add("js-enhanced");
  syncBookingLinks();
  setHeaderState();
  setupRevealObserver();
  setupSectionObserver();
  initContactForm();
  applyExample(activeExample);
  applyCompanyDetails();
  renderSocialLinks();
  renderContacts();
  syncChatLaunchers();
  syncInternalStateLinks();
  updateUrlState();
  warmChatwoot();

  yearElements.forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });

  setLanguage(activeLang, { persist: false }).finally(() => {
    prefetchLocales();
    syncInternalStateLinks();
    updateUrlState();
    finishBoot();
    if (page === "home" && window.location.hash) {
      window.requestAnimationFrame(() => {
        restoreHashPosition(window.location.hash, false);
      });
    }
  });

  themeToggles.forEach((button) => {
    bindPress(button, () => {
      setTheme(activeTheme === "dark" ? "light" : "dark");
    });
  });

  langButtons.forEach((button) => {
    bindPress(button, () => {
      const nextLang = button.getAttribute("data-lang") || "en";
      if (nextLang !== activeLang) {
        setLanguage(nextLang);
      }
    });
  });

  exampleButtons.forEach((button) => {
    bindPress(button, () => {
      applyExample(button.getAttribute("data-example-tab") || "whatsapp");
    });
  });

  if (navToggle) {
    bindPress(navToggle, toggleNav);
  }

  if (navOverlay) {
    bindPress(navOverlay, closeNav);
  }

  navPanelLinks.forEach((link) => {
    link.addEventListener("click", () => {
      const href = link.getAttribute("href") || "";
      const hashIndex = href.indexOf("#");
      const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";

      if (window.innerWidth <= NAV_BREAKPOINT) {
        closeNav();
      }

      if (page === "home" && hash) {
        window.setTimeout(() => {
          restoreHashPosition(hash, true);
        }, 60);
      }
    });
  });

  hashLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href") || "";
      if (!href || href === "#") return;
      const target = getHashTarget(href);
      if (!target) return;

      event.preventDefault();
      if (window.location.hash !== href) {
        history.pushState(null, "", href);
      }
      restoreHashPosition(href, true);
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeNav();
      return;
    }

    if (event.key === "Tab" && isNavOpen() && navPanel) {
      const focusables = getFocusableElements(navPanel);
      if (!focusables.length) {
        event.preventDefault();
        safeFocus(navToggle);
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        safeFocus(last);
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        safeFocus(first);
      }
    }
  });

  chatLaunchers.forEach((button) => {
    bindPress(button, () => {
      if (!isChatwootConfigured()) return;
      loadChatwoot()
        .then(() => {
          if (window.$chatwoot && typeof window.$chatwoot.toggle === "function") {
            window.$chatwoot.toggle("open");
          }
        })
        .catch(() => {});
    });
  });

  window.addEventListener("scroll", requestHeaderState, { passive: true });
  window.addEventListener("resize", () => {
    if (window.innerWidth > NAV_BREAKPOINT) {
      closeNav();
    }
  }, { passive: true });
  window.addEventListener("orientationchange", closeNav);

  document.addEventListener("DOMContentLoaded", finishBoot, { once: true });

  window.addEventListener("hashchange", () => {
    if (page === "home" && window.location.hash) {
      restoreHashPosition(window.location.hash, true);
    }
  });

  window.addEventListener("load", () => {
    finishBoot();
    if (page === "home" && window.location.hash) {
      restoreHashPosition(window.location.hash, false);
    }
  });

  if (typeof prefersDark.addEventListener === "function") {
    prefersDark.addEventListener("change", (event) => {
      if (!readStored(THEME_STORAGE_KEY)) {
        setTheme(event.matches ? "dark" : "light", false);
      }
    });
  }
})();
