export interface NestedHiddenFoldersSettings {
	enabledFolders: string[];
}

export const DEFAULT_SETTINGS: NestedHiddenFoldersSettings = {
	enabledFolders: [],
};

export function parseSettings(raw: unknown): NestedHiddenFoldersSettings {
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
		return { enabledFolders: [] };
	}
	const enabled = (raw as { enabledFolders?: unknown }).enabledFolders;
	if (!Array.isArray(enabled)) {
		return { enabledFolders: [] };
	}
	return {
		enabledFolders: enabled.filter((item: unknown): item is string => {
			return typeof item === 'string' && item.length > 0;
		}),
	};
}
