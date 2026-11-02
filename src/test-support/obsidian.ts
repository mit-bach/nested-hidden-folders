import { join } from 'path';

/** Runtime stand-in for the parts of `obsidian` the indexer touches in tests. */
export class FileSystemAdapter {
	constructor(public base: string) {}

	getBasePath(): string {
		return this.base;
	}

	getFullPath(path: string): string {
		return join(this.base, path);
	}
}

export class Notice {}

export function normalizePath(path: string): string {
	return path;
}
