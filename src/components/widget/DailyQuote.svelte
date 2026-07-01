<script>
	const quotes = [
		{ jp: '好きこそものの上手なれ', zh: '爱好才能精通' },
		{ jp: '一期一会', zh: '一生一次的相遇，珍惜当下' },
		{ jp: '石の上にも三年', zh: '功到自然成' },
		{ jp: '継続は力なり', zh: '坚持就是力量' },
		{ jp: '七転び八起き', zh: '百折不挠，跌倒七次站起八次' },
		{ jp: '塵も積もれば山となる', zh: '积少成多，聚沙成塔' },
		{ jp: '急がば回れ', zh: '欲速则不达' },
		{ jp: '明日は明日の風が吹く', zh: '明天自有明天的风，顺其自然' },
		{ jp: '花鳥風月', zh: '风花雪月，感受自然之美' },
		{ jp: '一日一歩', zh: '每天进步一点点' },
		{ jp: '初心忘るべからず', zh: '勿忘初心' },
		{ jp: '住めば都', zh: '久居为安，习惯成自然' },
		{ jp: '猿も木から落ちる', zh: '智者千虑，必有一失' },
		{ jp: '井の中の蛙大海を知らず', zh: '井底之蛙，不知大海' },
		{ jp: '千里の道も一歩から', zh: '千里之行，始于足下' },
	];

	let index = $state(Math.floor(Math.random() * quotes.length));
	let fade = $state(true);

	function next() {
		fade = false;
		setTimeout(() => {
			index = (index + 1) % quotes.length;
			fade = true;
		}, 200);
	}

	$effect(() => {
		const timer = setInterval(next, 8000);
		return () => clearInterval(timer);
	});
</script>

<div class="card-base p-3">
	<div class="flex items-center gap-1.5 mb-2">
		<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-[var(--primary)]">
			<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/>
			<path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>
		</svg>
		<span class="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">一言</span>
		<button onclick={next} class="ml-auto text-neutral-400 hover:text-[var(--primary)] transition" title="换一句">
			<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
				<path d="M21 3v5h-5"/>
			</svg>
		</button>
	</div>
	<div class="transition-opacity duration-200" class:opacity-0={!fade} class:opacity-100={fade} aria-live="polite">
		<p class="text-sm text-black/75 dark:text-white/75 leading-relaxed mb-1">{quotes[index].jp}</p>
		<p class="text-xs text-black/40 dark:text-white/40 text-right">{quotes[index].zh}</p>
	</div>
</div>
