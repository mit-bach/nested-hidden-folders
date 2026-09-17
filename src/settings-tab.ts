import { Notice, PluginSettingTab, Setting } from 'obsidian';
import type { App } from 'obsidian';

import type NestedHiddenFoldersPlugin from './main';

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
			text: 'Scans the whole vault for folders whose names start with a dot, including nested ones. Toggle a path to index it into the file tree. Disable Hidden Folders Access while this plugin is on — both patch the same adapter.',
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
