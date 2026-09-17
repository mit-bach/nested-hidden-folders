import { describe, expect, it } from 'vitest';

import {
	enabledChildrenOf,
	isHiddenFolderPath,
	listHiddenFolders,
	parentPath,
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
