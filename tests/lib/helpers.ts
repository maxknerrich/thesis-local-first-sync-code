import * as fs from "node:fs";
import * as path from "node:path";

import type { Page } from '@playwright/test';

interface TestResult {
	run: number;
	app: string;
	profile: string;
	timestamp: string;
	[key: string]: number | string;
}

interface CsvManagerOptions {
	customFields?: string[];
	includeTimestamp?: boolean;
}

export class ResultsManager {
	private results: TestResult[] = [];
	private csvPath: string;
	private customFields: string[];
	private includeTimestamp: boolean;
	private allFields: Set<string>;

	constructor(useCase: string, options: CsvManagerOptions = {}) {
		this.csvPath = path.join(__dirname, `../../results/${useCase}-results.csv`);
		this.customFields = options.customFields || [];
		this.includeTimestamp = options.includeTimestamp ?? true;
		this.allFields = new Set(['run', 'app', 'profile']);

		if (this.includeTimestamp) {
			this.allFields.add('timestamp');
		}

		// Add custom fields to the set
		for (const field of this.customFields) {
			this.allFields.add(field);
		}

		this.ensureResultsDir();
		this.loadExistingResults();
	}

	private ensureResultsDir(): void {
		const resultsDir = path.dirname(this.csvPath);
		if (!fs.existsSync(resultsDir)) {
			fs.mkdirSync(resultsDir, { recursive: true });
		}
	}

	private loadExistingResults(): void {
		if (fs.existsSync(this.csvPath)) {
			try {
				const csvContent = fs.readFileSync(this.csvPath, 'utf8');
				const lines = csvContent.trim().split('\n');

				if (lines.length > 1) {
					const headers = lines[0].split(',');

					// Update allFields with headers from existing CSV
					for (const header of headers) {
						this.allFields.add(header);
					}

					// Parse existing data
					for (let i = 1; i < lines.length; i++) {
						const values = this.parseCsvLine(lines[i]);
						const result: TestResult = {
							run: 0,
							app: '',
							profile: '',
							timestamp: ''
						};

						headers.forEach((header, index) => {
							const value = values[index] || '';
							if (header === 'run') {
								result[header] = Number.parseInt(value) || 0;
							} else {
								result[header] = value;
							}
						});

						this.results.push(result);
					}
				}
			} catch (error) {
				console.warn('Could not load existing CSV results, starting fresh');
				this.results = [];
			}
		}
	}

	private parseCsvLine(line: string): string[] {
		const values: string[] = [];
		let current = '';
		let inQuotes = false;

		for (let i = 0; i < line.length; i++) {
			const char = line[i];

			if (char === '"' && (i === 0 || line[i - 1] !== '\\')) {
				inQuotes = !inQuotes;
			} else if (char === ',' && !inQuotes) {
				values.push(current);
				current = '';
			} else {
				current += char;
			}
		}

		values.push(current);
		return values;
	}

	addResult(
		runIndex: number,
		profile: string,
		app: string,
		customData: Record<string, number | string> = {}
	): void {
		const result: TestResult = {
			run: runIndex,
			app,
			profile,
			timestamp: this.includeTimestamp ? new Date().toISOString() : ''
		};

		// Add custom data fields
		for (const [key, value] of Object.entries(customData)) {
			result[key] = value;
			this.allFields.add(key);
		}

		this.results.push(result);
		this.saveToCSV();
	}

	private saveToCSV(): void {
		const headers = Array.from(this.allFields);
		const csvLines: string[] = [];

		// Add header row
		csvLines.push(headers.join(','));

		// Add data rows
		for (const result of this.results) {
			const values = headers.map(header => {
				const value = result[header];
				if (value === undefined || value === null) {
					return '';
				}

				// Handle string values that might contain commas or quotes
				const stringValue = String(value);
				if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
					return `"${stringValue.replace(/"/g, '""')}"`;
				}

				return stringValue;
			});

			csvLines.push(values.join(','));
		}

		fs.writeFileSync(this.csvPath, `${csvLines.join('\n')}\n`);
	}

	getAllResults(): TestResult[] {
		return this.results;
	}

	getResultsByField(field: string, value: string | number): TestResult[] {
		return this.results.filter(result => result[field] === value);
	}

	getUniqueValues(field: string): (string | number)[] {
		const values = this.results.map(result => result[field]).filter(val => val !== undefined);
		return [...new Set(values)];
	}

	exportFinalResults(): void {
		this.saveToCSV();
		console.log(`Results exported to: ${this.csvPath}`);
		console.log(`Total records: ${this.results.length}`);
		console.log(`Fields: ${Array.from(this.allFields).join(', ')}`);
	}

	// Utility method to get summary statistics
	getSummaryStats(): {
		totalRecords: number;
		fields: string[];
		uniqueRuns: number[];
		uniqueApps: string[];
		uniqueProfiles: string[];
	} {
		return {
			totalRecords: this.results.length,
			fields: Array.from(this.allFields),
			uniqueRuns: this.getUniqueValues('run') as number[],
			uniqueApps: this.getUniqueValues('app') as string[],
			uniqueProfiles: this.getUniqueValues('profile') as string[]
		};
	}
}


export async function measureTimeToVisualFeedback(
	page: Page,
	actionName: string,
	actionFn: () => Promise<void>,
	feedbackSelector: string,
	timeout = 30000
): Promise<number> {

	await actionFn();
	// Perform the action
	const startTime = performance.now();

	// Wait for visual feedback (element appears, changes, or DOM updates)
	await page.waitForSelector(feedbackSelector, {
		state: 'visible',
		timeout
	});

	const endTime = performance.now();
	const timeToFeedback = endTime - startTime;

	console.log(`${actionName}: ${timeToFeedback}ms time to visual feedback`);
	return timeToFeedback;
}
