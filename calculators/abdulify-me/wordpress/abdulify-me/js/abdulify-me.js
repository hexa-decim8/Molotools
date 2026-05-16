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
    var maxBytes = Number(config.maxBytes || 8 * 1024 * 1024);
    var overlayText = String(config.overlayText || 'I Support Abdul El-Sayed');
    var badgeText = String(config.badgeText || 'Abdul 2026');
    var tintColor = String(config.tintColor || '#175f8c');

    function getEffectState() {
      return {
        frame: widget.querySelector('[data-am-effect="frame"]').checked,
        text: widget.querySelector('[data-am-effect="text"]').checked,
        tint: widget.querySelector('[data-am-effect="tint"]').checked,
        badge: widget.querySelector('[data-am-effect="badge"]').checked
      };
    }

    function setStatus(message, isError) {
      status.textContent = message;
      status.style.color = isError ? '#b3212f' : '';
    }

    function drawPlaceholder() {
      canvas.width = 1200;
      canvas.height = 1200;
      ctx.fillStyle = '#f2f6fb';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#335f88';
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

      canvas.width = fitted.width;
      canvas.height = fitted.height;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.filter = 'contrast(1.05) saturate(1.04)';
      ctx.drawImage(sourceImage, 0, 0, canvas.width, canvas.height);
      ctx.filter = 'none';

      if (effects.tint) {
        ctx.fillStyle = tintColor + '22';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      if (effects.frame) {
        var frame = Math.max(12, Math.round(canvas.width * 0.018));
        ctx.strokeStyle = '#0f4f78';
        ctx.lineWidth = frame;
        ctx.strokeRect(frame / 2, frame / 2, canvas.width - frame, canvas.height - frame);
      }

      if (effects.text) {
        var ribbonHeight = Math.max(72, Math.round(canvas.height * 0.12));
        ctx.fillStyle = 'rgba(15, 79, 120, 0.9)';
        ctx.fillRect(0, canvas.height - ribbonHeight, canvas.width, ribbonHeight);
        ctx.fillStyle = '#ffffff';
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
        ctx.fillStyle = '#f0a33b';
        ctx.fill();

        ctx.strokeStyle = '#0b3957';
        ctx.lineWidth = Math.max(4, Math.round(radius * 0.08));
        ctx.stroke();

        ctx.fillStyle = '#0b3957';
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
