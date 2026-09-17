import { Notice, Plugin } from 'obsidian';

import { HiddenFolderIndexer } from './indexer';
import { parseSettings, type NestedHiddenFoldersSettings } from './settings';
import { NestedHiddenFoldersSettingTab } from './settings-tab';

export default class NestedHiddenFoldersPlugin extends Plugin {
	settings!: NestedHiddenFoldersSettings;
	indexer = new HiddenFolderIndexer(this.app);

	async onload(): Promise<void> {
		this.settings = parseSettings(await this.loadData());
		this.addSettingTab(new NestedHiddenFoldersSettingTab(this.app, this));
		this.addCommand({
			id: 'rescan-nested-hidden-folders',
			name: 'Rescan hidden folders',
			callback: (): void => {
				void this.syncEnabled();
			},
		});
		this.app.workspace.onLayoutReady((): void => {
			void this.syncEnabled();
		});
	}

	onunload(): void {
		void this.indexer.teardown();
	}

	async refreshFolderList(): Promise<void> {
		await this.indexer.listHiddenFolders();
	}

	async setFolderEnabled(path: string, enabled: boolean): Promise<void> {
		const next = new Set(this.settings.enabledFolders);
		if (enabled) {
			next.add(path);
		} else {
			next.delete(path);
		}
		this.settings.enabledFolders = [...next].sort();
		await this.saveData(this.settings);
		if (enabled) {
			new Notice(`Indexing ${path}…`);
			const ok = await this.indexer.enable(path);
			if (!ok) {
				this.settings.enabledFolders = this.settings.enabledFolders.filter(
					(item: string): boolean => item !== path,
				);
				await this.saveData(this.settings);
				new Notice(`${path} is not on disk`);
				return;
			}
			new Notice(`Indexed ${path}`);
			return;
		}
		new Notice(`Removing ${path} from the index…`);
		await this.indexer.disable(path);
		new Notice(`Removed ${path}`);
	}

	private async syncEnabled(): Promise<void> {
		const existing = await this.indexer.sync(this.settings.enabledFolders);
		if (existing.join('\0') !== this.settings.enabledFolders.join('\0')) {
			this.settings.enabledFolders = existing;
			await this.saveData(this.settings);
		}
	}
}
