<script lang="ts">
	let {
		id,
		name,
		requiredToSave = false,
		value = '',
		oninput,
		error = '',
		disabled = false,
		showPassword = $bindable(false),
		errorId = `${id}-error`
	}: {
		id: string;
		name: string;
		requiredToSave?: boolean;
		value?: string;
		oninput?: (value: string) => void;
		error?: string;
		disabled?: boolean;
		showPassword?: boolean;
		errorId?: string;
	} = $props();
</script>

<div class="form-group">
	<label for={id}>
		Current password
		{#if requiredToSave}
			<span class="card__meta">(required to save changes)</span>
		{/if}
	</label>
	<div class="input-wrap">
		<input
			{id}
			{name}
			type={showPassword ? 'text' : 'password'}
			{disabled}
			class="input"
			class:input--error={!!error}
			placeholder="Enter current password"
			{value}
			oninput={(e) => oninput?.(e.currentTarget.value)}
			aria-describedby={error ? errorId : undefined}
			aria-invalid={!!error}
		/>
		<button
			type="button"
			class="input__action"
			onclick={() => (showPassword = !showPassword)}
			{disabled}
			aria-label={showPassword ? 'Hide password' : 'Show password'}
		>
			{#if showPassword}
				<svg class="icon_sm" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L8.05 8.05m1.829 1.829l4.242 4.242M12 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-1.563 3.029m-5.858-.908a3 3 0 01-4.243-4.243"
					/>
				</svg>
			{:else}
				<svg class="icon_sm" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
					/>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
					/>
				</svg>
			{/if}
		</button>
	</div>
	{#if error}
		<p id={errorId} class="form-group__error" role="alert">{error}</p>
	{/if}
</div>
