/**
 * @fileoverview Unit tests for utils.js
 */

const fs = require('fs');
const path = require('path');

// Load the utils module
const utilsCode = fs.readFileSync(
    path.join(__dirname, '../js/utils.js'),
    'utf8'
);

// Execute in context to get the functions
eval(utilsCode);

describe('escapeHtml', () => {
    test('should escape ampersand', () => {
        expect(escapeHtml('A & B')).toBe('A &amp; B');
    });

    test('should escape less than', () => {
        expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    });

    test('should escape greater than', () => {
        expect(escapeHtml('a > b')).toBe('a &gt; b');
    });

    test('should escape double quotes', () => {
        expect(escapeHtml('say "hello"')).toBe('say &quot;hello&quot;');
    });

    test('should escape single quotes', () => {
        expect(escapeHtml("it's")).toBe("it&#039;s");
    });

    test('should handle empty string', () => {
        expect(escapeHtml('')).toBe('');
    });

    test('should escape multiple entities', () => {
        expect(escapeHtml('<a href="test">Link & More</a>'))
            .toBe('&lt;a href=&quot;test&quot;&gt;Link &amp; More&lt;/a&gt;');
    });

    test('should return empty string for non-string input', () => {
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
    });
});

describe('generateUUID', () => {
    test('should generate valid UUID format', () => {
        const uuid = generateUUID();
        const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
        expect(uuid).toMatch(uuidPattern);
    });

    test('should generate unique UUIDs', () => {
        const uuids = new Set();
        for (let i = 0; i < 100; i++) {
            uuids.add(generateUUID());
        }
        expect(uuids.size).toBe(100);
    });
});

describe('formatDate', () => {
    test('should format date correctly', () => {
        const date = new Date('2024-01-15');
        const formatted = formatDate(date);
        expect(formatted).toBe('2024-01-15');
    });

    test('should handle single digit month and day', () => {
        const date = new Date('2024-01-05');
        const formatted = formatDate(date);
        expect(formatted).toBe('2024-01-05');
    });
});

describe('throttle', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('should call function immediately first time', () => {
        const fn = jest.fn();
        const throttled = throttle(fn, 100);
        
        throttled();
        expect(fn).toHaveBeenCalledTimes(1);
    });

    test('should throttle subsequent calls', () => {
        const fn = jest.fn();
        const throttled = throttle(fn, 100);
        
        throttled();
        throttled();
        throttled();
        
        expect(fn).toHaveBeenCalledTimes(1);
        
        jest.advanceTimersByTime(100);
        
        throttled();
        expect(fn).toHaveBeenCalledTimes(2);
    });
});

describe('debounce', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('should delay function execution', () => {
        const fn = jest.fn();
        const debounced = debounce(fn, 100);
        
        debounced();
        expect(fn).not.toHaveBeenCalled();
        
        jest.advanceTimersByTime(100);
        expect(fn).toHaveBeenCalledTimes(1);
    });

    test('should reset timer on subsequent calls', () => {
        const fn = jest.fn();
        const debounced = debounce(fn, 100);
        
        debounced();
        jest.advanceTimersByTime(50);
        debounced();
        jest.advanceTimersByTime(50);
        
        expect(fn).not.toHaveBeenCalled();
        
        jest.advanceTimersByTime(50);
        expect(fn).toHaveBeenCalledTimes(1);
    });
});

describe('getContrastColor', () => {
    test('should return black for light background', () => {
        expect(getContrastColor('#FFFFFF')).toBe('#000000');
        expect(getContrastColor('#FFFF00')).toBe('#000000');
    });

    test('should return white for dark background', () => {
        expect(getContrastColor('#000000')).toBe('#FFFFFF');
        expect(getContrastColor('#0000FF')).toBe('#FFFFFF');
    });

    test('should handle colors without hash', () => {
        expect(getContrastColor('FFFFFF')).toBe('#000000');
    });
});

describe('truncateText', () => {
    test('should not truncate short text', () => {
        expect(truncateText('Hello', 10)).toBe('Hello');
    });

    test('should truncate long text with ellipsis', () => {
        expect(truncateText('Hello World', 5)).toBe('Hello...');
    });

    test('should handle empty string', () => {
        expect(truncateText('', 10)).toBe('');
    });

    test('should handle exact length', () => {
        expect(truncateText('Hello', 5)).toBe('Hello');
    });
});
