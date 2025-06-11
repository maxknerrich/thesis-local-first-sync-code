<script lang="ts">
	import { onDestroy, onMount } from "svelte";

	const PR = Math.round(window.devicePixelRatio || 1);
	const FRAME_BAR_WIDTH = 2;

	interface FPSMeterProps {
		width?: number;
		height?: number;
		systemFps?: number;
		className?: string;
	}

	const FRAME_HIT = 1;
	const FRAME_MISS = 0;
	const FRAME_UNINITIALIZED = -1;

	// Props with defaults
	let {
		width = 120,
		height = 30,
		systemFps = 60,
		className = "",
	}: FPSMeterProps = $props();

	// Calculate adjusted dimensions
	const adjustedWidth = $derived(Math.round(width * PR));
	const adjustedHeight = $derived(Math.round(height * PR));

	const numberOfVisibleFrames = $derived(
		Math.floor(adjustedWidth / FRAME_BAR_WIDTH),
	);
	const resolutionInMs = $derived(1000 / systemFps);

	// NOTE larger values can result in more items taken from array than it has and makes stuff go boom
	const numberOfSecondsForAverageFps = 2;

	// Depending on bar size and screen refresh rate, it can happen that the count of visible frames
	// is smaller than the count of frames used for calculating the average FPS.
	// To avoid this case, we force the number of frames used to calculate average FPS to always be less
	// than the number of visible frames.
	const numberOfFramesForAverageFps = $derived(
		Math.min(numberOfSecondsForAverageFps * systemFps, numberOfVisibleFrames),
	);

	let animationFrameRef: number | undefined = undefined;
	let canvasElement: HTMLCanvasElement;

	function setupCanvas(canvas: HTMLCanvasElement) {
		if (animationFrameRef !== undefined) {
			window.cancelAnimationFrame(animationFrameRef);
		}

		if (numberOfFramesForAverageFps > numberOfVisibleFrames) {
			throw new Error(
				`numberOfFramesForAverageFps (${numberOfFramesForAverageFps}) must be smaller than numberOfVisibleFrames (${numberOfVisibleFrames}). Either increase the width or increase the resolutionInMs.`,
			);
		}

		const frames: number[] = new Array(numberOfVisibleFrames).fill(
			FRAME_UNINITIALIZED,
		);
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const draw = () => {
			ctx.clearRect(0, 0, adjustedWidth, adjustedHeight);

			for (let i = 0; i < numberOfVisibleFrames; i++) {
				const frameHit = frames[i];
				if (frameHit == null || frameHit === FRAME_UNINITIALIZED) continue;

				const x = i * FRAME_BAR_WIDTH;

				ctx.fillStyle =
					frameHit > 0 ? "rgba(255, 255, 255, 0.3)" : "rgba(255, 0, 0, 1)";
				ctx.fillRect(x, adjustedHeight, FRAME_BAR_WIDTH, -adjustedHeight);
			}

			let frameCount = 0;
			let numberOfInitializedFrames = 0;
			for (let i = 0; i < numberOfFramesForAverageFps; i++) {
				const frameHit = frames.at(-i - 1);
				if (frameHit != null && frameHit !== FRAME_UNINITIALIZED) {
					frameCount += frameHit;
					numberOfInitializedFrames++;
				}
			}
			if (numberOfInitializedFrames >= numberOfFramesForAverageFps) {
				ctx.fillStyle = "white";
				const fontSize = PR * 10;
				ctx.font = `${fontSize}px monospace`;

				const averageFps = Math.round(
					(systemFps * frameCount) / numberOfInitializedFrames,
				);
				ctx.fillText(`${averageFps} FPS`, 2 * PR, adjustedHeight - 3 * PR);
			}
		};

		let previousFrameCounter = 0;

		const loop = () => {
			animationFrameRef = window.requestAnimationFrame((now) => {
				loop();

				const frameCounter = Math.floor(now / resolutionInMs);
				const numberOfSkippedFrames = frameCounter - previousFrameCounter - 1;

				// Checking for skipped frames
				for (let i = 0; i < numberOfSkippedFrames; i++) {
					frames.shift();
					frames.push(FRAME_MISS);
				}

				frames.shift();
				frames.push(FRAME_HIT);

				previousFrameCounter = frameCounter;

				draw();
			});
		};

		loop();
	}

	onMount(() => {
		if (canvasElement) {
			setupCanvas(canvasElement);
		}
	});

	onDestroy(() => {
		if (animationFrameRef !== undefined) {
			window.cancelAnimationFrame(animationFrameRef);
		}
	});

	// Reactive effect to restart animation when props change
	$effect(() => {
		if (canvasElement) {
			setupCanvas(canvasElement);
		}
	});
</script>

<canvas
	bind:this={canvasElement}
	width={adjustedWidth}
	height={adjustedHeight}
	class={className}
	style:width="{width}px"
	style:height="{height}px"
></canvas>

<style>
	canvas {
		position: absolute;
		top: 16px;
		right: 16px;
		background-color: black;
	}
</style>
