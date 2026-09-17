import { readdir } from 'fs/promises';
import { join } from 'path';

import { isHiddenFolderPath, normalizeVaultPath } from './scan';

export interface DiskListing {
	files: string[];
	folders: string[];
}

function skipName(name: string): boolean {
	return name === '.' || name === '..' || name === '.DS_Store';
}

export async function listDiskEntries(
	vaultRoot: string,
	relative: string,
): Promise<DiskListing> {
	const abs = relative.length === 0 ? vaultRoot : join(vaultRoot, relative);
	const files: string[] = [];
	const folders: string[] = [];
	let entries: Array<{ name: string; isDirectory: () => boolean; isFile: () => boolean }>;
	try {
		entries = await readdir(abs, { withFileTypes: true });
	} catch {
		return { files, folders };
	}
	for (const entry of entries) {
		if (skipName(entry.name)) {
			continue;
		}
		const child = normalizeVaultPath(
			relative.length === 0 ? entry.name : `${relative}/${entry.name}`,
		);
		if (entry.isDirectory()) {
			folders.push(child);
		} else if (entry.isFile()) {
			files.push(child);
		}
	}
	return { files, folders };
}

export async function listHiddenFoldersOnDisk(
	vaultRoot: string,
	configDir: string,
): Promise<string[]> {
	const found: string[] = [];
	const queue: string[] = [''];
	const seen = new Set<string>(['']);
	const config = normalizeVaultPath(configDir);
	while (queue.length > 0) {
		const relative = queue.shift();
		if (relative === undefined) {
			break;
		}
		const listing = await listDiskEntries(vaultRoot, relative);
		for (const child of listing.folders) {
			if (seen.has(child)) {
				continue;
			}
			seen.add(child);
			if (child === config || child.startsWith(`${config}/`)) {
				continue;
			}
			if (isHiddenFolderPath(child, configDir)) {
				found.push(child);
			}
			queue.push(child);
		}
	}
	return found.sort();
}
