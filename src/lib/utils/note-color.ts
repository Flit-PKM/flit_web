/** Fixed OKLCH parameters for note hue picker (pastel, neutral chroma). */
export const NOTE_COLOR_LIGHTNESS = 0.7;
export const NOTE_COLOR_CHROMA = 0.5;
/** Default hue when color is unset (matches `--color-blue`). */
export const DEFAULT_NOTE_HUE = 240;

const HEX6_RE = /^#[0-9A-Fa-f]{6}$/;

function clamp01(value: number): number {
	return Math.min(1, Math.max(0, value));
}

function oklabToLinearSrgb(l: number, a: number, b: number): [number, number, number] {
	const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
	const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
	const s_ = l - 0.0894841775 * a - 1.291485548 * b;
	const l3 = l_ ** 3;
	const m3 = m_ ** 3;
	const s3 = s_ ** 3;
	return [
		+4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
		-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
		-0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3
	];
}

function linearToSrgb(channel: number): number {
	const c = clamp01(channel);
	if (c <= 0.0031308) return 12.92 * c;
	return 1.055 * c ** (1 / 2.4) - 0.055;
}

function linearSrgbToHex(r: number, g: number, b: number): string {
	const toByte = (c: number) => Math.round(clamp01(linearToSrgb(c)) * 255);
	const rr = toByte(r).toString(16).padStart(2, '0');
	const gg = toByte(g).toString(16).padStart(2, '0');
	const bb = toByte(b).toString(16).padStart(2, '0');
	return `#${rr}${gg}${bb}`.toUpperCase();
}

function parseHexChannels(hex: string): [number, number, number] | null {
	if (!HEX6_RE.test(hex)) return null;
	const r = parseInt(hex.slice(1, 3), 16) / 255;
	const g = parseInt(hex.slice(3, 5), 16) / 255;
	const b = parseInt(hex.slice(5, 7), 16) / 255;
	return [r, g, b];
}

export function isValidNoteHex(hex: string): boolean {
	return HEX6_RE.test(hex);
}

export function normalizeNoteColor(raw: string | null | undefined): string {
	if (raw == null || raw === '') return '';
	const trimmed = raw.trim();
	if (!isValidNoteHex(trimmed)) return '';
	return trimmed.toUpperCase();
}

export function noteHueToHex(hue: number): string {
	const h = ((hue % 360) + 360) % 360;
	const hRad = (h * Math.PI) / 180;
	const a = NOTE_COLOR_CHROMA * Math.cos(hRad);
	const b = NOTE_COLOR_CHROMA * Math.sin(hRad);
	const [r, g, bb] = oklabToLinearSrgb(NOTE_COLOR_LIGHTNESS, a, b);
	return linearSrgbToHex(r, g, bb);
}

function rgbDistance(a: [number, number, number], b: [number, number, number]): number {
	const dr = a[0] - b[0];
	const dg = a[1] - b[1];
	const db = a[2] - b[2];
	return dr * dr + dg * dg + db * db;
}

export function noteHexToHue(hex: string): number {
	const normalized = normalizeNoteColor(hex);
	if (!normalized) return DEFAULT_NOTE_HUE;
	const target = parseHexChannels(normalized);
	if (!target) return DEFAULT_NOTE_HUE;

	let bestHue = DEFAULT_NOTE_HUE;
	let bestDistance = Infinity;
	for (let hue = 0; hue < 360; hue++) {
		const candidateHex = noteHueToHex(hue);
		const candidate = parseHexChannels(candidateHex);
		if (!candidate) continue;
		const distance = rgbDistance(target, candidate);
		if (distance < bestDistance) {
			bestDistance = distance;
			bestHue = hue;
		}
	}
	return bestHue;
}

export function noteColorStyleVars(hex: string): Record<string, string> {
	const normalized = normalizeNoteColor(hex);
	if (!normalized) return {};
	return {
		'--note-accent': normalized,
		'--note-page-tint': normalized
	};
}

/** Inline `style` attribute value for note accent/tint CSS custom properties. */
export function noteColorInlineStyle(hex: string): string {
	return Object.entries(noteColorStyleVars(hex))
		.map(([key, value]) => `${key}: ${value}`)
		.join('; ');
}

export function noteColorOklchCss(hue: number): string {
	const h = ((hue % 360) + 360) % 360;
	return `oklch(${NOTE_COLOR_LIGHTNESS} ${NOTE_COLOR_CHROMA} ${h})`;
}
