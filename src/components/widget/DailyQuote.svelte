<script>
	let quote = $state('');
	let author = $state('');
	let loaded = $state(false);

	async function fetchQuote() {
		try {
			const res = await fetch('https://v1.hitokoto.cn/?c=a&c=b&c=c&c=d&c=e&c=f&c=g&c=h&c=i&c=j&c=k&c=l');
			const data = await res.json();
			quote = data.hitokoto;
			author = data.from || '佚名';
			loaded = true;
		} catch {
			quote = '好きこそものの上手なれ';
			author = 'ことわざ';
			loaded = true;
		}
	}

	$effect(() => {
		fetchQuote();
	});
</script>

<div class="card-base p-3">
	<div class="flex items-center gap-1.5 mb-2">
		<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[var(--primary)]">
			<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/>
			<path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>
		</svg>
		<span class="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">一言</span>
		<button onclick={fetchQuote} class="ml-auto text-neutral-400 hover:text-[var(--primary)] transition" title="换一句">
			<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
				<path d="M21 3v5h-5"/>
			</svg>
		</button>
	</div>
	{#if loaded}
		<p class="text-sm text-black/75 dark:text-white/75 leading-relaxed mb-1.5">{quote}</p>
		<p class="text-xs text-black/40 dark:text-white/40 text-right">—— {author}</p>
	{:else}
		<p class="text-sm text-black/30 dark:text-white/30 animate-pulse">加载中...</p>
	{/if}
</div>
