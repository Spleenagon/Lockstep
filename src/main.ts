import {App, Editor, MarkdownView, Modal, Notice, Plugin} from 'obsidian';
import {DEFAULT_SETTINGS, LockstepPluginSettings, SampleSettingTab} from "./settings";

// Remember to rename these classes and interfaces!

export default class LockstepPlugin extends Plugin {
	settings: LockstepPluginSettings;
	private overlayEl: HTMLElement | null = null; // Store overlay reference
	private syncingTextEl: HTMLElement | null = null; // Store syncing text reference
	private disableBtnEl: HTMLElement | null = null; // Store disable button reference
	private typingBlockHandler: ((e: KeyboardEvent) => void) | null = null;
	private fullySyncedCount: number = 0; // Track consecutive "Fully synced"
	private overlayDisabled: boolean = false; // Disable overlay for session

	async onload() {
		await this.loadSettings();

		// This adds a settings tab so the user can configure various aspects of the plugin
		// this.addSettingTab(new SampleSettingTab(this.app, this));

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));

		// Log the aria-label of class="status-bar-item.plugin-sync" every 5 seconds
		this.registerInterval(window.setInterval(() => {
			const el = document.querySelector('.status-bar-item.plugin-sync');
			if (el) {
				console.log('plugin-sync aria-label:', el.getAttribute('aria-label'));
			} else {
				console.log('plugin-sync aria-label: element not found');
			}
		}, 5000));

		// Every second, hide the black overlay if aria-label is "Fully synced"
		this.registerInterval(window.setInterval(() => {
			if (this.overlayDisabled) return; // Stop checking if disabled

			const el = document.querySelector('.status-bar-item.plugin-sync');
			const ariaLabel = el?.getAttribute('aria-label');
			if (ariaLabel === "Fully synced") {
				this.fullySyncedCount++;
				if (this.fullySyncedCount >= 3) {
					this.overlayDisabled = true;
					if (this.overlayEl) this.overlayEl.style.display = "none";
					if (this.syncingTextEl) this.syncingTextEl.style.display = "none";
					if (this.disableBtnEl) this.disableBtnEl.style.display = "none";
					if (this.typingBlockHandler) {
						document.removeEventListener('keydown', this.typingBlockHandler, true);
						this.typingBlockHandler = null;
					}
					return;
				}
				if (this.overlayEl) this.overlayEl.style.display = "none";
				if (this.syncingTextEl) this.syncingTextEl.style.display = "none";
				if (this.disableBtnEl) this.disableBtnEl.style.display = "none";
				if (this.typingBlockHandler) {
					document.removeEventListener('keydown', this.typingBlockHandler, true);
					this.typingBlockHandler = null;
				}
			} else if (this.overlayEl) {
				this.fullySyncedCount = 0; // Reset counter if not fully synced
				this.overlayEl.style.display = "";
				if (this.syncingTextEl) this.syncingTextEl.style.display = "";
				if (this.disableBtnEl) this.disableBtnEl.style.display = "";
				// Add typing block if not present
				if (!this.typingBlockHandler) {
					this.typingBlockHandler = (e: KeyboardEvent) => {
						if (this.overlayEl && this.overlayEl.style.display !== "none") {
							if (
								!e.ctrlKey && !e.metaKey &&
								e.key.length === 1 // printable character
							) {
								e.stopPropagation();
								e.preventDefault();
							}
						}
					};
					document.addEventListener('keydown', this.typingBlockHandler, true);
				}
			}
		}, 1000));

		// Add black overlay to block horizontal-main-container
		const target = document.querySelector('.horizontal-main-container') as HTMLElement;
		if (target) {
			const overlay = document.createElement('div');
			overlay.style.position = 'absolute';
			overlay.style.top = '0';
			overlay.style.left = '0';
			overlay.style.width = '100%';
			overlay.style.height = '100%';
			overlay.style.background = 'black';
			overlay.style.opacity = '0.3'; // 30% alpha
			overlay.style.zIndex = '9999';
			overlay.style.pointerEvents = 'auto';
			overlay.className = 'lockstep-black-overlay';
			target.style.position = 'relative'; // Ensure target is positioned
			target.appendChild(overlay);
			this.overlayEl = overlay;

			// Add "syncing..." text overlay
			const syncingText = document.createElement('div');
			syncingText.textContent = "syncing...";
			syncingText.style.position = 'absolute';
			syncingText.style.top = '50%';
			syncingText.style.left = '50%';
			syncingText.style.transform = 'translate(-50%, -50%)';
			syncingText.style.color = 'white';
			syncingText.style.fontSize = '2em';
			syncingText.style.fontWeight = 'bold';
			syncingText.style.zIndex = '10000';
			syncingText.style.pointerEvents = 'none';
			syncingText.style.userSelect = 'none';
			syncingText.className = 'lockstep-syncing-text';
			target.appendChild(syncingText);
			this.syncingTextEl = syncingText;

			// Add "Disable overlay" button below syncing text
			const disableBtn = document.createElement('button');
			disableBtn.textContent = "Disable overlay for session";
			disableBtn.style.position = 'absolute';
			disableBtn.style.top = 'calc(50% + 2em)';
			disableBtn.style.left = '50%';
			disableBtn.style.transform = 'translate(-50%, 0)';
			disableBtn.style.zIndex = '10001';
			disableBtn.style.fontSize = '1em';
			disableBtn.style.padding = '0.5em 1em';
			disableBtn.style.background = '#222';
			disableBtn.style.color = 'white';
			disableBtn.style.border = 'none';
			disableBtn.style.borderRadius = '4px';
			disableBtn.style.cursor = 'pointer';
			disableBtn.className = 'lockstep-disable-overlay-btn';
			disableBtn.onclick = () => {
				this.overlayDisabled = true;
				if (this.overlayEl) this.overlayEl.style.display = "none";
				if (this.syncingTextEl) this.syncingTextEl.style.display = "none";
				if (disableBtn) disableBtn.style.display = "none";
				if (this.typingBlockHandler) {
					document.removeEventListener('keydown', this.typingBlockHandler, true);
					this.typingBlockHandler = null;
				}
			};
			target.appendChild(disableBtn);
			this.disableBtnEl = disableBtn;
		}

		// Immediately set overlay and typing block state based on aria-label
		const el = document.querySelector('.status-bar-item.plugin-sync');
		const ariaLabel = el?.getAttribute('aria-label');
		if (ariaLabel === "Fully synced" && this.overlayEl) {
			this.fullySyncedCount = 1;
			this.overlayEl.style.display = "none";
			if (this.syncingTextEl) this.syncingTextEl.style.display = "none";
			if (this.disableBtnEl) this.disableBtnEl.style.display = "none";
			if (this.typingBlockHandler) {
				document.removeEventListener('keydown', this.typingBlockHandler, true);
				this.typingBlockHandler = null;
			}
		} else if (this.overlayEl) {
			this.fullySyncedCount = 0;
			this.overlayEl.style.display = "";
			if (this.syncingTextEl) this.syncingTextEl.style.display = "";
			if (this.disableBtnEl) this.disableBtnEl.style.display = "";
			if (!this.typingBlockHandler) {
				this.typingBlockHandler = (e: KeyboardEvent) => {
					if (this.overlayEl && this.overlayEl.style.display !== "none") {
						if (
							!e.ctrlKey && !e.metaKey &&
							e.key.length === 1 // printable character
						) {
							e.stopPropagation();
							e.preventDefault();
						}
					}
				};
				document.addEventListener('keydown', this.typingBlockHandler, true);
			}
		}

	}

	onunload() {
		// Remove overlay if it exists
		if (this.overlayEl && this.overlayEl.parentElement) {
			this.overlayEl.parentElement.removeChild(this.overlayEl);
			this.overlayEl = null;
		}
		// Remove syncing text if it exists
		if (this.syncingTextEl && this.syncingTextEl.parentElement) {
			this.syncingTextEl.parentElement.removeChild(this.syncingTextEl);
			this.syncingTextEl = null;
		}
		// Remove disable button if present
		if (this.disableBtnEl && this.disableBtnEl.parentElement) {
			this.disableBtnEl.parentElement.removeChild(this.disableBtnEl);
			this.disableBtnEl = null;
		}
		// Remove typing block if present
		if (this.typingBlockHandler) {
			document.removeEventListener('keydown', this.typingBlockHandler, true);
			this.typingBlockHandler = null;
		}
		this.fullySyncedCount = 0;
		this.overlayDisabled = false;
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<LockstepPluginSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
