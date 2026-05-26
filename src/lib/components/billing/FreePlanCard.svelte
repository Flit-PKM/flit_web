<script lang="ts">
	interface Props {
		guestMode?: boolean;
		isCurrent?: boolean;
		hasActiveSubscription?: boolean;
		disabled?: boolean;
		onselect?: () => void;
	}

	let {
		guestMode = false,
		isCurrent = false,
		hasActiveSubscription = false,
		disabled = false,
		onselect
	}: Props = $props();

	let isInteractive = $derived(guestMode);
	let showCta = $derived(guestMode);
</script>

{#if isInteractive}
	<button
		type="button"
		class="plan-card plan-card--free"
		{disabled}
		onclick={() => onselect?.()}
		aria-label="Choose Free plan – create an account"
	>
		{@render cardInner()}
		{#if showCta}
			<span class="plan-card__cta">Get started free</span>
		{/if}
	</button>
{:else}
	<div
		class="plan-card plan-card--free {isCurrent ? 'plan-card--current' : ''} {hasActiveSubscription
			? 'plan-card--muted'
			: ''}"
		role="article"
		aria-current={isCurrent ? 'true' : undefined}
	>
		{@render cardInner()}
	</div>
{/if}

{#snippet cardInner()}
	{#if isCurrent}
		<span class="plan-card__badge">Current plan</span>
	{/if}
	<div class="plan-card__main">
		<div class="plan-card__head">
			<h3 class="plan-card__title">Free</h3>
			<p class="plan-card__price">$0</p>
		</div>
		<div class="plan-card__description card__meta">
			<p>Use Flit Web at no cost. Create notes, link ideas, and organize your knowledge.</p>
			<p>Upgrade anytime with a paid plan for AI and encryption features.</p>
		</div>
	</div>
{/snippet}
