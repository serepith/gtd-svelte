import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Firebase environment variables for tests
Object.assign(global, {
	PUBLIC_FIREBASE_API_KEY: 'test-api-key',
	PUBLIC_FIREBASE_AUTH_DOMAIN: 'test.firebaseapp.com',
	PUBLIC_FIREBASE_PROJECT_ID: 'test-project',
	PUBLIC_FIREBASE_STORAGE_BUCKET: 'test-project.appspot.com',
	PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '123456789',
	PUBLIC_FIREBASE_APP_ID: 'test-app-id'
});

// Mock location for Firebase emulator detection
Object.defineProperty(global, 'location', {
	value: {
		hostname: 'localhost',
		href: 'http://localhost:3000'
	},
	writable: true
});

// Mock console methods to reduce test noise
global.console = {
	...console,
	log: vi.fn(),
	error: vi.fn(),
	warn: vi.fn(),
	info: vi.fn()
};
