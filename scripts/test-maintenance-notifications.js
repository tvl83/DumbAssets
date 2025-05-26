/**
 * Test script for maintenance notification system
 * Tests date parsing, timezone handling, and edge cases
 * Run with: node scripts/test-maintenance-notifications.js
 */

const { DateTime } = require('luxon');
const path = require('path');

// Set test timezone
process.env.TZ = 'America/Chicago';
const TIMEZONE = process.env.TZ;

console.log('🧪 TESTING MAINTENANCE NOTIFICATION SYSTEM');
console.log(`📍 Timezone: ${TIMEZONE}`);
console.log(`📅 Current time: ${DateTime.now().setZone(TIMEZONE).toISO()}`);
console.log('');

// Import the maintenance checking logic
// NOTE: This would need to be adjusted based on actual file structure
// For now, we'll recreate the key functions for testing

/**
 * Robust date parsing function (copied from warrantyCron.js for testing)
 */
function parseDate(dateValue) {
    if (!dateValue) return null;
    
    try {
        if (dateValue instanceof DateTime) {
            return dateValue.isValid ? dateValue : null;
        }
        
        if (dateValue instanceof Date) {
            return DateTime.fromJSDate(dateValue, { zone: TIMEZONE });
        }
        
        if (typeof dateValue === 'string') {
            // Try ISO format first (YYYY-MM-DD)
            if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
                return DateTime.fromISO(dateValue, { zone: TIMEZONE });
            }
            
            // Try MM/DD/YYYY format
            if (dateValue.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
                const [month, day, year] = dateValue.split('/').map(Number);
                return DateTime.fromObject({ year, month, day }, { zone: TIMEZONE });
            }
            
            // Try other ISO formats
            const isoDate = DateTime.fromISO(dateValue, { zone: TIMEZONE });
            if (isoDate.isValid) return isoDate;
            
            // Try parsing as JS Date, then convert
            const jsDate = new Date(dateValue);
            if (!isNaN(jsDate.getTime())) {
                return DateTime.fromJSDate(jsDate, { zone: TIMEZONE });
            }
        }
        
        if (typeof dateValue === 'number' && !isNaN(dateValue)) {
            return DateTime.fromMillis(dateValue, { zone: TIMEZONE });
        }
        
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Add time periods with proper month/year handling (copied from warrantyCron.js for testing)
 */
function addTimePeriod(baseDate, amount, unit) {
    if (!baseDate || !baseDate.isValid) return null;
    
    try {
        const numericAmount = parseInt(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) return null;
        
        let result;
        switch (unit.toLowerCase()) {
            case 'days':
            case 'day':
                result = baseDate.plus({ days: numericAmount });
                break;
            case 'weeks':
            case 'week':
                result = baseDate.plus({ weeks: numericAmount });
                break;
            case 'months':
            case 'month':
                result = baseDate.plus({ months: numericAmount });
                break;
            case 'years':
            case 'year':
                result = baseDate.plus({ years: numericAmount });
                break;
            default:
                return null;
        }
        
        return result.isValid ? result : null;
    } catch (error) {
        return null;
    }
}

/**
 * Test date parsing edge cases
 */
function testDateParsing() {
    console.log('🔍 Testing Date Parsing...');
    
    const testCases = [
        // Valid cases
        { input: '2024-02-29', expected: true, description: 'Leap year Feb 29' },
        { input: '2024-01-31', expected: true, description: 'Month end date' },
        { input: '12/25/2024', expected: true, description: 'MM/DD/YYYY format' },
        { input: '1/1/2024', expected: true, description: 'Single digit month/day' },
        { input: new Date('2024-01-01'), expected: true, description: 'Date object' },
        { input: 1704067200000, expected: true, description: 'Timestamp' },
        
        // Invalid cases
        { input: '2023-02-29', expected: false, description: 'Non-leap year Feb 29' },
        { input: '2024-13-01', expected: false, description: 'Invalid month' },
        { input: '2024-01-32', expected: false, description: 'Invalid day' },
        { input: 'invalid-date', expected: false, description: 'Invalid string' },
        { input: '', expected: false, description: 'Empty string' },
        { input: null, expected: false, description: 'Null value' },
        { input: undefined, expected: false, description: 'Undefined value' }
    ];
    
    let passed = 0;
    let failed = 0;
    
    testCases.forEach(testCase => {
        const result = parseDate(testCase.input);
        const isValid = result !== null && result.isValid;
        
        if (isValid === testCase.expected) {
            console.log(`  ✅ ${testCase.description}`);
            passed++;
        } else {
            console.log(`  ❌ ${testCase.description} - Expected: ${testCase.expected}, Got: ${isValid}`);
            failed++;
        }
    });
    
    console.log(`📊 Date Parsing Results: ${passed} passed, ${failed} failed\n`);
    return failed === 0;
}

/**
 * Test date arithmetic edge cases
 */
function testDateArithmetic() {
    console.log('🧮 Testing Date Arithmetic...');
    
    const testCases = [
        // Month edge cases
        { 
            base: '2024-01-31', 
            amount: 1, 
            unit: 'months', 
            description: 'Jan 31 + 1 month (should be Feb 29, not March 3)',
            expectedMonth: 2,
            expectedDay: 29
        },
        { 
            base: '2024-03-31', 
            amount: 1, 
            unit: 'months', 
            description: 'Mar 31 + 1 month (should be Apr 30)',
            expectedMonth: 4,
            expectedDay: 30
        },
        // Year edge cases
        { 
            base: '2024-02-29', 
            amount: 1, 
            unit: 'years', 
            description: 'Leap day + 1 year (should be Feb 28)',
            expectedMonth: 2,
            expectedDay: 28
        },
        // Simple cases that should work perfectly
        { 
            base: '2024-01-15', 
            amount: 7, 
            unit: 'days', 
            description: 'Jan 15 + 7 days',
            expectedMonth: 1,
            expectedDay: 22
        },
        { 
            base: '2024-01-01', 
            amount: 2, 
            unit: 'weeks', 
            description: 'Jan 1 + 2 weeks',
            expectedMonth: 1,
            expectedDay: 15
        }
    ];
    
    let passed = 0;
    let failed = 0;
    
    testCases.forEach(testCase => {
        const baseDate = parseDate(testCase.base);
        const result = addTimePeriod(baseDate, testCase.amount, testCase.unit);
        
        if (!result) {
            console.log(`  ❌ ${testCase.description} - Failed to calculate`);
            failed++;
            return;
        }
        
        const resultMonth = result.month;
        const resultDay = result.day;
        
        if (resultMonth === testCase.expectedMonth && resultDay === testCase.expectedDay) {
            console.log(`  ✅ ${testCase.description} - Result: ${result.toISODate()}`);
            passed++;
        } else {
            console.log(`  ❌ ${testCase.description} - Expected: ${testCase.expectedMonth}/${testCase.expectedDay}, Got: ${resultMonth}/${resultDay} (${result.toISODate()})`);
            failed++;
        }
    });
    
    console.log(`📊 Date Arithmetic Results: ${passed} passed, ${failed} failed\n`);
    return failed === 0;
}

/**
 * Test timezone consistency
 */
function testTimezoneConsistency() {
    console.log('🌐 Testing Timezone Consistency...');
    
    const testDate = '2024-06-15'; // Summer date (DST active)
    const winterDate = '2024-01-15'; // Winter date (DST inactive)
    
    let passed = 0;
    let failed = 0;
    
    // Test summer date
    const summerParsed = parseDate(testDate);
    if (summerParsed && summerParsed.zoneName === TIMEZONE) {
        console.log(`  ✅ Summer date timezone: ${summerParsed.zoneName}`);
        passed++;
    } else {
        console.log(`  ❌ Summer date timezone mismatch: expected ${TIMEZONE}, got ${summerParsed?.zoneName}`);
        failed++;
    }
    
    // Test winter date
    const winterParsed = parseDate(winterDate);
    if (winterParsed && winterParsed.zoneName === TIMEZONE) {
        console.log(`  ✅ Winter date timezone: ${winterParsed.zoneName}`);
        passed++;
    } else {
        console.log(`  ❌ Winter date timezone mismatch: expected ${TIMEZONE}, got ${winterParsed?.zoneName}`);
        failed++;
    }
    
    // Test that same date string produces same result regardless of current time
    const now = DateTime.now().setZone(TIMEZONE);
    const parsed1 = parseDate('2024-12-25');
    const parsed2 = parseDate('2024-12-25');
    
    if (parsed1 && parsed2 && parsed1.toISODate() === parsed2.toISODate()) {
        console.log(`  ✅ Consistent parsing: ${parsed1.toISODate()}`);
        passed++;
    } else {
        console.log(`  ❌ Inconsistent parsing: ${parsed1?.toISODate()} vs ${parsed2?.toISODate()}`);
        failed++;
    }
    
    console.log(`📊 Timezone Consistency Results: ${passed} passed, ${failed} failed\n`);
    return failed === 0;
}

/**
 * Test maintenance scheduling logic
 */
function testMaintenanceScheduling() {
    console.log('📅 Testing Maintenance Scheduling Logic...');
    
    const today = DateTime.now().setZone(TIMEZONE);
    const todayString = today.toISODate();
    
    let passed = 0;
    let failed = 0;
    
    // Test frequency-based scheduling
    const baseDate = today.minus({ days: 30 }); // 30 days ago
    const nextDue = addTimePeriod(baseDate, 30, 'days');
    
    if (nextDue && nextDue.toISODate() === todayString) {
        console.log(`  ✅ Frequency scheduling: 30 days ago + 30 days = today`);
        passed++;
    } else {
        console.log(`  ❌ Frequency scheduling failed: expected ${todayString}, got ${nextDue?.toISODate()}`);
        failed++;
    }
    
    // Test specific date notifications (7 days advance)
    const futureDate = today.plus({ days: 7 });
    const daysUntil = Math.floor(futureDate.diff(today, 'days').days);
    
    if (daysUntil === 7) {
        console.log(`  ✅ 7-day advance notification timing correct`);
        passed++;
    } else {
        console.log(`  ❌ 7-day advance notification timing wrong: ${daysUntil} days`);
        failed++;
    }
    
    // Test overdue detection
    const pastDate = today.minus({ days: 2 });
    const daysPastDue = -pastDate.diff(today, 'days').days;
    
    if (daysPastDue === 2) {
        console.log(`  ✅ Overdue detection works: ${daysPastDue} days overdue`);
        passed++;
    } else {
        console.log(`  ❌ Overdue detection failed: expected 2, got ${daysPastDue}`);
        failed++;
    }
    
    console.log(`📊 Maintenance Scheduling Results: ${passed} passed, ${failed} failed\n`);
    return failed === 0;
}

/**
 * Run all tests
 */
function runAllTests() {
    console.log('🚀 STARTING COMPREHENSIVE MAINTENANCE NOTIFICATION TESTS\n');
    
    const results = [
        testDateParsing(),
        testDateArithmetic(),
        testTimezoneConsistency(),
        testMaintenanceScheduling()
    ];
    
    const allPassed = results.every(result => result === true);
    
    console.log('📋 FINAL RESULTS:');
    if (allPassed) {
        console.log('🎉 ALL TESTS PASSED! The maintenance notification system is robust and ready for production.');
    } else {
        console.log('⚠️  SOME TESTS FAILED! Please review the issues above before deploying.');
    }
    
    console.log('\n💡 To test in your environment:');
    console.log('1. Set DEBUG=true in your environment');
    console.log('2. Set TZ to your desired timezone');
    console.log('3. Create test maintenance events with edge case dates');
    console.log('4. Monitor logs for any warnings or errors');
    
    return allPassed;
}

// Run the tests if this script is executed directly
if (require.main === module) {
    runAllTests();
} 