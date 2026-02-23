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

<div class="mb-4">
	<label for={id} class="mb-2 block text-sm font-medium text-flit-ink">
		Current password
		{#if requiredToSave}
			<span class="text-flit-muted">(required to save changes)</span>
		{/if}
	</label>
	<div class="relative">
		<input
			{id}
			{name}
			type={showPassword ? 'text' : 'password'}
			{disabled}
			class="input pr-10 backdrop-blur-sm transition-colors disabled:cursor-not-allowed"
			class:border-flit-negative={!!error}
			class:focus:ring-flit-negative={!!error}
			class:focus:border-flit-negative={!!error}
			placeholder="Enter current password"
			{value}
			oninput={(e) => oninput?.(e.currentTarget.value)}
			aria-describedby={error ? errorId : undefined}
			aria-invalid={!!error}
		/>
		<button
			type="button"
			class="absolute inset-y-0 right-0 flex items-center pr-3 text-flit-muted transition-opacity hover:opacity-80"
			onclick={() => (showPassword = !showPassword)}
			{disabled}
			aria-label={showPassword ? 'Hide password' : 'Show password'}
		>
			{#if showPassword}
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L8.05 8.05m1.829 1.829l4.242 4.242M12 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-1.563 3.029m-5.858-.908a3 3 0 01-4.243-4.243"
					/>
				</svg>
			{:else}
				<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
		<p id={errorId} class="mt-1 text-sm text-flit-negative" role="alert">
			{error}
		</p>
	{/if}
</div>
