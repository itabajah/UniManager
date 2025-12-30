/**
 * @fileoverview Unit tests for validation.js
 */

// Load validation functions
const fs = require('fs');
const path = require('path');

// Load the validation module
const validationCode = fs.readFileSync(
    path.join(__dirname, '../js/validation.js'),
    'utf8'
);

// Execute in context to get the functions
eval(validationCode);

describe('validateString', () => {
    test('should validate required empty string', () => {
        const result = validateString('', { required: true });
        expect(result.valid).toBe(false);
        expect(result.error).toBe('This field is required');
    });

    test('should pass valid string', () => {
        const result = validateString('Hello World', { required: true });
        expect(result.valid).toBe(true);
        expect(result.value).toBe('Hello World');
    });

    test('should trim whitespace', () => {
        const result = validateString('  test  ', { trim: true });
        expect(result.valid).toBe(true);
        expect(result.value).toBe('test');
    });

    test('should enforce maxLength', () => {
        const result = validateString('12345', { maxLength: 3 });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('no more than 3 characters');
    });

    test('should enforce minLength', () => {
        const result = validateString('ab', { minLength: 5, required: true });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('at least 5 characters');
    });

    test('should allow empty optional fields', () => {
        const result = validateString('', { required: false, allowEmpty: true });
        expect(result.valid).toBe(true);
    });

    test('should validate pattern', () => {
        const result = validateString('test123', { 
            pattern: /^[a-z]+$/, 
            patternMessage: 'Letters only' 
        });
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Letters only');
    });

    test('should handle null input', () => {
        const result = validateString(null, { allowEmpty: true });
        expect(result.valid).toBe(true);
        expect(result.value).toBe('');
    });

    test('should coerce numbers to strings', () => {
        const result = validateString(123);
        expect(result.valid).toBe(true);
        expect(result.value).toBe('123');
    });
});

describe('validateCourseName', () => {
    test('should validate empty course name', () => {
        const result = validateCourseName('');
        expect(result.valid).toBe(false);
    });

    test('should validate valid course name', () => {
        const result = validateCourseName('Introduction to Programming');
        expect(result.valid).toBe(true);
    });

    test('should reject too long course name', () => {
        const longName = 'A'.repeat(101);
        const result = validateCourseName(longName);
        expect(result.valid).toBe(false);
    });
});

describe('validateUrl', () => {
    test('should validate empty optional URL', () => {
        const result = validateUrl('', { required: false });
        expect(result.valid).toBe(true);
    });

    test('should validate http URL', () => {
        const result = validateUrl('http://example.com');
        expect(result.valid).toBe(true);
    });

    test('should validate https URL', () => {
        const result = validateUrl('https://example.com/path?query=value');
        expect(result.valid).toBe(true);
    });

    test('should reject invalid URL format', () => {
        const result = validateUrl('not-a-url');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid URL format');
    });

    test('should reject ftp protocol by default', () => {
        const result = validateUrl('ftp://example.com');
        expect(result.valid).toBe(false);
    });

    test('should reject required empty URL', () => {
        const result = validateUrl('', { required: true });
        expect(result.valid).toBe(false);
    });
});

describe('validateVideoUrl', () => {
    test('should detect YouTube URL', () => {
        const result = validateVideoUrl('https://www.youtube.com/watch?v=abc123');
        expect(result.valid).toBe(true);
        expect(result.platform).toBe('youtube');
    });

    test('should detect YouTube short URL', () => {
        const result = validateVideoUrl('https://youtu.be/abc123');
        expect(result.valid).toBe(true);
        expect(result.platform).toBe('youtube');
    });

    test('should detect Panopto URL', () => {
        const result = validateVideoUrl('https://technion.panopto.com/viewer?id=123');
        expect(result.valid).toBe(true);
        expect(result.platform).toBe('panopto');
    });

    test('should mark other URLs as other platform', () => {
        const result = validateVideoUrl('https://vimeo.com/123');
        expect(result.valid).toBe(true);
        expect(result.platform).toBe('other');
    });

    test('should handle empty URL', () => {
        const result = validateVideoUrl('');
        expect(result.valid).toBe(true);
        expect(result.platform).toBe('unknown');
    });
});

describe('validateNumber', () => {
    test('should validate integer', () => {
        const result = validateNumber(42, { integer: true });
        expect(result.valid).toBe(true);
        expect(result.value).toBe(42);
    });

    test('should reject non-integer when integer required', () => {
        const result = validateNumber(3.14, { integer: true });
        expect(result.valid).toBe(false);
    });

    test('should validate range', () => {
        const result = validateNumber(50, { min: 0, max: 100 });
        expect(result.valid).toBe(true);
    });

    test('should reject below minimum', () => {
        const result = validateNumber(-5, { min: 0 });
        expect(result.valid).toBe(false);
    });

    test('should reject above maximum', () => {
        const result = validateNumber(150, { max: 100 });
        expect(result.valid).toBe(false);
    });

    test('should handle empty optional number', () => {
        const result = validateNumber('', { required: false });
        expect(result.valid).toBe(true);
        expect(result.value).toBe(null);
    });

    test('should reject NaN', () => {
        const result = validateNumber('not a number');
        expect(result.valid).toBe(false);
    });

    test('should reject zero when not allowed', () => {
        const result = validateNumber(0, { allowZero: false });
        expect(result.valid).toBe(false);
    });
});

describe('validateCalendarHour', () => {
    test('should validate valid hour', () => {
        const result = validateCalendarHour(8);
        expect(result.valid).toBe(true);
        expect(result.value).toBe(8);
    });

    test('should reject hour below 0', () => {
        const result = validateCalendarHour(-1);
        expect(result.valid).toBe(false);
    });

    test('should reject hour above 23', () => {
        const result = validateCalendarHour(24);
        expect(result.valid).toBe(false);
    });

    test('should validate edge cases 0 and 23', () => {
        expect(validateCalendarHour(0).valid).toBe(true);
        expect(validateCalendarHour(23).valid).toBe(true);
    });
});

describe('validateDate', () => {
    test('should validate valid date format', () => {
        const result = validateDate('2024-01-15');
        expect(result.valid).toBe(true);
        expect(result.date).toBeInstanceOf(Date);
    });

    test('should reject invalid date format', () => {
        const result = validateDate('15-01-2024');
        expect(result.valid).toBe(false);
    });

    test('should reject invalid date', () => {
        const result = validateDate('2024-13-45');
        expect(result.valid).toBe(false);
    });

    test('should handle empty optional date', () => {
        const result = validateDate('', { required: false });
        expect(result.valid).toBe(true);
        expect(result.date).toBe(null);
    });
});

describe('validateTime', () => {
    test('should validate valid time format', () => {
        const result = validateTime('14:30');
        expect(result.valid).toBe(true);
    });

    test('should validate single digit hour', () => {
        const result = validateTime('9:30');
        expect(result.valid).toBe(true);
    });

    test('should reject invalid time format', () => {
        const result = validateTime('25:00');
        expect(result.valid).toBe(false);
    });

    test('should reject invalid minutes', () => {
        const result = validateTime('12:60');
        expect(result.valid).toBe(false);
    });
});

describe('validateImportedData', () => {
    test('should validate valid data structure', () => {
        const data = {
            semesters: [
                { id: '1', name: 'Fall 2024', courses: [] }
            ]
        };
        const result = validateImportedData(data);
        expect(result.valid).toBe(true);
    });

    test('should reject non-object', () => {
        const result = validateImportedData('not an object');
        expect(result.valid).toBe(false);
    });

    test('should reject missing semesters array', () => {
        const result = validateImportedData({ foo: 'bar' });
        expect(result.valid).toBe(false);
    });

    test('should handle wrapped export format', () => {
        const data = {
            data: {
                semesters: [{ id: '1', name: 'Test' }]
            }
        };
        const result = validateImportedData(data);
        expect(result.valid).toBe(true);
    });

    test('should warn on missing semester id/name', () => {
        const data = {
            semesters: [{ }]
        };
        const result = validateImportedData(data);
        expect(result.valid).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
    });
});

describe('validateScheduleItem', () => {
    test('should validate valid schedule item', () => {
        const result = validateScheduleItem({
            day: 1,
            start: '08:00',
            end: '10:00'
        });
        expect(result.valid).toBe(true);
    });

    test('should reject invalid day', () => {
        const result = validateScheduleItem({
            day: 7,
            start: '08:00',
            end: '10:00'
        });
        expect(result.valid).toBe(false);
    });

    test('should reject end time before start time', () => {
        const result = validateScheduleItem({
            day: 1,
            start: '10:00',
            end: '08:00'
        });
        expect(result.valid).toBe(false);
    });
});

describe('sanitizeString', () => {
    test('should remove control characters', () => {
        const result = sanitizeString('Hello\x00World');
        expect(result).toBe('HelloWorld');
    });

    test('should normalize multiple spaces', () => {
        const result = sanitizeString('Hello    World');
        expect(result).toBe('Hello World');
    });

    test('should trim whitespace', () => {
        const result = sanitizeString('  Hello  ');
        expect(result).toBe('Hello');
    });

    test('should handle null', () => {
        const result = sanitizeString(null);
        expect(result).toBe('');
    });
});

describe('sanitizeFilename', () => {
    test('should remove unsafe characters', () => {
        const result = sanitizeFilename('file<>:"/\\|?*.txt');
        expect(result).not.toContain('<');
        expect(result).not.toContain('>');
        expect(result).not.toContain(':');
    });

    test('should handle empty filename', () => {
        const result = sanitizeFilename('');
        expect(result).toBe('export');
    });

    test('should limit length', () => {
        const longName = 'A'.repeat(200);
        const result = sanitizeFilename(longName);
        expect(result.length).toBeLessThanOrEqual(100);
    });
});
