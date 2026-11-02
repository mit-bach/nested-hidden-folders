import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { FileSystemAdapter } from 'obsidian';
import type { App } from 'obsidian';

import { HiddenFolderIndexer } from './indexer';

let vault: string;

async function touch(relative: string): Promise<void> {
	const abs = join(vault, relative);
	await mkdir(join(abs, '..'), { recursive: true });
	await writeFile(abs, 'x');
}

beforeAll(async () => {
	vault = await mkdtemp(join(tmpdir(), 'nhf-indexer-'));
	await touch('project/.agents/skills/demo/SKILL.md');
	await touch('project/.agents/.git/config');
	await touch('.git/HEAD');
});

afterAll(async () => {
	await rm(vault, { recursive: true, force: true });
});

interface Harness {
	indexer: HiddenFolderIndexer;
	adapter: Record<string, any>;
	folders: string[];
	files: string[];
	originalReconcileFile: ReturnType<typeof vi.fn>;
}

function setup(): Harness {
	const folders: string[] = [];
	const files: string[] = [];
	const originalReconcileFile = vi.fn(async (): Promise<void> => undefined);
	const adapter = new FileSystemAdapter(vault) as unknown as Record<string, any>;
	adapter.list = async (): Promise<{ files: string[]; folders: string[] }> => {
		return { files: [], folders: [] };
	};
	adapter.listRecursiveChild = async (): Promise<void> => undefined;
	adapter.reconcileFile = originalReconcileFile;
	adapter.reconcileFolderCreation = async (path: string): Promise<void> => {
		folders.push(path);
	};
	adapter.reconcileFileInternal = async (path: string): Promise<void> => {
		files.push(path);
	};
	adapter.reconcileDeletion = async (): Promise<void> => undefined;
	adapter.trigger = (): void => undefined;
	adapter.watchHiddenRecursive = async (): Promise<void> => undefined;
	const app = {
		vault: { adapter, configDir: '.obsidian', getAllLoadedFiles: () => [] },
	} as unknown as App;
	return { indexer: new HiddenFolderIndexer(app), adapter, folders, files, originalReconcileFile };
}

describe('HiddenFolderIndexer exclusions', () => {
	it('indexes project/.agents/skills but not the nested .git', async () => {
		const h = setup();
		h.indexer.setExcludes(['.git']);
		expect(await h.indexer.enable('project/.agents')).toBe(true);
		expect(h.folders).toEqual([
			'project/.agents',
			'project/.agents/skills',
			'project/.agents/skills/demo',
		]);
		expect(h.files).toEqual(['project/.agents/skills/demo/SKILL.md']);
		expect(existsSync(join(vault, 'project/.agents/.git/config'))).toBe(true);
	});

	it('hides excluded children from the patched adapter listing', async () => {
		const h = setup();
		h.indexer.setExcludes(['.git']);
		await h.indexer.enable('project/.agents');
		const listing = await h.adapter.list('project/.agents');
		expect(listing.folders).toEqual(['project/.agents/skills']);
	});

	it('leaves excluded paths to the original reconcileFile', async () => {
		const h = setup();
		h.indexer.setExcludes(['.git']);
		await h.indexer.enable('project/.agents');
		h.files.length = 0;
		await h.adapter.reconcileFile('project/.agents/.git/config', 'project/.agents/.git/config');
		expect(h.originalReconcileFile).toHaveBeenCalledTimes(1);
		expect(h.files).toEqual([]);
		await h.adapter.reconcileFile(
			'project/.agents/skills/demo/SKILL.md',
			'project/.agents/skills/demo/SKILL.md',
		);
		expect(h.files).toEqual(['project/.agents/skills/demo/SKILL.md']);
	});

	it('indexes the .git folder again with an empty exclusion list', async () => {
		const h = setup();
		h.indexer.setExcludes([]);
		await h.indexer.enable('project/.agents');
		expect(h.folders).toContain('project/.agents/.git');
	});
});
