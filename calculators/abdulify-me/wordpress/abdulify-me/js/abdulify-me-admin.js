/**
 * Abdulify Me Admin UI
 * Handles overlay management functionality in the admin settings page
 */

(function() {
	'use strict';

	// Ensure API exists
	if (typeof abdulifyMeAdmin === 'undefined') {
		return;
	}

	// Wait for DOM to be ready
	document.addEventListener('DOMContentLoaded', function() {
		initializeOverlayManagement();
	});

	/**
	 * Initialize all overlay management functionality
	 */
	function initializeOverlayManagement() {
		const uploadForm = document.getElementById('am-overlay-upload-form');
		const renameButtons = document.querySelectorAll('.am-overlay-rename-btn');
		const deleteButtons = document.querySelectorAll('.am-overlay-delete-btn');

		if (uploadForm) {
			uploadForm.addEventListener('submit', handleUpload);
		}

		renameButtons.forEach(button => {
			button.addEventListener('click', handleRename);
		});

		deleteButtons.forEach(button => {
			button.addEventListener('click', handleDelete);
		});
	}

	/**
	 * Handle overlay upload
	 */
	function handleUpload(event) {
		event.preventDefault();

		const form = event.target;
		const fileInput = form.querySelector('input[name="overlay_file"]');
		const messageDiv = document.getElementById('am-upload-message');
		const submitBtn = form.querySelector('button[type="submit"]');

		if (!fileInput.files.length) {
			showMessage(messageDiv, 'Please select a file', 'error');
			return;
		}

		const file = fileInput.files[0];

		// Validate file size
		if (file.size > 8 * 1024 * 1024) {
			showMessage(messageDiv, abdulifyMeAdmin.i18n.fileTooLarge, 'error');
			return;
		}

		// Disable submit button
		submitBtn.disabled = true;
		submitBtn.textContent = 'Uploading...';

		const formData = new FormData();
		formData.append('action', 'am_overlay_upload');
		formData.append('nonce', abdulifyMeAdmin.uploadNonce);
		formData.append('file', file);

		fetch(abdulifyMeAdmin.ajaxUrl, {
			method: 'POST',
			body: formData
		})
		.then(response => response.json())
		.then(data => {
			if (data.success) {
				showMessage(messageDiv, abdulifyMeAdmin.i18n.uploadSuccess, 'success');
				fileInput.value = '';
				// Reload page after 1 second
				setTimeout(() => {
					location.reload();
				}, 1000);
			} else {
				showMessage(
					messageDiv,
					data.data?.message || abdulifyMeAdmin.i18n.uploadError,
					'error'
				);
			}
		})
		.catch(error => {
			console.error('Upload error:', error);
			showMessage(messageDiv, abdulifyMeAdmin.i18n.uploadError, 'error');
		})
		.finally(() => {
			submitBtn.disabled = false;
			submitBtn.textContent = 'Upload Overlay';
		});
	}

	/**
	 * Handle overlay rename
	 */
	function handleRename(event) {
		event.preventDefault();

		const button = event.target;
		const card = button.closest('.am-overlay-card');
		const overlayId = button.dataset.overlayId;
		const nameInput = card.querySelector('.am-overlay-name-input');
		const newName = nameInput.value.trim();

		if (!newName) {
			showMessage(
				getMessageDiv(card),
				'Please enter a name',
				'error'
			);
			return;
		}

		// Disable button
		button.disabled = true;
		const originalText = button.textContent;
		button.textContent = 'Saving...';

		const formData = new FormData();
		formData.append('action', 'am_overlay_rename');
		formData.append('nonce', abdulifyMeAdmin.renameNonce);
		formData.append('overlay_id', overlayId);
		formData.append('name', newName);

		fetch(abdulifyMeAdmin.ajaxUrl, {
			method: 'POST',
			body: formData
		})
		.then(response => response.json())
		.then(data => {
			if (data.success) {
				showMessage(
					getMessageDiv(card),
					abdulifyMeAdmin.i18n.renameSuccess,
					'success'
				);
			} else {
				showMessage(
					getMessageDiv(card),
					data.data?.message || abdulifyMeAdmin.i18n.renameError,
					'error'
				);
			}
		})
		.catch(error => {
			console.error('Rename error:', error);
			showMessage(
				getMessageDiv(card),
				abdulifyMeAdmin.i18n.renameError,
				'error'
			);
		})
		.finally(() => {
			button.disabled = false;
			button.textContent = originalText;
		});
	}

	/**
	 * Handle overlay delete
	 */
	function handleDelete(event) {
		event.preventDefault();

		const button = event.target;
		const overlayId = button.dataset.overlayId;
		const overlayLabel = button.dataset.overlayLabel;

		// Confirm deletion
		if (!confirm(abdulifyMeAdmin.i18n.deleteConfirm + '\n\n' + overlayLabel)) {
			return;
		}

		// Disable button
		button.disabled = true;
		const originalText = button.textContent;
		button.textContent = 'Deleting...';

		const formData = new FormData();
		formData.append('action', 'am_overlay_delete');
		formData.append('nonce', abdulifyMeAdmin.deleteNonce);
		formData.append('overlay_id', overlayId);

		fetch(abdulifyMeAdmin.ajaxUrl, {
			method: 'POST',
			body: formData
		})
		.then(response => response.json())
		.then(data => {
			if (data.success) {
				// Remove card from DOM
				const card = button.closest('.am-overlay-card');
				card.style.opacity = '0';
				card.style.transition = 'opacity 0.3s ease';
				setTimeout(() => {
					card.remove();
					showMessage(
						document.getElementById('am-upload-message'),
						abdulifyMeAdmin.i18n.deleteSuccess,
						'success'
					);
				}, 300);
			} else {
				showMessage(
					getMessageDiv(button.closest('.am-overlay-card')),
					data.data?.message || abdulifyMeAdmin.i18n.deleteError,
					'error'
				);
				button.disabled = false;
				button.textContent = originalText;
			}
		})
		.catch(error => {
			console.error('Delete error:', error);
			showMessage(
				getMessageDiv(button.closest('.am-overlay-card')),
				abdulifyMeAdmin.i18n.deleteError,
				'error'
			);
			button.disabled = false;
			button.textContent = originalText;
		});
	}

	/**
	 * Show message in a container
	 */
	function showMessage(container, message, type = 'info') {
		if (!container) return;

		const className = type === 'error' ? 'notice notice-error' : 'notice notice-success';
		container.innerHTML = `<div class="${className}" style="margin: 10px 0;"><p>${escapeHtml(message)}</p></div>`;
		container.style.display = 'block';

		// Auto-hide after 5 seconds
		if (type !== 'error') {
			setTimeout(() => {
				container.style.display = 'none';
			}, 5000);
		}
	}

	/**
	 * Get or create message div for a card
	 */
	function getMessageDiv(card) {
		if (!card) return null;

		let messageDiv = card.querySelector('.am-message');
		if (!messageDiv) {
			messageDiv = document.createElement('div');
			messageDiv.className = 'am-message';
			messageDiv.style.marginTop = '10px';
			card.appendChild(messageDiv);
		}
		return messageDiv;
	}

	/**
	 * Escape HTML special characters
	 */
	function escapeHtml(text) {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}
})();
