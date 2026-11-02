import { Notice, PluginSettingTab, Setting } from 'obsidian';
import type { App } from 'obsidian';

import type NestedHiddenFoldersPlugin from './main';
import { normalizeExclusions } from './settings';

export class NestedHiddenFoldersSettingTab extends PluginSettingTab {
	plugin: NestedHiddenFoldersPlugin;

	constructor(app: App, plugin: NestedHiddenFoldersPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl('p', {
			text: 'Scans the whole vault for folders whose names start with a dot, including nested ones, and indexes them into the file tree. Disable Hidden Folders Access while this plugin is on — both patch the same adapter.',
		});
		new Setting(containerEl)
			.setName('Index all hidden folders')
			.setDesc(
				'Index every hidden folder in the vault, including new ones, except the excluded folders below. Turn off to pick folders one by one.',
			)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.indexAll);
				toggle.onChange((on: boolean): void => {
					this.plugin.settings.indexAll = on;
					void this.plugin
						.saveSettings()
						.then((): Promise<void> => this.plugin.syncEnabled())
						.then((): void => {
							this.display();
						});
				});
			});
		new Setting(containerEl)
			.setName('Excluded folders')
			.setDesc(
				'One per line. A bare name like .git matches at any depth; a path like project/.cache matches from the vault root. Excluded folders and everything below them are never indexed.',
			)
			.addTextArea((area) => {
				area.setValue(this.plugin.settings.excludedFolders.join('\n'));
				area.inputEl.rows = 4;
				area.inputEl.addEventListener('blur', (): void => {
					const next = normalizeExclusions(area.getValue().split('\n'));
					if (next.join('\0') === this.plugin.settings.excludedFolders.join('\0')) {
						return;
					}
					this.plugin.settings.excludedFolders = next;
					void this.plugin
						.saveSettings()
						.then((): Promise<void> => this.plugin.syncEnabled())
						.then((): void => {
							this.display();
						});
				});
			});
		new Setting(containerEl)
			.setName('Refresh list')
			.setDesc('Walk the vault again to pick up new hidden folders.')
			.addButton((button) => {
				button.setButtonText('Refresh');
				button.setCta();
				button.onClick((): void => {
					void this.plugin.refreshFolderList().then((): void => {
						this.display();
						new Notice('Hidden folder list refreshed');
					});
				});
			});
		void this.renderToggles();
	}

	private async renderToggles(): Promise<void> {
		const host = this.containerEl.createDiv();
		host.createEl('p', { text: 'Scanning…' });
		let folders: string[];
		try {
			folders = await this.plugin.indexer.listHiddenFolders();
		} catch (error: unknown) {
			host.empty();
			const message = error instanceof Error ? error.message : String(error);
			host.createEl('p', { text: `Failed to list hidden folders: ${message}` });
			return;
		}
		host.empty();
		if (this.plugin.settings.indexAll) {
			const indexed = this.plugin.indexer.getEnabled();
			host.createEl('p', {
				text:
					indexed.length === 0
						? 'No hidden folders are indexed right now.'
						: `Indexed hidden folders (${indexed.length}): ${indexed.join(', ')}`,
			});
			return;
		}
		if (folders.length === 0) {
			host.createEl('p', { text: 'No hidden folders found in this vault.' });
			return;
		}
		for (const path of folders) {
			new Setting(host).setName(path).addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.enabledFolders.includes(path));
				toggle.onChange((on: boolean): void => {
					void this.plugin.setFolderEnabled(path, on);
				});
			});
		}
	}
}
