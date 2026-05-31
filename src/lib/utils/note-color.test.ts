import { describe, expect, it } from 'vitest';
import {
	DEFAULT_NOTE_HUE,
	normalizeNoteColor,
	noteColorStyleVars,
	noteHexToHue,
	noteHueToHex,
	isValidNoteHex
} from './note-color';

describe('note-color utilities', () => {
	it('normalizes valid hex and rejects invalid values', () => {
		expect(normalizeNoteColor('#fde68a')).toBe('#FDE68A');
		expect(normalizeNoteColor('')).toBe('');
		expect(normalizeNoteColor(null)).toBe('');
		expect(normalizeNoteColor('blue')).toBe('');
		expect(normalizeNoteColor('#abc')).toBe('');
	});

	it('produces valid 6-digit hex from hue', () => {
		const hex = noteHueToHex(240);
		expect(isValidNoteHex(hex)).toBe(true);
	});

	it('round-trips hue through hex for slider position', () => {
		for (const hue of [0, 60, 120, 180, 240, 300]) {
			const hex = noteHueToHex(hue);
			const recoveredHex = noteHueToHex(noteHexToHue(hex));
			expect(recoveredHex).toBe(hex);
		}
	});

	it('returns default hue for empty or invalid hex', () => {
		expect(noteHexToHue('')).toBe(DEFAULT_NOTE_HUE);
		expect(noteHexToHue('blue')).toBe(DEFAULT_NOTE_HUE);
	});

	it('returns empty style vars when color is unset', () => {
		expect(noteColorStyleVars('')).toEqual({});
		expect(noteColorStyleVars('#AABBCC')).toEqual({
			'--note-accent': '#AABBCC',
			'--note-page-tint': '#AABBCC'
		});
	});
});
