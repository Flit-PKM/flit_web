<script lang="ts">
	import { onMount } from 'svelte';
	import { apiClient, getMcpServerUrl } from '$lib/api/client';
	import { confirmAction } from '$lib/stores/confirmDialog';
	import { captureApiError } from '$lib/utils/error-handler';
	import { formatProfileDate } from '$lib/utils/profile';
	import type { ConnectedApp } from '$lib/types/connect';
	import { normalizeMcpApiKey, type McpApiKey, type McpApiKeyScope } from '$lib/types/mcp';

	type ActivePanel = 'none' | 'native-code' | 'mcp-create' | 'mcp-reveal';

	let connectedApps = $state<ConnectedApp[]>([]);
	let mcpApiKeys = $state<McpApiKey[]>([]);
	let listLoading = $state(true);
	let connectedAppsError = $state('');
	let mcpApiKeysError = $state('');
	let revokeError = $state('');

	let activePanel = $state<ActivePanel>('none');

	// Native connect
	let connectCode = $state('');
	let connectCodeExpiresIn = $state<number | undefined>(undefined);
	let connectCodeLoading = $state(false);
	let connectCodeError = $state('');
	let connectCodeCopied = $state(false);

	// MCP key create
	let mcpKeyName = $state('');
	let mcpKeyScope = $state<McpApiKeyScope>('read');
	let mcpCreateLoading = $state(false);
	let mcpCreateError = $state('');
	let revealedApiKey = $state('');
	let apiKeyCopied = $state(false);

	let revokingAppId = $state<number | null>(null);
	let revokingKeyId = $state<number | null>(null);

	let activeConnectedApps = $derived.by(() => connectedApps.filter((app) => app.is_active));
	let inactiveConnectedApps = $derived.by(() => connectedApps.filter((app) => !app.is_active));
	const mcpServerUrl = getMcpServerUrl();

	let showConnectionsHelp = $state(false);

	function closeConnectionsHelp() {
		showConnectionsHelp = false;
	}

	function handleConnectionsHelpKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') closeConnectionsHelp();
	}

	async function loadConnections() {
		listLoading = true;
		connectedAppsError = '';
		mcpApiKeysError = '';

		const [appsResult, keysResult] = await Promise.allSettled([
			apiClient.getConnectedApps(),
			apiClient.getMcpApiKeys()
		]);

		if (appsResult.status === 'fulfilled') {
			connectedApps = appsResult.value;
		} else {
			connectedAppsError = captureApiError(appsResult.reason, {
				component: 'ConnectedAppsSection',
				operation: 'loadConnectedApps'
			});
		}

		if (keysResult.status === 'fulfilled') {
			mcpApiKeys = keysResult.value;
		} else {
			mcpApiKeysError = captureApiError(keysResult.reason, {
				component: 'ConnectedAppsSection',
				operation: 'loadMcpApiKeys'
			});
		}

		listLoading = false;
	}

	onMount(() => {
		void loadConnections();
	});

	function closePanels() {
		activePanel = 'none';
		connectCodeError = '';
		mcpCreateError = '';
	}

	function openMcpCreate() {
		closePanels();
		activePanel = 'mcp-create';
		mcpKeyName = '';
		mcpKeyScope = 'read';
		revealedApiKey = '';
		apiKeyCopied = false;
	}

	async function handleConnectApp() {
		closePanels();
		connectCodeError = '';
		connectCode = '';
		connectCodeExpiresIn = undefined;
		connectCodeCopied = false;
		connectCodeLoading = true;
		try {
			const res = await apiClient.requestConnectCode();
			connectCode = res.connection_code;
			connectCodeExpiresIn = res.expires_in;
			activePanel = 'native-code';
		} catch (err) {
			connectCodeError = captureApiError(err, {
				component: 'ConnectedAppsSection',
				operation: 'requestConnectCode'
			});
		} finally {
			connectCodeLoading = false;
		}
	}

	async function handleCopyCode() {
		if (!connectCode) return;
		connectCodeCopied = false;
		try {
			await navigator.clipboard.writeText(connectCode);
			connectCodeCopied = true;
			setTimeout(() => (connectCodeCopied = false), 2000);
		} catch {
			connectCodeError = 'Could not copy to clipboard.';
		}
	}

	function handleCloseConnectCode() {
		connectCode = '';
		connectCodeExpiresIn = undefined;
		connectCodeError = '';
		connectCodeCopied = false;
		activePanel = 'none';
	}

	async function handleRevokeConnectedApp(appId: number, label: string) {
		if (!(await confirmAction(`Revoke native app "${label}"? It will need to pair again.`))) {
			return;
		}
		revokeError = '';
		revokingAppId = appId;
		try {
			await apiClient.revokeConnectedApp(appId);
			connectedApps = connectedApps.filter((app) => app.id !== appId);
		} catch (err) {
			revokeError = captureApiError(err, {
				component: 'ConnectedAppsSection',
				operation: 'revokeConnectedApp',
				appId
			});
		} finally {
			revokingAppId = null;
		}
	}

	async function handleCreateMcpKey(event: Event) {
		event.preventDefault();
		const name = mcpKeyName.trim();
		if (!name) return;

		mcpCreateError = '';
		mcpCreateLoading = true;
		try {
			const created = await apiClient.createMcpApiKey({ name, scope: mcpKeyScope });
			revealedApiKey = created.api_key;
			const normalized = normalizeMcpApiKey(created, 0);
			if (normalized) {
				mcpApiKeys = [{ ...normalized, last_used_at: null }, ...mcpApiKeys];
			}
			mcpKeyName = '';
			activePanel = 'mcp-reveal';
		} catch (err) {
			mcpCreateError = captureApiError(err, {
				component: 'ConnectedAppsSection',
				operation: 'createMcpApiKey'
			});
		} finally {
			mcpCreateLoading = false;
		}
	}

	async function handleCopyApiKey() {
		if (!revealedApiKey) return;
		apiKeyCopied = false;
		try {
			await navigator.clipboard.writeText(revealedApiKey);
			apiKeyCopied = true;
			setTimeout(() => (apiKeyCopied = false), 2000);
		} catch {
			mcpCreateError = 'Could not copy to clipboard.';
		}
	}

	function handleCloseApiKeyReveal() {
		revealedApiKey = '';
		apiKeyCopied = false;
		mcpCreateError = '';
		activePanel = 'none';
	}

	async function handleDeleteMcpKey(keyId: number, name: string) {
		if (!(await confirmAction(`Revoke Bearer token "${name}"? This cannot be undone.`))) {
			return;
		}
		revokeError = '';
		revokingKeyId = keyId;
		try {
			await apiClient.deleteMcpApiKey(keyId);
			mcpApiKeys = mcpApiKeys.filter((key) => key.id !== keyId);
		} catch (err) {
			revokeError = captureApiError(err, {
				component: 'ConnectedAppsSection',
				operation: 'deleteMcpApiKey',
				keyId
			});
		} finally {
			revokingKeyId = null;
		}
	}

	function formatLastUsed(at: string | null): string {
		if (!at) return 'Never used';
		return `Last used ${formatProfileDate(at)}`;
	}
</script>

<div class="card">
	<div class="notes-transfer__header notes-transfer__header--balanced">
		<div class="notes-transfer__header-title">
			<h2>Connected Apps</h2>
			<p class="card__meta connections__subtitle">
				Link Flit native apps with a pairing code, or connect MCP clients with a Bearer token.
			</p>
		</div>
		<button
			type="button"
			class="btn btn--compact notes-transfer__help-btn"
			onclick={() => (showConnectionsHelp = true)}
			aria-label="Open connected apps help"
		>
			<svg class="icon_sm" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			Help
		</button>
	</div>

	{#if connectedAppsError || mcpApiKeysError || revokeError}
		<div class="alert alert--error" role="alert">
			<svg class="alert__icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
				<path
					fill-rule="evenodd"
					d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
					clip-rule="evenodd"
				/>
			</svg>
			<div class="alert__message card__block">
				{#if connectedAppsError}
					<p>{connectedAppsError}</p>
				{/if}
				{#if mcpApiKeysError}
					<p>{mcpApiKeysError}</p>
				{/if}
				{#if revokeError}
					<p>{revokeError}</p>
				{/if}
				{#if connectedAppsError || mcpApiKeysError}
					<button type="button" class="btn btn-secondary mt-sm" onclick={() => loadConnections()}>
						Retry
					</button>
				{/if}
			</div>
		</div>
	{/if}

	{#if listLoading}
		<div class="loading loading--muted">
			<span class="loading__spinner" aria-hidden="true">
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
					<circle
						class="loading__spinner-inner"
						cx="12"
						cy="12"
						r="10"
						stroke="currentColor"
						stroke-width="4"
					></circle>
					<path
						class="loading__spinner-path"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					></path>
				</svg>
			</span>
			<span>Loading connections…</span>
		</div>
	{:else}
		<div class="connections__groups">
			<section aria-labelledby="connections-native-heading">
				<h3 id="connections-native-heading" class="connections__group-title">Native apps</h3>
				{#if activeConnectedApps.length > 0 || inactiveConnectedApps.length > 0}
					<ul class="connections__list">
						{#each activeConnectedApps as app, index (`native-${app.id}-${index}`)}
							<li class="connections__row">
								<div class="connections__row-main">
									<p class="connections__row-title">{app.app_name || app.device_name}</p>
									<p class="connections__row-meta">
										{app.device_name}
										{#if app.platform}
											<span class="profile-status-dot">•</span>
											{app.platform}
										{/if}
									</p>
									<p class="connections__row-meta">
										Connected {formatProfileDate(app.created_at)}
									</p>
								</div>
								<div class="connections__row-side">
									<span class="badge badge--positive">Active</span>
									<button
										type="button"
										class="btn btn--compact"
										onclick={() =>
											handleRevokeConnectedApp(app.id, app.app_name || app.device_name)}
										disabled={revokingAppId === app.id}
										aria-label={`Revoke ${app.app_name || app.device_name}`}
									>
										{#if revokingAppId === app.id}
											Revoking…
										{:else}
											Revoke
										{/if}
									</button>
								</div>
							</li>
						{/each}
					</ul>
					{#if inactiveConnectedApps.length > 0}
						<details class="connections__inactive mt-sm">
							<summary class="card__meta">
								Inactive devices ({inactiveConnectedApps.length})
							</summary>
							<ul class="connections__list connections__inactive-list">
								{#each inactiveConnectedApps as app, index (`native-inactive-${app.id}-${index}`)}
									<li class="connections__row">
										<div class="connections__row-main">
											<p class="connections__row-title">{app.app_name || app.device_name}</p>
											<p class="connections__row-meta">
												{app.device_name}
												{#if app.platform}
													<span class="profile-status-dot">•</span>
													{app.platform}
												{/if}
											</p>
											<p class="connections__row-meta">
												Connected {formatProfileDate(app.created_at)}
											</p>
										</div>
										<div class="connections__row-side">
											<span class="badge badge--muted">Inactive</span>
										</div>
									</li>
								{/each}
							</ul>
						</details>
					{/if}
				{:else}
					<p class="card__meta">No native apps connected.</p>
				{/if}
			</section>

			{#if activePanel === 'none'}
				<div class="connections__native-action">
					<button
						type="button"
						class="btn btn-primary"
						onclick={() => void handleConnectApp()}
						disabled={connectCodeLoading}
						aria-label="Connect a native app with a pairing code"
					>
						{#if connectCodeLoading}
							Requesting…
						{:else}
							+ Connect Native App
						{/if}
					</button>
				</div>
			{/if}

			<section aria-labelledby="connections-mcp-heading">
				<h3 id="connections-mcp-heading" class="connections__group-title">MCP Bearer tokens</h3>
				<p class="card__meta connections__mcp-intro">
					Connect MCP-compatible agents and tools to your notes using this server URL. Authenticate
					with a Bearer token you create below.
				</p>
				<p class="connections__mcp-url">
					<code class="connections__mcp-url-code">{mcpServerUrl}</code>
				</p>
				{#if mcpApiKeys.length > 0}
					<ul class="connections__list">
						{#each mcpApiKeys as key, index (`mcp-${key.id}-${index}`)}
							<li class="connections__row">
								<div class="connections__row-main">
									<p class="connections__row-title">{key.name}</p>
									<p class="connections__row-meta">{key.key_prefix}…</p>
									<p class="connections__row-meta">Scope: {key.scopes}</p>
									<p class="connections__row-meta">
										Created {formatProfileDate(key.created_at)} · {formatLastUsed(key.last_used_at)}
									</p>
								</div>
								<div class="connections__row-side">
									<button
										type="button"
										class="btn btn--compact"
										onclick={() => handleDeleteMcpKey(key.id, key.name)}
										disabled={revokingKeyId === key.id}
										aria-label={`Revoke Bearer token ${key.name}`}
									>
										{#if revokingKeyId === key.id}
											Revoking…
										{:else}
											Revoke token
										{/if}
									</button>
								</div>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="card__meta">No Bearer tokens yet.</p>
				{/if}
			</section>
		</div>
	{/if}

	{#if activePanel === 'native-code' && connectCode}
		<div class="connections__panel" role="region" aria-label="Connection code">
			{#if connectCodeError}
				<div class="alert alert--error" role="alert">
					<p class="alert__message">{connectCodeError}</p>
				</div>
			{/if}
			<p class="card__meta">Enter this code in the native app you want to connect to Flit Core.</p>
			<div class="connections__secret" aria-label="Connection code">{connectCode}</div>
			{#if connectCodeExpiresIn != null && connectCodeExpiresIn > 0}
				{@const minutes = Math.ceil(connectCodeExpiresIn / 60)}
				<p class="card__meta">
					This code expires in {minutes} minute{minutes === 1 ? '' : 's'}.
				</p>
			{/if}
			<div class="connections__panel-actions">
				<button
					type="button"
					class="btn"
					onclick={handleCopyCode}
					aria-label="Copy connection code"
				>
					{connectCodeCopied ? 'Copied!' : 'Copy'}
				</button>
				<button
					type="button"
					class="btn"
					onclick={handleConnectApp}
					disabled={connectCodeLoading}
					aria-label="Get new connection code"
				>
					Get new code
				</button>
				<button
					type="button"
					class="btn btn-primary"
					onclick={handleCloseConnectCode}
					aria-label="Close connection code"
				>
					Close
				</button>
			</div>
		</div>
	{:else if activePanel === 'mcp-reveal' && revealedApiKey}
		<div class="connections__panel" role="region" aria-label="New Bearer token">
			<p class="card__meta">
				Copy this Bearer token now. It will not be shown again - only the prefix is stored.
			</p>
			<div class="connections__secret" aria-label="Bearer token">{revealedApiKey}</div>
			<div class="connections__panel-actions">
				<button type="button" class="btn" onclick={handleCopyApiKey} aria-label="Copy Bearer token">
					{apiKeyCopied ? 'Copied!' : 'Copy'}
				</button>
				<button type="button" class="btn btn-primary" onclick={handleCloseApiKeyReveal}>
					Close
				</button>
			</div>
		</div>
	{:else if activePanel === 'mcp-create'}
		<div class="connections__panel" role="region" aria-label="Create Bearer token">
			<form class="card__column" onsubmit={handleCreateMcpKey}>
				<div class="form-group">
					<label for="mcp-key-name">Key name</label>
					<input
						id="mcp-key-name"
						type="text"
						class="input wide"
						placeholder="e.g. Cursor, Claude Desktop"
						bind:value={mcpKeyName}
						disabled={mcpCreateLoading}
						required
						maxlength="255"
					/>
				</div>
				<div class="form-group">
					<span id="mcp-key-scope-label" class="card__label">Access</span>
					<div
						class="connections__scope-picker"
						role="radiogroup"
						aria-labelledby="mcp-key-scope-label"
					>
						<label
							class="radio-card"
							class:radio-card--selected={mcpKeyScope === 'read'}
							for="mcp-key-scope-read"
						>
							<input
								id="mcp-key-scope-read"
								type="radio"
								name="mcp-key-scope"
								value="read"
								bind:group={mcpKeyScope}
								disabled={mcpCreateLoading}
							/>
							<div class="radio-card__content">
								<span class="radio-card__title">Read only</span>
								<p class="muted">List and read notes, categories, and relationships</p>
							</div>
						</label>
						<label
							class="radio-card"
							class:radio-card--selected={mcpKeyScope === 'read write'}
							for="mcp-key-scope-write"
						>
							<input
								id="mcp-key-scope-write"
								type="radio"
								name="mcp-key-scope"
								value="read write"
								bind:group={mcpKeyScope}
								disabled={mcpCreateLoading}
							/>
							<div class="radio-card__content">
								<span class="radio-card__title">Read &amp; write</span>
								<p class="muted">Create, update, and delete via MCP</p>
							</div>
						</label>
					</div>
				</div>
				{#if mcpCreateError}
					<div class="alert alert--error" role="alert">
						<p class="alert__message">{mcpCreateError}</p>
					</div>
				{/if}
				<div class="connections__panel-actions">
					<button
						type="submit"
						class="btn btn-primary"
						disabled={mcpCreateLoading || !mcpKeyName.trim()}
					>
						{#if mcpCreateLoading}
							Creating…
						{:else}
							Create Bearer token
						{/if}
					</button>
					<button
						type="button"
						class="btn"
						disabled={mcpCreateLoading}
						onclick={() => (activePanel = 'none')}
					>
						Cancel
					</button>
				</div>
			</form>
		</div>
	{/if}

	{#if connectCodeError && activePanel === 'none'}
		<div class="alert alert--error mt-sm" role="alert">
			<p class="alert__message">{connectCodeError}</p>
		</div>
	{/if}

	{#if activePanel === 'none'}
		<div class="connections__actions">
			<button
				type="button"
				class="btn btn-secondary"
				onclick={openMcpCreate}
				disabled={connectCodeLoading}
				aria-label="Create an MCP Bearer token"
			>
				+ Request Bearer Token
			</button>
		</div>
	{/if}
</div>

{#if showConnectionsHelp}
	<div
		class="modal-backdrop modal-backdrop--overlay"
		tabindex="-1"
		role="dialog"
		aria-modal="true"
		aria-labelledby="connected-apps-help-title"
		onkeydown={handleConnectionsHelpKeydown}
		onclick={(e) => e.target === e.currentTarget && closeConnectionsHelp()}
	>
		<div class="card notes-transfer-help" role="document">
			<div class="notes-transfer__header">
				<h2 id="connected-apps-help-title" class="section-title--muted">Connected apps help</h2>
				<button
					type="button"
					class="btn btn--compact"
					onclick={closeConnectionsHelp}
					aria-label="Close help"
				>
					Close
				</button>
			</div>

			<div class="notes-transfer-help__body">
				<section>
					<h3 class="notes-transfer-help__heading">Native Apps</h3>
					<ul class="notes-transfer-help__list">
						<li>
							Click <code>+ Connect Native App</code> to generate a short-lived pairing code.
						</li>
						<li>
							The code expires after a short time. If it expires, click <code
								>+ Connect Native App</code
							> again.
						</li>
						<li>Enter the code in the native app you want to connect to Flit Core.</li>
						<li>The connected device then shows up in this section.</li>
						<li>
							To disconnect later, use <code>Revoke</code>. You will need to pair again to connect
							that device.
						</li>
					</ul>
				</section>

				<section>
					<h3 class="notes-transfer-help__heading">MCP with OAuth flow</h3>
					<ul class="notes-transfer-help__list">
						<li>MCP endpoints are hosted under <code>{mcpServerUrl}</code>.</li>
						<li>Authorize your mcp tool and choose the scope you need: <code>read</code> or <code>read &amp; write</code>.</li>
						<li>After login and consent, your MCP tool can connect to Flit Core.</li>
					</ul>
				</section>

				<section>
					<h3 class="notes-transfer-help__heading">MCP with Bearer tokens</h3>
					<ul class="notes-transfer-help__list">
						<li>
							Click <code>+ Request Bearer Token</code> and choose the scope you need:
							<code>read</code> or <code>read &amp; write</code>.
						</li>
						<li>
							After creating a Bearer token, copy it immediately. Flit only shows the full token details
							once.
						</li>
						<li>
							Enter the copied Bearer token details into the tool that requested them.
						</li>
						<li>To remove access, revoke the Bearer token from this page.</li>
					</ul>
				</section>
			</div>

			<div class="confirm-dialog__actions">
				<button type="button" class="btn btn-primary" onclick={closeConnectionsHelp}>Got it</button>
			</div>
		</div>
	</div>
{/if}
