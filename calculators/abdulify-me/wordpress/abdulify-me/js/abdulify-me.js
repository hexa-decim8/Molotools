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

  function parseColorChannels(color) {
    var value = cleanColor(color);
    var hexMatch;
    var rgbMatch;
    var parts;

    if (!value) {
      return null;
    }

    hexMatch = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
    if (hexMatch) {
      var hex = hexMatch[1];
      if (hex.length === 3) {
        hex = hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2);
      }

      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16)
      };
    }

    rgbMatch = /^rgba?\(([^)]+)\)$/i.exec(value);
    if (rgbMatch) {
      parts = rgbMatch[1].split(',');
      if (parts.length < 3) {
        return null;
      }

      return {
        r: Math.max(0, Math.min(255, parseInt(parts[0], 10) || 0)),
        g: Math.max(0, Math.min(255, parseInt(parts[1], 10) || 0)),
        b: Math.max(0, Math.min(255, parseInt(parts[2], 10) || 0))
      };
    }

    return null;
  }

  function withAlpha(color, alpha, fallback) {
    var channels = parseColorChannels(color);
    if (!channels) {
      return fallback;
    }

    return 'rgba(' + channels.r + ', ' + channels.g + ', ' + channels.b + ', ' + alpha + ')';
  }

  function initWidget(widget) {
    var input = widget.querySelector('.am-photo-input');
    var canvas = widget.querySelector('[data-am-canvas]');
    var applyButton = widget.querySelector('[data-am-apply]');
    var downloadButton = widget.querySelector('[data-am-download]');
    var status = widget.querySelector('[data-am-status]');
    var toggles = widget.querySelectorAll('[data-am-effect]');

    if (!input || !canvas || !applyButton || !downloadButton || !status) {
      return;
    }

    var ctx = canvas.getContext('2d');
    var sourceImage = null;
    var config = window.abdulifyMeConfig || {};
    var configColors = config.colors && typeof config.colors === 'object' ? config.colors : {};
    var maxBytes = Number(config.maxBytes || 8 * 1024 * 1024);
    var overlayText = String(config.overlayText || 'I Support Abdul El-Sayed');
    var badgeText = String(config.badgeText || 'Abdul 2026');
    var defaultColors = {
      primary: '#0f4f78',
      primaryStrong: '#0b3957',
      accent: '#f0a33b',
      muted: '#5f6877',
      statusInfo: '#5f6877',
      statusError: '#b3212f',
      placeholderBg: '#f2f6fb',
      placeholderText: '#335f88',
      tint: '#175f8c',
      ribbon: '',
      ribbonText: '#ffffff',
      badgeStroke: '#0b3957',
      badgeText: '#0b3957'
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
        primary: pickColor(pickFromCss('--am-primary'), pickColor(configColors.primary, defaultColors.primary)),
        primaryStrong: pickColor(pickFromCss('--am-primary-strong'), pickColor(configColors.primaryStrong, defaultColors.primaryStrong)),
        accent: pickColor(pickFromCss('--am-accent'), pickColor(configColors.accent, defaultColors.accent)),
        muted: pickColor(pickFromCss('--am-muted'), pickColor(configColors.muted, defaultColors.muted)),
        statusInfo: pickColor(pickFromCss('--am-status-info'), pickColor(configColors.statusInfo, defaultColors.statusInfo)),
        statusError: pickColor(pickFromCss('--am-status-error'), pickColor(configColors.statusError, defaultColors.statusError)),
        placeholderBg: pickColor(pickFromCss('--am-canvas-placeholder-bg'), pickColor(configColors.placeholderBg, defaultColors.placeholderBg)),
        placeholderText: pickColor(pickFromCss('--am-canvas-placeholder-text'), pickColor(configColors.placeholderText, defaultColors.placeholderText)),
        tint: pickColor(pickFromCss('--am-tint'), pickColor(configColors.tint, pickColor(config.tintColor, defaultColors.tint))),
        ribbon: pickColor(pickFromCss('--am-ribbon'), pickColor(configColors.ribbon, defaultColors.ribbon)),
        ribbonText: pickColor(pickFromCss('--am-ribbon-contrast'), pickColor(configColors.ribbonText, defaultColors.ribbonText)),
        badgeStroke: pickColor(pickFromCss('--am-badge-stroke'), pickColor(configColors.badgeStroke, defaultColors.badgeStroke)),
        badgeText: pickColor(pickFromCss('--am-badge-text'), pickColor(configColors.badgeText, defaultColors.badgeText))
      };
    }

    function getEffectState() {
      return {
        frame: widget.querySelector('[data-am-effect="frame"]').checked,
        text: widget.querySelector('[data-am-effect="text"]').checked,
        tint: widget.querySelector('[data-am-effect="tint"]').checked,
        badge: widget.querySelector('[data-am-effect="badge"]').checked
      };
    }

    function setStatus(message, isError) {
      var colors = resolveColors();
      status.textContent = message;
      status.style.color = isError ? colors.statusError : colors.statusInfo;
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
        return;
      }

      var fitted = fitDimensions(sourceImage.width, sourceImage.height, 1800);
      var effects = getEffectState();
      var colors = resolveColors();

      canvas.width = fitted.width;
      canvas.height = fitted.height;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.filter = 'contrast(1.05) saturate(1.04)';
      ctx.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);
      ctx.filter = 'none';

      if (effects.tint) {
        ctx.fillStyle = withAlpha(colors.tint, 0.13, 'rgba(23, 95, 140, 0.13)');
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      if (effects.frame) {
        var frame = Math.max(12, Math.round(canvas.width * 0.018));
        ctx.strokeStyle = colors.primary;
        ctx.lineWidth = frame;
        ctx.strokeRect(frame / 2, frame / 2, canvas.width - frame, canvas.height - frame);
      }

      if (effects.text) {
        var ribbonHeight = Math.max(72, Math.round(canvas.height * 0.12));
        ctx.fillStyle = colors.ribbon || withAlpha(colors.primary, 0.9, 'rgba(15, 79, 120, 0.9)');
        ctx.fillRect(0, canvas.height - ribbonHeight, canvas.width, ribbonHeight);
        ctx.fillStyle = colors.ribbonText;
        ctx.font = '700 ' + Math.max(24, Math.round(canvas.width * 0.038)) + 'px Avenir Next, Segoe UI, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(overlayText, canvas.width / 2, canvas.height - ribbonHeight / 2);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }

      if (effects.badge) {
        var radius = Math.max(54, Math.round(canvas.width * 0.09));
        var cx = canvas.width - radius - 24;
        var cy = radius + 24;

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = colors.accent;
        ctx.fill();

        ctx.strokeStyle = colors.badgeStroke;
        ctx.lineWidth = Math.max(4, Math.round(radius * 0.08));
        ctx.stroke();

        ctx.fillStyle = colors.badgeText;
        ctx.font = '700 ' + Math.max(16, Math.round(radius * 0.28)) + 'px Avenir Next, Segoe UI, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, cx, cy);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
      }

      downloadButton.disabled = false;
      setStatus('Effects applied. Download is ready.', false);
    }

    function handleFileSelect() {
      var file = input.files && input.files[0];
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
          applyButton.disabled = false;
          downloadButton.disabled = true;
          drawEffects();
        })
        .catch(function (error) {
          setStatus(error.message || 'Could not load the image.', true);
        });
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

    for (var i = 0; i < toggles.length; i += 1) {
      toggles[i].addEventListener('change', function () {
        if (sourceImage) {
          drawEffects();
        }
      });
    }

    drawPlaceholder();
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
