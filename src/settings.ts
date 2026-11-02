import { normalizeVaultPath, selectIndexRoots } from './scan';

export interface NestedHiddenFoldersSettings {
	/** Index every hidden folder in the vault except the excluded ones. */
	indexAll: boolean;
	/** Bare names match at any depth; entries with a slash are vault paths. */
	excludedFolders: string[];
	/** Manual selection, only used while `indexAll` is off. */
	enabledFolders: string[];
}

export const DEFAULT_EXCLUDED_FOLDERS: readonly string[] = ['.git'];

export const DEFAULT_SETTINGS: NestedHiddenFoldersSettings = {
	indexAll: true,
	excludedFolders: [...DEFAULT_EXCLUDED_FOLDERS],
	enabledFolders: [],
};

function parseStringList(value: unknown): string[] | null {
	if (!Array.isArray(value)) {
		return null;
	}
	return value.filter((item: unknown): item is string => {
		return typeof item === 'string' && item.length > 0;
	});
}

export function normalizeExclusions(entries: readonly string[]): string[] {
	const normalized = entries
		.map((entry: string): string => normalizeVaultPath(entry.trim()))
		.filter((entry: string): boolean => entry.length > 0);
	return [...new Set(normalized)];
}

export function resolveIndexTargets(
	hidden: readonly string[],
	settings: NestedHiddenFoldersSettings,
): string[] {
	if (settings.indexAll) {
		return selectIndexRoots(hidden, settings.excludedFolders);
	}
	return settings.enabledFolders;
}

export function parseSettings(raw: unknown): NestedHiddenFoldersSettings {
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
		return { ...DEFAULT_SETTINGS, excludedFolders: [...DEFAULT_EXCLUDED_FOLDERS] };
	}
	const stored = raw as {
		indexAll?: unknown;
		excludedFolders?: unknown;
		enabledFolders?: unknown;
	};
	const enabledFolders = parseStringList(stored.enabledFolders) ?? [];
	const excluded = parseStringList(stored.excludedFolders);
	// Installs from before this option keep their manual selection.
	const indexAll =
		typeof stored.indexAll === 'boolean'
			? stored.indexAll
			: enabledFolders.length === 0;
	return {
		indexAll,
		excludedFolders: excluded === null
			? [...DEFAULT_EXCLUDED_FOLDERS]
			: normalizeExclusions(excluded),
		enabledFolders,
	};
}
