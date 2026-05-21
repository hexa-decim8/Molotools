(function () {
  'use strict';

  function loadImageFromFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();

      reader.onload = function (event) {
        var image = new Image();

        image.onload = function () {
          resolve(image);
        };

        image.onerror = function () {
          reject(new Error('Unable to read image data.'));
        };

        image.src = event.target.result;
      };

      reader.onerror = function () {
        reject(new Error('Unable to read selected file.'));
      };

      reader.readAsDataURL(file);
    });
  }

  function fitDimensions(width, height, maxSize) {
    if (width <= maxSize && height <= maxSize) {
      return { width: width, height: height };
    }

    var ratio = Math.min(maxSize / width, maxSize / height);
    return {
      width: Math.round(width * ratio),
      height: Math.round(height * ratio)
    };
  }

  function cleanColor(value) {
    if (typeof value !== 'string') {
      return '';
    }

    return value.trim();
  }

  function pickColor(value, fallback) {
    var cleaned = cleanColor(value);
    return cleaned || fallback;
  }

  function initWidget(widget) {
    var input = widget.querySelector('.am-photo-input');
    var uploadLabel = widget.querySelector('.am-upload');
    var previewPanel = widget.querySelector('.am-preview-panel');
    var canvas = widget.querySelector('[data-am-canvas]');
    var overlaySelect = widget.querySelector('[data-am-overlay-select]');
    var applyButton = widget.querySelector('[data-am-apply]');
    var downloadButton = widget.querySelector('[data-am-download]');
    var facebookAvatarButton = widget.querySelector('[data-am-fb-avatar]');
    var status = widget.querySelector('[data-am-status]');

    if (!input || !canvas || !overlaySelect || !applyButton || !downloadButton || !status) {
      return;
    }

    var ctx = canvas.getContext('2d');
    var sourceImage = null;
    var config = window.abdulifyMeConfig || {};
    var actions = config.actions && typeof config.actions === 'object' ? config.actions : {};
    var facebook = config.facebook && typeof config.facebook === 'object' ? config.facebook : {};
    var isFacebookEnabled = !!(facebook.enabled && facebook.appId);
    var facebookGraphVersion = String(facebook.graphVersion || 'v25.0');
    var facebookPermissions = String(facebook.permissions || 'pages_show_list,pages_read_engagement,pages_manage_metadata');
    var facebookUserToken = '';
    var facebookPageToken = '';
    var facebookPageId = '';
    var facebookAuthStateKey = 'abdulifyMeFacebookAuthState';
    var facebookTokenStorageKey = 'abdulifyMeFacebookUserToken';
    var facebookPagesStorageKey = 'abdulifyMeFacebookPages';
    var isUploadingFacebookAvatar = false;
    var configColors = config.colors && typeof config.colors === 'object' ? config.colors : {};
    var maxBytes = Number(config.maxBytes || 8 * 1024 * 1024);
    var availableOverlays = Array.isArray(config.overlays) ? config.overlays : [];
    var selectedOverlayId = '';
    var overlayImageCache = {};
    var renderVersion = 0;
    var defaultColors = {
      muted: '#5f6877',
      statusInfo: '#5f6877',
      statusError: '#b3212f',
      placeholderBg: '#f2f6fb',
      placeholderText: '#335f88'
    };

    function readCssVar(styles, name) {
      if (!styles || typeof styles.getPropertyValue !== 'function') {
        return '';
      }

      return cleanColor(styles.getPropertyValue(name));
    }

    function resolveColors() {
      var widgetStyles = window.getComputedStyle(widget);
      var rootStyles = window.getComputedStyle(document.documentElement);

      function pickFromCss(name) {
        return pickColor(readCssVar(widgetStyles, name), readCssVar(rootStyles, name));
      }

      return {
        statusInfo: pickColor(pickFromCss('--am-status-info'), pickColor(configColors.statusInfo, defaultColors.statusInfo)),
        statusError: pickColor(pickFromCss('--am-status-error'), pickColor(configColors.statusError, defaultColors.statusError)),
        placeholderBg: pickColor(pickFromCss('--am-canvas-placeholder-bg'), pickColor(configColors.placeholderBg, defaultColors.placeholderBg)),
        placeholderText: pickColor(pickFromCss('--am-canvas-placeholder-text'), pickColor(configColors.placeholderText, defaultColors.placeholderText))
      };
    }

    function sanitizeOverlays(overlays) {
      return overlays
        .map(function (overlay) {
          if (!overlay || typeof overlay !== 'object') {
            return null;
          }

          var id = typeof overlay.id === 'string' ? overlay.id.trim() : '';
          var label = typeof overlay.label === 'string' ? overlay.label.trim() : '';
          var url = typeof overlay.url === 'string' ? overlay.url.trim() : '';

          if (!id || !label || !url) {
            return null;
          }

          return {
            id: id,
            label: label,
            url: url
          };
        })
        .filter(function (overlay) {
          return !!overlay;
        });
    }

    function findOverlayById(overlayId) {
      for (var i = 0; i < availableOverlays.length; i += 1) {
        if (availableOverlays[i].id === overlayId) {
          return availableOverlays[i];
        }
      }

      return null;
    }

    function getSelectedOverlay() {
      var currentId = (overlaySelect.value || '').trim();
      if (!currentId) {
        return null;
      }

      return findOverlayById(currentId);
    }

    function populateOverlaySelect() {
      var fragment = document.createDocumentFragment();
      var placeholder = document.createElement('option');
      var i;

      availableOverlays = sanitizeOverlays(availableOverlays);
      overlaySelect.innerHTML = '';

      placeholder.value = '';
      placeholder.textContent = 'Select a border';
      fragment.appendChild(placeholder);

      for (i = 0; i < availableOverlays.length; i += 1) {
        var option = document.createElement('option');
        option.value = availableOverlays[i].id;
        option.textContent = availableOverlays[i].label;
        fragment.appendChild(option);
      }

      overlaySelect.appendChild(fragment);

      if (availableOverlays.length > 0) {
        selectedOverlayId = availableOverlays[0].id;
        overlaySelect.value = selectedOverlayId;
        overlaySelect.disabled = false;
      } else {
        selectedOverlayId = '';
        overlaySelect.value = '';
        overlaySelect.disabled = true;
      }
    }

    function loadOverlayImage(url) {
      if (overlayImageCache[url]) {
        return overlayImageCache[url];
      }

      overlayImageCache[url] = new Promise(function (resolve, reject) {
        var image = new Image();
        image.onload = function () {
          resolve(image);
        };
        image.onerror = function () {
          reject(new Error('Could not load selected border image.'));
        };
        image.src = url;
      });

      return overlayImageCache[url];
    }

    function setStatus(message, isError) {
      var colors = resolveColors();
      status.textContent = message;
      status.style.color = isError ? colors.statusError : colors.statusInfo;
    }

    function setControlDisabled(control, disabled) {
      if (control) {
        control.disabled = !!disabled;
      }
    }

    function hasReadyCanvasImage() {
      return !!sourceImage;
    }

    function updateFacebookButtonState() {
      var canUpload = isFacebookEnabled && hasReadyCanvasImage() && !!facebookUserToken && !isUploadingFacebookAvatar;
      setControlDisabled(facebookAvatarButton, !canUpload);
    }

    function clearFacebookAuthState() {
      try {
        window.localStorage.removeItem(facebookAuthStateKey);
      } catch (e) {
        // Ignore storage errors in restricted browser contexts.
      }
    }

    function readFacebookAuthState() {
      try {
        return window.localStorage.getItem(facebookAuthStateKey) || '';
      } catch (e) {
        return '';
      }
    }

    function writeFacebookAuthState(value) {
      try {
        window.localStorage.setItem(facebookAuthStateKey, value);
      } catch (e) {
        // Ignore storage errors in restricted browser contexts.
      }
    }

    function storeFacebookUserToken(value) {
      facebookUserToken = value || '';

      try {
        if (facebookUserToken) {
          window.sessionStorage.setItem(facebookTokenStorageKey, facebookUserToken);
        } else {
          window.sessionStorage.removeItem(facebookTokenStorageKey);
        }
      } catch (e) {
        // Ignore storage errors in restricted browser contexts.
      }
    }

    function readStoredFacebookUserToken() {
      try {
        return window.sessionStorage.getItem(facebookTokenStorageKey) || '';
      } catch (e) {
        return '';
      }
    }

    function storeFacebookPages(pages) {
      try {
        window.sessionStorage.setItem(facebookPagesStorageKey, JSON.stringify(pages || []));
      } catch (e) {
        // Ignore storage errors in restricted browser contexts.
      }
    }

    function readStoredFacebookPages() {
      try {
        var raw = window.sessionStorage.getItem(facebookPagesStorageKey);
        if (!raw) {
          return [];
        }

        var parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }

    function parseFragmentParams(hash) {
      var result = {};
      var raw = typeof hash === 'string' ? hash : '';
      var trimmed = raw.replace(/^#/, '');
      var entries;
      var i;
      var keyValue;

      if (!trimmed) {
        return result;
      }

      entries = trimmed.split('&');
      for (i = 0; i < entries.length; i += 1) {
        if (!entries[i]) {
          continue;
        }

        keyValue = entries[i].split('=');
        result[decodeURIComponent(keyValue[0] || '')] = decodeURIComponent(keyValue[1] || '');
      }

      return result;
    }

    function randomState() {
      return 'amfb_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
    }

    function getRedirectUrl() {
      return window.location.origin + window.location.pathname + window.location.search;
    }

    function buildFacebookLoginUrl(state) {
      var params = new URLSearchParams({
        client_id: String(facebook.appId),
        redirect_uri: getRedirectUrl(),
        response_type: 'token',
        scope: facebookPermissions,
        state: state
      });

      return 'https://www.facebook.com/' + facebookGraphVersion + '/dialog/oauth?' + params.toString();
    }

    function clearFacebookHashFromUrl() {
      if (window.history && typeof window.history.replaceState === 'function') {
        window.history.replaceState(null, document.title, getRedirectUrl());
      }
    }

    function loadFacebookPagesFromGraph(userToken) {
      var accountsUrl;

      if (!userToken) {
        return Promise.resolve([]);
      }

      accountsUrl = 'https://graph.facebook.com/' + facebookGraphVersion + '/me/accounts?fields=id,name,access_token,tasks&access_token=' + encodeURIComponent(userToken);

      return fetch(accountsUrl)
        .then(function (response) {
          return response.json().then(function (json) {
            if (!response.ok) {
              throw new Error((json && json.error && json.error.message) || 'Could not read Facebook Pages.');
            }

            return json;
          });
        })
        .then(function (json) {
          var pages = Array.isArray(json.data) ? json.data : [];
          var manageable = pages.filter(function (page) {
            return page && page.id && page.name && page.access_token;
          });

          storeFacebookPages(manageable);
          return manageable;
        });
    }

    function hydrateFacebookFromHash() {
      var params = parseFragmentParams(window.location.hash || '');
      var expectedState = readFacebookAuthState();
      var token = params.access_token || '';
      var returnedState = params.state || '';

      if (!token) {
        return false;
      }

      if (!expectedState || returnedState !== expectedState) {
        clearFacebookAuthState();
        clearFacebookHashFromUrl();
        setStatus('Facebook login state mismatch. Please connect again.', true);
        return false;
      }

      clearFacebookAuthState();
      clearFacebookHashFromUrl();
      storeFacebookUserToken(token);
      return true;
    }

    function redirectToFacebookLogin() {
      var state;

      if (!isFacebookEnabled) {
        setStatus('Facebook is not configured for this site.', true);
        return;
      }

      state = randomState();
      writeFacebookAuthState(state);
      window.location.assign(buildFacebookLoginUrl(state));
    }

    function selectFirstManageablePage(pages) {
      if (!Array.isArray(pages) || !pages.length) {
        return null;
      }

      for (var i = 0; i < pages.length; i += 1) {
        var page = pages[i];
        if (page && page.id && page.access_token && page.tasks) {
          var hasManageTask = Array.isArray(page.tasks) && page.tasks.indexOf('MANAGE') !== -1;
          if (hasManageTask) {
            return page;
          }
        }
      }

      return pages[0] || null;
    }

    function loadPagesAndUpload() {
      if (!facebookUserToken) {
        setStatus('No Facebook authorization found. Please connect first.', true);
        updateFacebookButtonState();
        return;
      }

      loadFacebookPagesFromGraph(facebookUserToken)
        .then(function (pages) {
          var selectedPage = selectFirstManageablePage(pages);
          if (!selectedPage) {
            throw new Error('No manageable Facebook Pages found. Please ensure your account has at least one page to manage.');
          }

          facebookPageId = selectedPage.id || '';
          facebookPageToken = selectedPage.access_token || '';
          return uploadImageToFacebook();
        })
        .catch(function (error) {
          setStatus(error.message || 'Could not complete Facebook upload.', true);
          isUploadingFacebookAvatar = false;
          updateFacebookButtonState();
        });
    }

    function handleFacebookAvatarClick() {
      if (!isFacebookEnabled || !hasReadyCanvasImage()) {
        return;
      }

      if (!facebookUserToken) {
        redirectToFacebookLogin();
        return;
      }

      loadPagesAndUpload();
    }

    function uploadImageToFacebook() {
      var imageData;
      var payload;
      var effectsData;

      if (!facebookPageId || !facebookPageToken) {
        throw new Error('Page information not available. Please try again.');
      }

      if (!config.ajaxUrl || !actions.setFacebookAvatar || !config.facebookAvatarNonce) {
        throw new Error('Facebook upload endpoint is not configured.');
      }

      imageData = canvas.toDataURL('image/png');
      isUploadingFacebookAvatar = true;
      updateFacebookButtonState();
      setStatus('Uploading image to Facebook...', false);

      effectsData = {
        overlay: selectedOverlayId || ''
      };

      payload = new URLSearchParams();
      payload.set('action', actions.setFacebookAvatar);
      payload.set('nonce', String(config.facebookAvatarNonce));
      payload.set('pageId', facebookPageId);
      payload.set('pageAccessToken', facebookPageToken);
      payload.set('imageData', imageData);
      payload.set('effectsUsed', JSON.stringify(effectsData));

      return fetch(String(config.ajaxUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        body: payload.toString()
      })
        .then(function (response) {
          return response.json().then(function (json) {
            if (!response.ok || !json || !json.success) {
              throw new Error((json && json.data && json.data.message) || 'Facebook avatar update failed.');
            }
            return json;
          });
        })
        .then(function (json) {
          setStatus((json.data && json.data.message) || 'Facebook Page avatar updated.', false);
        })
        .catch(function (error) {
          setStatus(error.message || 'Facebook avatar update failed.', true);
          throw error;
        })
        .finally(function () {
          isUploadingFacebookAvatar = false;
          updateFacebookButtonState();
        });
    }

    function initFacebookUi() {
      var fromHash;

      if (!facebookAvatarButton) {
        return;
      }

      if (!isFacebookEnabled) {
        setControlDisabled(facebookAvatarButton, true);
        facebookAvatarButton.title = 'Facebook App ID must be configured in WordPress settings.';
        return;
      }

      fromHash = hydrateFacebookFromHash();
      if (!fromHash) {
        storeFacebookUserToken(readStoredFacebookUserToken());
      }

      facebookAvatarButton.addEventListener('click', handleFacebookAvatarClick);
      updateFacebookButtonState();
    }

    function drawPlaceholder() {
      var colors = resolveColors();
      canvas.width = 1200;
      canvas.height = 1200;
      ctx.fillStyle = colors.placeholderBg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = colors.placeholderText;
      ctx.font = '700 52px Avenir Next, Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Upload a photo to start', canvas.width / 2, canvas.height / 2);
      ctx.textAlign = 'left';
    }

    function drawEffects() {
      if (!sourceImage) {
        return Promise.resolve();
      }

      var currentRender = renderVersion + 1;
      var fitted = fitDimensions(sourceImage.width, sourceImage.height, 1800);
      var colors = resolveColors();
      var selectedOverlay = getSelectedOverlay();

      renderVersion = currentRender;
      selectedOverlayId = selectedOverlay ? selectedOverlay.id : '';

      canvas.width = fitted.width;
      canvas.height = fitted.height;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.filter = 'contrast(1.05) saturate(1.04)';
      ctx.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);
      ctx.filter = 'none';

      if (!selectedOverlay) {
        setStatus('Select an AFS-Social border, then apply.', true);
        downloadButton.disabled = true;
        updateFacebookButtonState();
        return Promise.resolve();
      }

      return loadOverlayImage(selectedOverlay.url)
        .then(function (overlayImage) {
          if (currentRender !== renderVersion) {
            return;
          }

          ctx.drawImage(overlayImage, 0, 0, canvas.width, canvas.height);
          downloadButton.disabled = false;
          updateFacebookButtonState();
          setStatus('Border applied. Download is ready.', false);
        })
        .catch(function (error) {
          if (currentRender !== renderVersion) {
            return;
          }

          downloadButton.disabled = true;
          updateFacebookButtonState();
          setStatus(error.message || 'Could not apply selected border.', true);
        });
    }

    function processFile(file) {
      if (!file) {
        return;
      }

      if (!/^image\/(png|jpeg|jpg|webp)$/i.test(file.type)) {
        setStatus('Please choose a PNG, JPG, or WEBP image.', true);
        return;
      }

      if (file.size > maxBytes) {
        setStatus('That file is too large. Please use an image under 8 MB.', true);
        return;
      }

      setStatus('Loading image...', false);

      loadImageFromFile(file)
        .then(function (image) {
          sourceImage = image;
          applyButton.disabled = overlaySelect.disabled;
          downloadButton.disabled = true;
          return drawEffects();
        })
        .catch(function (error) {
          setStatus(error.message || 'Could not load the image.', true);
        });
    }

    function handleFileSelect() {
      processFile(input.files && input.files[0]);
    }

    function handleDownload() {
      if (!sourceImage) {
        return;
      }

      var url = canvas.toDataURL('image/png');
      var link = document.createElement('a');
      link.href = url;
      link.download = 'abdulified-photo.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setStatus('Download started.', false);
    }

    input.addEventListener('change', handleFileSelect);
    applyButton.addEventListener('click', drawEffects);
    downloadButton.addEventListener('click', handleDownload);
    overlaySelect.addEventListener('change', function () {
      selectedOverlayId = (overlaySelect.value || '').trim();
      if (sourceImage) {
        drawEffects();
      }
    });
    initFacebookUi();

    function addDropZone(element, dragoverClass) {
      element.addEventListener('dragenter', function (event) {
        event.preventDefault();
        element.classList.add(dragoverClass);
      });

      element.addEventListener('dragover', function (event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        element.classList.add(dragoverClass);
      });

      element.addEventListener('dragleave', function (event) {
        if (!element.contains(event.relatedTarget)) {
          element.classList.remove(dragoverClass);
        }
      });

      element.addEventListener('drop', function (event) {
        event.preventDefault();
        element.classList.remove(dragoverClass);
        var file = event.dataTransfer.files && event.dataTransfer.files[0];
        processFile(file);
      });
    }

    if (uploadLabel) {
      addDropZone(uploadLabel, 'am-upload--dragover');
    }

    if (previewPanel) {
      addDropZone(previewPanel, 'am-preview-panel--dragover');
    }

    populateOverlaySelect();
    applyButton.disabled = overlaySelect.disabled;

    drawPlaceholder();
    if (overlaySelect.disabled) {
      setStatus('No AFS-Social borders were found in this plugin install.', true);
    }
    updateFacebookButtonState();
  }

  function init() {
    var widgets = document.querySelectorAll('[data-am-widget]');

    for (var i = 0; i < widgets.length; i += 1) {
      initWidget(widgets[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
