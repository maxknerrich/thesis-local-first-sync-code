interface QueueItem {
	id: string;
	operation: () => Promise<unknown>;
	resolve: (value: unknown) => void;
	reject: (error: Error) => void;
	addedAt: number;
}

interface RateLimitState {
	requestCount: number;
	windowStart: number;
	lastRequestTime: number;
}

export class PushQueue {
	private queue: QueueItem[] = [];
	private processing = new Set<string>();
	private isDone = false;
	private queuePromise: Promise<void> | null = null;
	private queueResolve: (() => void) | null = null;
	private queueReject: ((error: Error) => void) | null = null;

	// Rate limiting
	private readonly maxConcurrent: number;
	private readonly maxUpdatesPerMinute: number;
	private rateLimitState: RateLimitState = {
		requestCount: 0,
		windowStart: Date.now(),
		lastRequestTime: 0,
	};

	// Processing state
	private processingInterval: ReturnType<typeof setInterval> | null = null;
	private isProcessing = false;

	constructor(maxConcurrent: number = 100, maxUpdatesPerMinute: number = 180) {
		this.maxConcurrent = maxConcurrent;
		this.maxUpdatesPerMinute = maxUpdatesPerMinute;
		this.start();
	}

	/**
	 * Add an operation to the queue
	 */
	async add<T>(operation: () => Promise<T>): Promise<T> {
		if (this.isDone) {
			throw new Error('Queue is marked as done - no new items can be added');
		}

		return new Promise<T>((resolve, reject) => {
			const item: QueueItem = {
				id: Math.random().toString(36).substr(2, 9),
				operation: operation as () => Promise<unknown>,
				resolve: resolve as (value: unknown) => void,
				reject,
				addedAt: Date.now(),
			};

			this.queue.push(item);
		});
	}

	/**
	 * Mark the queue as done - no new items will be accepted
	 * Returns a promise that resolves when all items are processed
	 */
	async done(): Promise<void> {
		this.isDone = true;

		if (this.queuePromise) {
			return this.queuePromise;
		}

		this.queuePromise = new Promise<void>((resolve, reject) => {
			this.queueResolve = resolve;
			this.queueReject = reject;

			// Check if we're already empty
			if (this.queue.length === 0 && this.processing.size === 0) {
				resolve();
			}
		});

		return this.queuePromise;
	}

	/**
	 * Get current queue status
	 */
	getStatus() {
		return {
			queueLength: this.queue.length,
			processing: this.processing.size,
			isDone: this.isDone,
			rateLimitState: { ...this.rateLimitState },
		};
	}

	private start() {
		if (this.processingInterval) {
			return;
		}

		this.processingInterval = setInterval(() => {
			this.processQueue();
		}, 100); // Check every 100ms
	}

	private async processQueue() {
		if (this.isProcessing) {
			return;
		}

		this.isProcessing = true;

		try {
			// Clean up rate limit window if needed
			this.cleanupRateLimit();

			// Process items while we have capacity
			while (this.canProcessMore() && this.queue.length > 0) {
				const item = this.queue.shift();
				if (item) {
					this.processItem(item);
				}
			}

			// Check if we should resolve the done promise
			this.checkDoneCondition();
		} finally {
			this.isProcessing = false;
		}
	}

	private canProcessMore(): boolean {
		// Check concurrent limit
		if (this.processing.size >= this.maxConcurrent) {
			return false;
		}

		// Check rate limit
		const now = Date.now();
		const timeSinceLastRequest = now - this.rateLimitState.lastRequestTime;
		const minIntervalMs = (60 * 1000) / this.maxUpdatesPerMinute; // Convert to ms between requests

		if (timeSinceLastRequest < minIntervalMs) {
			return false;
		}

		// Check if we're within the rate limit window
		if (this.rateLimitState.requestCount >= this.maxUpdatesPerMinute) {
			return false;
		}

		return true;
	}

	private cleanupRateLimit() {
		const now = Date.now();
		const windowDuration = 60 * 1000; // 1 minute in ms

		// Reset window if it's been more than a minute
		if (now - this.rateLimitState.windowStart >= windowDuration) {
			this.rateLimitState.requestCount = 0;
			this.rateLimitState.windowStart = now;
		}
	}

	private async processItem(item: QueueItem) {
		this.processing.add(item.id);

		// Update rate limiting
		const now = Date.now();
		this.rateLimitState.requestCount++;
		this.rateLimitState.lastRequestTime = now;

		try {
			const result = await item.operation();
			item.resolve(result);
		} catch (error) {
			item.reject(error instanceof Error ? error : new Error(String(error)));
		} finally {
			this.processing.delete(item.id);
			this.checkDoneCondition();
		}
	}

	private checkDoneCondition() {
		if (this.isDone && this.queue.length === 0 && this.processing.size === 0) {
			if (this.queueResolve) {
				this.queueResolve();
				this.queueResolve = null;
				this.queueReject = null;
			}

			// Clean up the interval
			if (this.processingInterval) {
				clearInterval(this.processingInterval);
				this.processingInterval = null;
			}
		}
	}

	/**
	 * Stop the queue and reject any pending operations
	 */
	stop() {
		if (this.processingInterval) {
			clearInterval(this.processingInterval);
			this.processingInterval = null;
		}

		// Reject all pending items
		for (const item of this.queue) {
			item.reject(new Error('Queue stopped'));
		}
		this.queue = [];

		// Reject the done promise if it exists
		if (this.queueReject) {
			this.queueReject(new Error('Queue stopped'));
			this.queueResolve = null;
			this.queueReject = null;
		}
	}

	/**
	 * Pause the queue processing
	 */
	pause() {
		if (this.processingInterval) {
			clearInterval(this.processingInterval);
			this.processingInterval = null;
		}
	}

	/**
	 * Resume the queue processing
	 */
	resume() {
		if (!this.processingInterval) {
			this.start();
		}
	}

	/**
	 * Clear all pending operations (does not affect currently processing items)
	 */
	clear() {
		// Reject all pending items
		for (const item of this.queue) {
			item.reject(new Error('Queue cleared'));
		}
		this.queue = [];
	}

	/**
	 * Get the number of pending operations in the queue
	 */
	get queueSize(): number {
		return this.queue.length;
	}

	/**
	 * Get the number of currently processing operations
	 */
	get processingCount(): number {
		return this.processing.size;
	}

	/**
	 * Check if the queue is currently processing items
	 */
	get isActive(): boolean {
		return this.processingInterval !== null;
	}
}
