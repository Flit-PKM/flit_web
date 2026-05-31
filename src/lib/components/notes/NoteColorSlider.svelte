<script lang="ts">
	import {
		normalizeNoteColor,
		noteColorOklchCss,
		noteHexToHue,
		noteHueToHex
	} from '$lib/utils/note-color';

	let {
		liveColor = '',
		disabled = false,
		onColorChange
	}: {
		liveColor?: string;
		disabled?: boolean;
		onColorChange: (hex: string) => void;
	} = $props();

	let hue = $derived(noteHexToHue(liveColor));
	let swatchCss = $derived(noteColorOklchCss(hue));
	let canClear = $derived(normalizeNoteColor(liveColor) !== '');

	function onHueInput(event: Event) {
		const value = Number((event.currentTarget as HTMLInputElement).value);
		if (!Number.isFinite(value)) return;
		onColorChange(noteHueToHex(value));
	}

	function onClear() {
		if (!canClear || disabled) return;
		onColorChange('');
	}
</script>

<section class="note-detail__block note-color-slider" aria-labelledby="note-color-label">
	<h2 id="note-color-label" class="note-detail__block-title">Color</h2>
	<div class="note-color-slider__row">
		<span
			class="note-color-slider__swatch"
			style:background-color={swatchCss}
			aria-hidden="true"
		></span>
		<input
			type="range"
			class="note-color-slider__input"
			min="0"
			max="360"
			step="1"
			value={hue}
			{disabled}
			aria-label="Note color hue"
			oninput={onHueInput}
		/>
		<button
			type="button"
			class="btn btn-secondary btn--compact note-color-slider__clear"
			disabled={disabled || !canClear}
			onclick={onClear}
		>
			Clear
		</button>
	</div>
</section>
