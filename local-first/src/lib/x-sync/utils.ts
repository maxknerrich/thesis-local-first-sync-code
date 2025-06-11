export function diffObject<T extends object>(obj1: T, obj2: T): Partial<T> {
	const differences: Partial<T> = {};

	for (const key in obj2) {
		if (Object.hasOwn(obj2, key)) {
			if (Object.hasOwn(obj1, key) && obj1[key] !== obj2[key]) {
				differences[key] = obj2[key];
			}
		}
	}
	return differences;
}
