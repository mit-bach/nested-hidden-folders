export interface FolderList {
	folders: string[];
}

export type ListFn = (path: string) => Promise<FolderList>;

export function normalizeVaultPath(path: string): string {
	return path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

export function folderName(path: string): string {
	const normalized = normalizeVaultPath(path);
	const slash = normalized.lastIndexOf('/');
	return slash < 0 ? normalized : normalized.slice(slash + 1);
}

export function isHiddenFolderPath(path: string, configDir: string): boolean {
	const normalized = normalizeVaultPath(path);
	if (normalized.length === 0) {
		return false;
	}
	const config = normalizeVaultPath(configDir);
	if (normalized === config || normalized.startsWith(`${config}/`)) {
		return false;
	}
	return folderName(normalized).startsWith('.');
}

/**
 * A bare name (".git") matches a folder of that name at any depth; an entry
 * with a slash ("project/.cache") is a vault path. Either also covers
 * everything below the match.
 */
export function isExcluded(path: string, excludes: readonly string[]): boolean {
	if (excludes.length === 0) {
		return false;
	}
	const normalized = normalizeVaultPath(path);
	const segments = normalized.split('/');
	for (const raw of excludes) {
		const entry = normalizeVaultPath(raw);
		if (entry.length === 0) {
			continue;
		}
		if (entry.includes('/')) {
			if (normalized === entry || normalized.startsWith(`${entry}/`)) {
				return true;
			}
		} else if (segments.includes(entry)) {
			return true;
		}
	}
	return false;
}

/** Top-most hidden folders that are not excluded; nested ones are covered by their parent. */
export function selectIndexRoots(
	hidden: readonly string[],
	excludes: readonly string[],
): string[] {
	const kept = hidden
		.map(normalizeVaultPath)
		.filter((path: string): boolean => !isExcluded(path, excludes))
		.sort();
	const roots: string[] = [];
	for (const path of kept) {
		const covered = roots.some((root: string): boolean => {
			return path.startsWith(`${root}/`);
		});
		if (!covered) {
			roots.push(path);
		}
	}
	return roots;
}

export async function listHiddenFolders(
	list: ListFn,
	configDir: string,
	excludes: readonly string[] = [],
): Promise<string[]> {
	const found = new Set<string>();
	const queue: string[] = [''];
	const seen = new Set<string>(['']);
	while (queue.length > 0) {
		const current = queue.shift();
		if (current === undefined) {
			break;
		}
		let listed: FolderList;
		try {
			listed = await list(current.length === 0 ? '/' : current);
		} catch {
			continue;
		}
		for (const raw of listed.folders) {
			const child = normalizeVaultPath(raw);
			if (child.length === 0 || seen.has(child)) {
				continue;
			}
			seen.add(child);
			const config = normalizeVaultPath(configDir);
			if (child === config || child.startsWith(`${config}/`)) {
				continue;
			}
			if (isExcluded(child, excludes)) {
				continue;
			}
			if (isHiddenFolderPath(child, configDir)) {
				found.add(child);
			}
			queue.push(child);
		}
	}
	return [...found].sort();
}

export function parentPath(path: string): string {
	const normalized = normalizeVaultPath(path);
	const slash = normalized.lastIndexOf('/');
	return slash < 0 ? '' : normalized.slice(0, slash);
}

export function enabledChildrenOf(
	parent: string,
	enabled: readonly string[],
): string[] {
	const prefix = normalizeVaultPath(parent);
	return enabled.filter((path: string): boolean => {
		return parentPath(path) === prefix;
	});
}

export function mergeUnique(base: readonly string[], extra: readonly string[]): string[] {
	return [...new Set([...base, ...extra])].sort();
}
