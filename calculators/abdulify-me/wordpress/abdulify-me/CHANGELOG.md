# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.5] - 2026-05-21


## [0.1.4] - 2026-05-17


## [0.1.3] - 2026-05-17


### Added

- Added a new Facebook Page avatar action in the Abdulify widget:
	- `Connect Facebook` button
	- Page selector
	- `Set as Facebook Page Avatar` button
- Added WordPress settings page entry (Settings -> Abdulify Me) with configurable Facebook App ID.
- Added secure AJAX upload endpoint for forwarding generated PNG image data to Facebook Page picture API.
- Added frontend OAuth token handling (session-based) for loading manageable Pages and triggering one-click avatar updates.

## [0.1.2] - 2026-05-17


## [0.1.1] - 2026-05-16


## [0.1.0] - 2026-05-16

### Added

- Initial Abdulify Me plugin scaffold.
- Shortcode UI for upload, preview, effect toggles, and download.
- Client-side canvas effects: frame, text ribbon, tint, and badge.
- Browser-only photo processing flow with no server-side image storage.
