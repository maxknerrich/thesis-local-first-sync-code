import { PushQueue } from './pushQueue';

// Mock async operation that simulates API calls
const mockApiCall = (
	id: number,
	delay: number = 100,
): Promise<{ id: number; result: string }> => {
	return new Promise((resolve) => {
		setTimeout(() => {
			resolve({ id, result: `Processed ${id}` });
		}, delay);
	});
};

// Test basic queue functionality
async function testBasicQueue() {
	console.log('Testing basic queue functionality...');
	const queue = new PushQueue(5, 60); // 5 concurrent, 60 per minute

	// Add some operations
	const promises = [];
	for (let i = 0; i < 10; i++) {
		promises.push(queue.add(() => mockApiCall(i, 50)));
	}

	// Mark as done and wait for completion
	const donePromise = queue.done();

	// Wait for all individual operations and the queue to be done
	const [results] = await Promise.all([Promise.all(promises), donePromise]);

	console.log('All operations completed:', results);
	console.log('Queue status:', queue.getStatus());
}

// Test rate limiting
async function testRateLimit() {
	console.log('Testing rate limiting...');
	const queue = new PushQueue(2, 10); // 2 concurrent, 10 per minute (very restrictive)

	const startTime = Date.now();
	const promises = [];

	for (let i = 0; i < 5; i++) {
		promises.push(queue.add(() => mockApiCall(i, 10)));
	}

	await queue.done();
	const endTime = Date.now();

	console.log(`Rate limited queue completed in ${endTime - startTime}ms`);
	console.log('Queue status:', queue.getStatus());
}

// Test error handling
async function testErrorHandling() {
	console.log('Testing error handling...');
	const queue = new PushQueue(3, 60);

	// Add operations that will succeed and fail
	const promises = [
		queue.add(() => mockApiCall(1)),
		queue.add(() => Promise.reject(new Error('Test error'))),
		queue.add(() => mockApiCall(3)),
	];

	try {
		await Promise.allSettled(promises);
		await queue.done();
		console.log('Error handling test completed');
	} catch (error) {
		console.error('Unexpected error:', error);
	}
}

// Run tests if this file is executed directly
if (typeof window === 'undefined') {
	// Running in Node.js environment
	testBasicQueue()
		.then(() => testRateLimit())
		.then(() => testErrorHandling())
		.then(() => console.log('All tests completed'))
		.catch(console.error);
}

export { testBasicQueue, testRateLimit, testErrorHandling };
