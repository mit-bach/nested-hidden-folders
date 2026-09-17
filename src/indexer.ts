import { existsSync } from 'fs';
import { FileSystemAdapter, Notice, normalizePath } from 'obsidian';
import type { App, DataAdapter, ListedFiles, TAbstractFile } from 'obsidian';

import { listDiskEntries, listHiddenFoldersOnDisk } from './disk-scan';
import {
	enabledChildrenOf,
	listHiddenFolders,
	mergeUnique,
	normalizeVaultPath,
} from './scan';

/**
 * FileSystemAdapter internals used by Hidden Folders Access.
 * UNVERIFIED in public obsidian.d.ts; same hook as dsebastien/obsidian-hidden-folders-access.
 */
interface InternalAdapter extends DataAdapter {
	listRecursiveChild?: (parent: string, name: string) => Promise<void>;
	reconcileFile?: (
		normalizedPath: string,
		normalizedNewPath: string,
		exists?: boolean,
	) => Promise<void>;
	reconcileFileInternal?: (
		normalizedPath: string,
		normalizedNewPath: string,
	) => Promise<void>;
	reconcileFolderCreation?: (
		normalizedPath: string,
		normalizedNewPath: string,
	) => Promise<void>;
	reconcileDeletion?: (
		normalizedPath: string,
		normalizedNewPath: string,
		exists?: boolean,
	) => Promise<void>;
	watchHiddenRecursive?: (normalizedPath: string) => Promise<void>;
	stopWatchPath?: (normalizedPath: string) => void;
	watchers?: Record<string, unknown>;
	trigger?: (name: string, path: string) => void;
	list: (normalizedPath: string) => Promise<ListedFiles>;
}

interface AdapterPatches {
	listRecursiveChild: (parent: string, name: string) => Promise<void>;
	reconcileFile: (
		normalizedPath: string,
		normalizedNewPath: string,
		exists?: boolean,
	) => Promise<void>;
	list: (normalizedPath: string) => Promise<ListedFiles>;
}

function isNotFound(error: unknown): boolean {
	return (
		typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		(error as { code: unknown }).code === 'ENOENT'
	);
}

export class HiddenFolderIndexer {
	private readonly enabled = new Set<string>();
	private readonly busy = new Set<string>();
	private patches: AdapterPatches | null = null;

	constructor(private readonly app: App) {}

	getEnabled(): string[] {
		return [...this.enabled].sort();
	}

	async listHiddenFolders(): Promise<string[]> {
		const adapter = this.app.vault.adapter;
		const configDir = normalizePath(this.app.vault.configDir);
		const fromAdapter = await listHiddenFolders((path: string) => {
			return adapter.list(path);
		}, configDir);
		if (!(adapter instanceof FileSystemAdapter)) {
			return fromAdapter;
		}
		const fromDisk = await listHiddenFoldersOnDisk(
			adapter.getBasePath(),
			configDir,
		);
		return mergeUnique(fromAdapter, fromDisk);
	}

	async pathExists(path: string): Promise<boolean> {
		const normalized = normalizeVaultPath(path);
		const adapter = this.app.vault.adapter;
		if (adapter instanceof FileSystemAdapter) {
			return existsSync(adapter.getFullPath(normalized));
		}
		return adapter.exists(normalized);
	}

	async pruneMissing(paths: readonly string[]): Promise<string[]> {
		const kept: string[] = [];
		for (const path of paths) {
			if (await this.pathExists(path)) {
				kept.push(normalizeVaultPath(path));
			}
		}
		return kept.sort();
	}

	async sync(enabledPaths: string[]): Promise<string[]> {
		const existing = await this.pruneMissing(enabledPaths);
		const wanted = new Set(existing);
		for (const path of this.getEnabled()) {
			if (!wanted.has(path)) {
				await this.disable(path);
			}
		}
		for (const path of wanted) {
			if (!this.enabled.has(path)) {
				await this.enable(path);
			}
		}
		return existing;
	}

	async enable(path: string): Promise<boolean> {
		const normalized = normalizeVaultPath(path);
		if (normalized.length === 0 || this.enabled.has(normalized)) {
			return this.enabled.has(normalized);
		}
		if (this.busy.has(normalized)) {
			return false;
		}
		if (!(await this.pathExists(normalized))) {
			return false;
		}
		this.busy.add(normalized);
		try {
			this.patchAdapter();
			await this.indexTree(normalized);
			this.enabled.add(normalized);
			try {
				await this.internal().watchHiddenRecursive?.(normalized);
			} catch {
				// Watcher is optional; the disk walk already indexed children.
			}
			return true;
		} finally {
			this.busy.delete(normalized);
		}
	}

	async disable(path: string): Promise<void> {
		const normalized = normalizeVaultPath(path);
		if (!this.enabled.has(normalized)) {
			return;
		}
		if (this.busy.has(normalized)) {
			return;
		}
		this.busy.add(normalized);
		try {
			const adapter = this.internal();
			const watchers = adapter.watchers ?? {};
			for (const watched of Object.keys(watchers)) {
				if (this.underPrefix(watched, normalized)) {
					adapter.stopWatchPath?.(watched);
				}
			}
			const loaded = this.app.vault
				.getAllLoadedFiles()
				.filter((file: TAbstractFile) => this.underPrefix(file.path, normalized))
				.sort((left: TAbstractFile, right: TAbstractFile) => {
					return right.path.length - left.path.length;
				});
			for (const file of loaded) {
				adapter.trigger?.('raw', file.path);
				await adapter.reconcileDeletion?.(file.path, file.path, true);
			}
			this.enabled.delete(normalized);
			if (this.enabled.size === 0) {
				this.restoreAdapter();
			}
		} finally {
			this.busy.delete(normalized);
		}
	}

	async teardown(): Promise<void> {
		for (const path of this.getEnabled()) {
			await this.disable(path);
		}
		this.restoreAdapter();
	}

	private async indexTree(path: string): Promise<void> {
		const adapter = this.internal();
		const fsAdapter = this.app.vault.adapter;
		await adapter.reconcileFolderCreation?.(path, path);
		if (!(fsAdapter instanceof FileSystemAdapter)) {
			return;
		}
		const listing = await listDiskEntries(fsAdapter.getBasePath(), path);
		for (const folder of listing.folders) {
			await this.indexTree(folder);
		}
		for (const file of listing.files) {
			adapter.trigger?.('raw', file);
			try {
				await adapter.reconcileFileInternal?.(file, file);
			} catch (error: unknown) {
				if (!isNotFound(error)) {
					throw error;
				}
			}
		}
	}

	private patchAdapter(): void {
		if (this.patches !== null) {
			return;
		}
		const adapter = this.internal();
		const listRecursiveChild = adapter.listRecursiveChild?.bind(adapter);
		const reconcileFile = adapter.reconcileFile?.bind(adapter);
		const list = adapter.list.bind(adapter);
		if (listRecursiveChild === undefined || reconcileFile === undefined) {
			new Notice(
				'Nested Hidden Folders: this app build has no listRecursiveChild hook.',
			);
			return;
		}
		adapter.list = async (normalizedPath: string): Promise<ListedFiles> => {
			let original: ListedFiles = { files: [], folders: [] };
			try {
				original = await list(normalizedPath);
			} catch {
				original = { files: [], folders: [] };
			}
			const parent = normalizeVaultPath(
				normalizedPath === '/' ? '' : normalizedPath,
			);
			let extraFolders: string[] = enabledChildrenOf(parent, this.getEnabled());
			let extraFiles: string[] = [];
			if (this.isEnabled(parent) || this.enabled.has(parent)) {
				const fsAdapter = this.app.vault.adapter;
				if (fsAdapter instanceof FileSystemAdapter) {
					const disk = await listDiskEntries(fsAdapter.getBasePath(), parent);
					extraFolders = mergeUnique(extraFolders, disk.folders);
					extraFiles = disk.files;
				}
			}
			return {
				folders: mergeUnique(original.folders, extraFolders),
				files: mergeUnique(original.files, extraFiles),
			};
		};
		adapter.listRecursiveChild = async (
			parent: string,
			name: string,
		): Promise<void> => {
			const joined = parent === '' ? name : `${parent}/${name}`;
			const child = normalizeVaultPath(joined);
			if (!this.isEnabled(child)) {
				return listRecursiveChild(parent, name);
			}
			adapter.trigger?.('raw', child);
			try {
				await adapter.reconcileFileInternal?.(child, child);
			} catch (error: unknown) {
				if (isNotFound(error)) {
					await adapter.reconcileDeletion?.(child, child, true);
				}
			}
		};
		adapter.reconcileFile = async (
			normalizedPath: string,
			normalizedNewPath: string,
			exists?: boolean,
		): Promise<void> => {
			if (!this.isEnabled(normalizedNewPath)) {
				return reconcileFile(normalizedPath, normalizedNewPath, exists);
			}
			adapter.trigger?.('raw', normalizedNewPath);
			try {
				await adapter.reconcileFileInternal?.(normalizedPath, normalizedNewPath);
			} catch (error: unknown) {
				if (isNotFound(error)) {
					await adapter.reconcileDeletion?.(
						normalizedPath,
						normalizedNewPath,
						exists ?? true,
					);
				}
			}
		};
		this.patches = { listRecursiveChild, reconcileFile, list };
	}

	private restoreAdapter(): void {
		if (this.patches === null) {
			return;
		}
		const adapter = this.internal();
		adapter.listRecursiveChild = this.patches.listRecursiveChild;
		adapter.reconcileFile = this.patches.reconcileFile;
		adapter.list = this.patches.list;
		this.patches = null;
	}

	private isEnabled(path: string): boolean {
		const normalized = normalizeVaultPath(path);
		for (const prefix of this.enabled) {
			if (this.underPrefix(normalized, prefix)) {
				return true;
			}
		}
		return false;
	}

	private underPrefix(path: string, prefix: string): boolean {
		const normalized = normalizeVaultPath(path);
		return normalized === prefix || normalized.startsWith(`${prefix}/`);
	}

	private internal(): InternalAdapter {
		return this.app.vault.adapter;
	}
}
