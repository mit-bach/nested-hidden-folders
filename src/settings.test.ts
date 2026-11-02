import { describe, expect, it } from 'vitest';

import { DEFAULT_SETTINGS, parseSettings, resolveIndexTargets } from './settings';

describe('resolveIndexTargets', () => {
	const hidden = ['.claude', 'project/.agents', 'project/.agents/.inner', '.git'];

	it('indexes every non-excluded hidden folder when indexAll is on', () => {
		const targets = resolveIndexTargets(hidden, {
			indexAll: true,
			excludedFolders: ['.git'],
			enabledFolders: ['stale/.old'],
		});
		expect(targets).toEqual(['.claude', 'project/.agents']);
	});

	it('uses the manual selection when indexAll is off', () => {
		const targets = resolveIndexTargets(hidden, {
			indexAll: false,
			excludedFolders: ['.git'],
			enabledFolders: ['.claude'],
		});
		expect(targets).toEqual(['.claude']);
	});
});

describe('parseSettings', () => {
	it('indexes all hidden folders and excludes .git by default', () => {
		expect(DEFAULT_SETTINGS.indexAll).toBe(true);
		expect(DEFAULT_SETTINGS.excludedFolders).toEqual(['.git']);
		expect(parseSettings(null)).toEqual({
			indexAll: true,
			excludedFolders: ['.git'],
			enabledFolders: [],
		});
		expect(parseSettings({})).toEqual({
			indexAll: true,
			excludedFolders: ['.git'],
			enabledFolders: [],
		});
	});

	it('keeps manual mode for existing installs that already picked folders', () => {
		const parsed = parseSettings({ enabledFolders: ['.claude', 'project/.agents'] });
		expect(parsed.indexAll).toBe(false);
		expect(parsed.enabledFolders).toEqual(['.claude', 'project/.agents']);
		expect(parsed.excludedFolders).toEqual(['.git']);
	});

	it('respects stored values', () => {
		const parsed = parseSettings({
			indexAll: false,
			excludedFolders: ['.git', 'node_modules'],
			enabledFolders: [],
		});
		expect(parsed.indexAll).toBe(false);
		expect(parsed.excludedFolders).toEqual(['.git', 'node_modules']);
	});

	it('lets the user clear the exclusion list', () => {
		expect(parseSettings({ excludedFolders: [] }).excludedFolders).toEqual([]);
	});

	it('normalizes and de-duplicates exclusion entries and drops junk', () => {
		const parsed = parseSettings({
			excludedFolders: [' .git ', '/project/.cache/', '', 42, '.git'],
		});
		expect(parsed.excludedFolders).toEqual(['.git', 'project/.cache']);
	});
});
