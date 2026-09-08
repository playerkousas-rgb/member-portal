/*
 * Browser-side anonymous Web Push lifecycle for member-portal.
 * Shares VAPID keys and Supabase subscription table with scout-circulars.
 *
 * No PII collected — only a random client token and the browser's
 * PushSubscription (endpoint + encryption keys) together with
 * controlled catalog IDs.
 */
(function (global) {
  'use strict';

  var PREF_KEY = 'scl_push_preferences_v1';
  var TOKEN_KEY = 'scl_push_client_token_v1';
  var ENABLED_KEY = 'scl_push_enabled_v1';

  function safeStorageGet(key) {
    try { return global.localStorage.getItem(key); } catch (_) { return null; }
  }
  function safeStorageSet(key, value) {
    try { global.localStorage.setItem(key, value); return true; } catch (_) { return false; }
  }
  function safeStorageRemove(key) {
    try { global.localStorage.removeItem(key); } catch (_) {}
  }
  function uniqueStrings(values) {
    if (!Array.isArray(values)) return [];
    var seen = {};
    var out = [];
    for (var i = 0; i < values.length; i++) {
      if (typeof values[i] === 'string' && values[i].length > 0 && !seen[values[i]]) {
        seen[values[i]] = true;
        out.push(values[i]);
      }
    }
    return out;
  }

  function loadPreferences() {
    try {
      var raw = safeStorageGet(PREF_KEY);
      var value = raw ? JSON.parse(raw) : null;
      if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
      return {
        branches: uniqueStrings(value.branches),
        topics: uniqueStrings(value.topics),
        catalogVersion: typeof value.catalogVersion === 'string' ? value.catalogVersion : '',
        savedAt: typeof value.savedAt === 'string' ? value.savedAt : '',
      };
    } catch (_) { return null; }
  }

  function savePreferences(preferences) {
    var value = {
      branches: uniqueStrings(preferences && preferences.branches),
      topics: uniqueStrings(preferences && preferences.topics),
      catalogVersion: String((preferences && preferences.catalogVersion) || ''),
      savedAt: new Date().toISOString(),
    };
    if (!safeStorageSet(PREF_KEY, JSON.stringify(value))) {
      throw new Error('瀏覽器無法儲存本機設定；請關閉無痕模式或容許網站儲存資料。');
    }
    return value;
  }

  function installationStatus() {
    var nav = global.navigator || {};
    var ios = /iPad|iPhone|iPod/.test(nav.userAgent || '')
      || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1);
    var standalone = Boolean(nav.standalone || (global.matchMedia && global.matchMedia('(display-mode: standalone)').matches));
    return { standalone: standalone, needsHomeScreen: ios && !standalone };
  }

  function isSupported() {
    var s = installationStatus();
    return Boolean(
      !s.needsHomeScreen
      && global.isSecureContext
      && global.navigator
      && global.navigator.serviceWorker
      && global.PushManager
      && global.Notification
      && global.crypto
      && global.crypto.getRandomValues
    );
  }

  function base64UrlToUint8Array(value) {
    var normalised = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    var padded = normalised + '='.repeat((4 - normalised.length % 4) % 4);
    var raw;
    try { raw = global.atob(padded); } catch (_) { throw new Error('通知公開金鑰格式無效。'); }
    var arr = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  function randomToken() {
    var bytes = new Uint8Array(32);
    global.crypto.getRandomValues(bytes);
    var binary = '';
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return global.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function clientToken() {
    var token = safeStorageGet(TOKEN_KEY);
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(token || '')) {
      token = randomToken();
      if (!safeStorageSet(TOKEN_KEY, token)) {
        throw new Error('瀏覽器無法建立本機通知識別碼。');
      }
    }
    return token;
  }

  function responseJson(response) {
    try { return response.json(); } catch (_) { return {}; }
  }

  function fetchConfig() {
    return global.fetch('/api/push-config', {
      method: 'GET', credentials: 'same-origin', cache: 'no-store',
      headers: { Accept: 'application/json' },
    }).then(function (response) {
      return responseJson(response).then(function (body) {
        if (!response.ok || !body || !body.enabled || typeof body.vapidPublicKey !== 'string') {
          throw new Error((body && body.message) || '通知服務尚未完成設定。');
        }
        return body;
      });
    }).catch(function (err) {
      if (err && err.message) throw err;
      throw new Error('無法連接通知服務，請稍後再試。');
    });
  }

  function postSubscription(payload) {
    return global.fetch('/api/push-subscriptions', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    }).then(function (response) {
      return responseJson(response).then(function (body) {
        if (!response.ok || !body || !body.ok) {
          throw new Error((body && body.message) || '無法儲存通知設定。');
        }
        return body;
      });
    }).catch(function (err) {
      if (err && err.message) throw err;
      throw new Error('無法儲存通知設定，請稍後再試。');
    });
  }

  function registration() {
    if (!isSupported()) throw new Error('這個瀏覽器或目前的連線不支援網頁通知。');
    return global.navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .catch(function () { throw new Error('無法啟動通知服務程式。'); });
  }

  function serialiseSubscription(subscription) {
    var json = subscription && typeof subscription.toJSON === 'function' ? subscription.toJSON() : null;
    if (!json || !json.endpoint || !json.keys || !json.keys.p256dh || !json.keys.auth) {
      throw new Error('瀏覽器未能提供有效的通知訂閱資料。');
    }
    return { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } };
  }

  function ensureSubscription(reg, publicKey, mayCreate) {
    return reg.pushManager.getSubscription().then(function (subscription) {
      if (!subscription && mayCreate) {
        return reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToUint8Array(publicKey),
        }).catch(function (error) {
          if (error && error.name === 'NotAllowedError') {
            throw new Error('瀏覽器拒絕了通知權限。請在網址列的網站設定中重新允許。');
          }
          throw new Error('未能建立瀏覽器通知訂閱。');
        });
      }
      return subscription;
    });
  }

  function persistSubscription(subscription, preferences) {
    return postSubscription({
      action: 'upsert',
      clientToken: clientToken(),
      subscription: serialiseSubscription(subscription),
      branches: preferences.branches,
      topics: preferences.topics,
    });
  }

  function validatePreferences(preferences) {
    var branches = uniqueStrings(preferences && preferences.branches);
    var topics = uniqueStrings(preferences && preferences.topics);
    if (!branches.length && topics.indexOf('all:new') < 0) throw new Error('請至少選擇一個支部。');
    if (!topics.length) throw new Error('請至少選擇一個關注項目。');
    return { branches: branches, topics: topics };
  }

  function enable(preferences) {
    var saved = savePreferences(validatePreferences(preferences));
    if (installationStatus().needsHomeScreen) {
      throw new Error('請先用 Safari 將本站「加入主畫面」，再從主畫面圖示開啟，才可啟用通知（iOS／iPadOS 16.4 或以上）。');
    }
    if (!isSupported()) throw new Error('這個瀏覽器或目前的連線不支援網頁通知。');
    var permission = global.Notification.permission;
    var proceed = function (perm) {
      if (perm !== 'granted') throw new Error('尚未獲得通知權限；設定已只保存在這個瀏覽器。');
      return fetchConfig().then(function (config) {
        return registration().then(function (reg) {
          return global.navigator.serviceWorker.ready.then(function () {
            return ensureSubscription(reg, config.vapidPublicKey, true).then(function (subscription) {
              return persistSubscription(subscription, saved).then(function () {
                safeStorageSet(ENABLED_KEY, '1');
                return { status: 'enabled', preferences: saved };
              });
            });
          });
        });
      });
    };
    if (permission === 'default') {
      return global.Notification.requestPermission().then(proceed);
    }
    return proceed(permission);
  }

  function sync(preferences, options) {
    var saved = savePreferences(validatePreferences(preferences));
    var allowResubscribe = Boolean(options && options.resubscribe);
    if (!isSupported() || global.Notification.permission !== 'granted') {
      return Promise.resolve({ status: 'saved_local_only', preferences: saved });
    }
    return fetchConfig().then(function (config) {
      return registration().then(function (reg) {
        return ensureSubscription(reg, config.vapidPublicKey, allowResubscribe).then(function (subscription) {
          if (!subscription) return { status: 'saved_local_only', preferences: saved };
          return persistSubscription(subscription, saved).then(function () {
            safeStorageSet(ENABLED_KEY, '1');
            return { status: 'synced', preferences: saved };
          });
        });
      });
    });
  }

  function disable() {
    var sub = null;
    var doDisable = function () {
      var serverError = null;
      if (sub) {
        return postSubscription({
          action: 'delete', clientToken: clientToken(), subscription: serialiseSubscription(sub),
        }).catch(function () { serverError = true; }).then(function () {
          return sub.unsubscribe().catch(function () {});
        }).then(function () {
          safeStorageRemove(ENABLED_KEY);
          safeStorageRemove(TOKEN_KEY);
          if (serverError) throw new Error('此裝置已停止接收通知；伺服器清理會在失效時自動完成。');
          return { status: 'disabled' };
        });
      }
      safeStorageRemove(ENABLED_KEY);
      safeStorageRemove(TOKEN_KEY);
      return Promise.resolve({ status: 'disabled' });
    };
    if (isSupported()) {
      return registration().then(function (reg) {
        return reg.pushManager.getSubscription().then(function (s) { sub = s; });
      }).catch(function () {}).then(doDisable);
    }
    return doDisable();
  }

  function status() {
    var preferences = loadPreferences();
    var inst = installationStatus();
    var result = {
      standalone: inst.standalone,
      needsHomeScreen: inst.needsHomeScreen,
      supported: isSupported(),
      permission: global.Notification ? global.Notification.permission : 'unsupported',
      subscribed: false,
      enabledLocally: safeStorageGet(ENABLED_KEY) === '1',
      preferences: preferences,
    };
    if (result.supported) {
      return registration().then(function (reg) {
        return reg.pushManager.getSubscription().then(function (s) {
          result.subscribed = Boolean(s);
          return result;
        });
      }).catch(function () { return result; });
    }
    return Promise.resolve(result);
  }

  global.MemberPushClient = Object.freeze({
    PREF_KEY: PREF_KEY,
    loadPreferences: loadPreferences,
    savePreferences: savePreferences,
    isSupported: isSupported,
    enable: enable,
    sync: sync,
    disable: disable,
    status: status,
  });
}(window));
