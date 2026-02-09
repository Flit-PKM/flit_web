<script lang="ts">
	import { resolve } from '$app/paths';
	// About page - generic content
</script>

<svelte:head>
	<title>About - Flit Web</title>
	<meta
		name="description"
		content="Learn more about Flit Web and the Flit-PKM ecosystem for personal knowledge management."
	/>
</svelte:head>

<div class="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
	<div class="rounded-2xl bg-flit-card p-8 shadow-flit-sm backdrop-blur-sm">
		<h1 class="text-3xl font-bold text-flit-ink sm:text-4xl">About Flit-PKM</h1>

		<div class="mt-6 space-y-6 text-flit-ink">
			<section>
				<h2 class="text-2xl font-semibold text-flit-ink">What is Flit?</h2>
				<p class="mt-3 text-flit-muted">
					Flit is a modern Personal Knowledge Management(PKM) ecosystem. It provides a seamless
					blend between your personal notes, insights and knowledge; and powerfull AI analysis,
					summarization and insight generation. Allowing you to find connections and ideas you never thought of.
				</p>
			</section>

			<section>
				<h2 class="text-2xl font-semibold text-flit-ink">Our Mission</h2>
				<p class="mt-3 text-flit-muted">
					We believe that knowledge should be connected, accessible, and easy to navigate. Flit-PKM
					empowers you to build your personal knowledge base with powerful tools for organizing,
					linking, and discovering insights within your notes. Connected apps; including Flit-App(Note taking),
					Still(Meditation and Journaling), and more coming very soon; allow you to bridge the various parts of your life and knowledge.
				</p>
			</section>

			<section>
				<h2 class="text-2xl font-semibold text-flit-ink">Features</h2>
				<ul class="mt-3 space-y-2 text-flit-muted">
					<li class="flex items-start">
						<svg
							class="mr-2 mt-1 h-5 w-5 flex-shrink-0 text-flit-primary"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<span>Secure authentication and Database Encryption</span>
					</li>
					<li class="flex items-start">
						<svg
							class="mr-2 mt-1 h-5 w-5 flex-shrink-0 text-flit-primary"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<span>Knowledge graph building and visualization</span>
					</li>
					<li class="flex items-start">
						<svg
							class="mr-2 mt-1 h-5 w-5 flex-shrink-0 text-flit-primary"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<span>AI relationship analysis, summarization and insight generation</span>	
					</li>
					<li class="flex items-start">
						<svg
							class="mr-2 mt-1 h-5 w-5 flex-shrink-0 text-flit-primary"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<span>Export and import capabilities</span>
					</li>
					<li class="flex items-start">
						<svg
							class="mr-2 mt-1 h-5 w-5 flex-shrink-0 text-flit-primary"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						<span>App Sync and backup capabilities</span>
					</li>
				</ul>
			</section>



			<section>
				<h2 class="text-2xl font-semibold text-flit-ink">Contact</h2>
				<p class="mt-3 text-flit-muted">
					For questions, feedback, or support, please visit
					<a
						href="https://bmd-studios.com"
						target="_blank"
						rel="noopener noreferrer"
						class="font-medium text-flit-link transition-opacity hover:opacity-80"
					>
						BMD-Studios
					</a>
					or email
					<a
						href="mailto:admin@bmd-studios.com"
						class="font-medium text-flit-link transition-opacity hover:opacity-80"
					>
						admin@bmd-studios.com
					</a>.
				</p>
			</section>
		</div>

		<div class="mt-8 border-t border-flit-muted/20 pt-6">
			<a
				href={resolve('/')}
				class="inline-flex items-center text-sm font-medium text-flit-link transition-colors hover:text-flit-ink"
			>
				← Back to Home
			</a>
		</div>
	</div>
</div>
