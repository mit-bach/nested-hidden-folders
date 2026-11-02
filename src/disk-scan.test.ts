import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { listDiskEntries, listHiddenFoldersOnDisk } from './disk-scan';

let vault: string;

async function touch(relative: string): Promise<void> {
	const abs = join(vault, relative);
	await mkdir(join(abs, '..'), { recursive: true });
	await writeFile(abs, 'x');
}

beforeAll(async () => {
	vault = await mkdtemp(join(tmpdir(), 'nhf-vault-'));
	await touch('note.md');
	await touch('project/readme.md');
	await touch('project/.agents/skills/demo/SKILL.md');
	await touch('project/.agents/.git/config');
	await touch('project/.git/HEAD');
	await touch('.claude/settings.json');
	await touch('.git/HEAD');
	await touch('.obsidian/app.json');
});

afterAll(async () => {
	await rm(vault, { recursive: true, force: true });
});

describe('listHiddenFoldersOnDisk', () => {
	it('finds nested hidden folders and skips .git when excluded', async () => {
		const found = await listHiddenFoldersOnDisk(vault, '.obsidian', ['.git']);
		expect(found).toEqual(['.claude', 'project/.agents']);
	});

	it('lists .git folders again once the exclusion list is empty', async () => {
		const found = await listHiddenFoldersOnDisk(vault, '.obsidian', []);
		expect(found).toEqual([
			'.claude',
			'.git',
			'project/.agents',
			'project/.agents/.git',
			'project/.git',
		]);
	});
});

describe('listDiskEntries', () => {
	it('drops excluded child folders from a listing', async () => {
		const listing = await listDiskEntries(vault, 'project/.agents', ['.git']);
		expect(listing.folders).toEqual(['project/.agents/skills']);
		const unfiltered = await listDiskEntries(vault, 'project/.agents');
		expect(unfiltered.folders.sort()).toEqual([
			'project/.agents/.git',
			'project/.agents/skills',
		]);
	});
});
