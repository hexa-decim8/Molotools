# Site Translator

A lightweight WordPress plugin that adds floating translate buttons to translate the entire site into **Spanish** or **Arabic** using the free Google Translate Element widget. No API key required.

## Features

- **Floating button bar** — fixed in the bottom-right corner on every page
- **Two languages** — Español and العربية
- **RTL support** — automatically flips page direction to right-to-left when Arabic is active
- **Persistent** — translation survives page navigation via the `googtrans` cookie
- **Zero configuration** — activate the plugin and it works immediately

## Installation

1. Copy the `site-translator/` folder into `wp-content/plugins/`
2. Activate **Site Translator** in the WordPress admin plugins page
3. Done — the floating translate bar appears on all front-end pages

## How It Works

The plugin loads Google's free client-side Translate Element widget, hides the default Google UI, and renders custom floating buttons instead. When a user clicks a language button, the plugin programmatically triggers Google Translate's `<select>` element to perform the translation entirely in the browser.
