import { describe, expect, it } from 'vitest';

import {
	enabledChildrenOf,
	isExcluded,
	isHiddenFolderPath,
	listHiddenFolders,
	parentPath,
	selectIndexRoots,
} from './scan';

describe('isHiddenFolderPath', () => {
	it('accepts nested dot folders and skips the config dir', () => {
		expect(isHiddenFolderPath('.grok', '.obsidian')).toBe(true);
		expect(isHiddenFolderPath('classes/.hidden', '.obsidian')).toBe(true);
		expect(isHiddenFolderPath('classes/open', '.obsidian')).toBe(false);
		expect(isHiddenFolderPath('.obsidian', '.obsidian')).toBe(false);
		expect(isHiddenFolderPath('.obsidian/plugins', '.obsidian')).toBe(false);
	});
});

describe('listHiddenFolders', () => {
	it('walks past the vault root into nested hidden folders', async () => {
		const tree: Record<string, string[]> = {
			'/': ['visible', '.root-hidden', '.obsidian'],
			visible: ['visible/notes', 'visible/.deep'],
			'visible/notes': [],
			'visible/.deep': ['visible/.deep/inner'],
			'visible/.deep/inner': ['visible/.deep/inner/.deeper'],
			'visible/.deep/inner/.deeper': [],
			'.root-hidden': [],
			'.obsidian': ['.obsidian/plugins'],
		};
		const found = await listHiddenFolders(async (path: string) => {
			const folders = tree[path] ?? [];
			return { folders };
		}, '.obsidian');
		expect(found).toEqual([
			'.root-hidden',
			'visible/.deep',
			'visible/.deep/inner/.deeper',
		]);
	});
});

describe('enabledChildrenOf', () => {
	it('returns hidden folders that sit directly under a parent', () => {
		expect(parentPath('classes/.grok')).toBe('classes');
		expect(
			enabledChildrenOf('classes', ['.grok', 'classes/.grok', '.pi']),
		).toEqual(['classes/.grok']);
		expect(enabledChildrenOf('', ['.grok', 'classes/.grok'])).toEqual(['.grok']);
	});
});

describe('isExcluded', () => {
	it('matches a bare name at any depth and everything below it', () => {
		expect(isExcluded('.git', ['.git'])).toBe(true);
		expect(isExcluded('project/.git', ['.git'])).toBe(true);
		expect(isExcluded('project/.git/objects', ['.git'])).toBe(true);
		expect(isExcluded('project/.github', ['.git'])).toBe(false);
		expect(isExcluded('project/.agents/skills', ['.git'])).toBe(false);
	});

	it('matches a vault path only from the vault root', () => {
		expect(isExcluded('project/.cache', ['project/.cache'])).toBe(true);
		expect(isExcluded('project/.cache/x', ['project/.cache'])).toBe(true);
		expect(isExcluded('other/project/.cache', ['project/.cache'])).toBe(false);
	});

	it('excludes nothing with an empty list', () => {
		expect(isExcluded('.git', [])).toBe(false);
	});
});

describe('selectIndexRoots', () => {
	it('keeps only top-most hidden folders that are not excluded', () => {
		const hidden = [
			'.claude',
			'.claude/.cache',
			'project/.agents',
			'project/.agents/.inner',
			'project/.git',
			'.git',
			'x/.git/.weird',
		];
		expect(selectIndexRoots(hidden, ['.git'])).toEqual([
			'.claude',
			'project/.agents',
		]);
	});
});

describe('listHiddenFolders with exclusions', () => {
	it('finds project/.agents/skills parents and never descends into .git', async () => {
		const visited: string[] = [];
		const tree: Record<string, string[]> = {
			'/': ['project', '.git'],
			project: ['project/.agents', 'project/.git'],
			'project/.agents': ['project/.agents/skills'],
			'project/.agents/skills': ['project/.agents/skills/demo'],
			'project/.agents/skills/demo': [],
			'project/.git': ['project/.git/objects'],
			'.git': ['.git/objects'],
		};
		const found = await listHiddenFolders(
			async (path: string) => {
				visited.push(path);
				return { folders: tree[path] ?? [] };
			},
			'.obsidian',
			['.git'],
		);
		expect(found).toEqual(['project/.agents']);
		expect(visited.some((path: string) => path.includes('.git'))).toBe(false);
	});
});
