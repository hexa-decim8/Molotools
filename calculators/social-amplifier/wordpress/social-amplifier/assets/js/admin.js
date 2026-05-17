/* global saAdmin */
(function ($) {
  'use strict';

  // Copy-shortcode buttons.
  $(document).on('click', '.sa-copy-shortcode', function () {
    var $btn = $(this);
    var shortcode = $btn.data('shortcode');

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(shortcode).then(function () {
        flashCopied($btn);
      });
    } else {
      // Legacy fallback.
      var $ta = $('<textarea>').val(shortcode).css({ position: 'fixed', opacity: 0 }).appendTo('body');
      $ta[0].select();
      document.execCommand('copy');
      $ta.remove();
      flashCopied($btn);
    }
  });

  function flashCopied($btn) {
    var original = $btn.text();
    $btn.text('Copied!').addClass('copied');
    setTimeout(function () {
      $btn.text(original).removeClass('copied');
    }, 2000);
  }
})(jQuery);
