const { main } = require('./update_razorpay_keys');

console.warn('fix_razorpay_keys.js is deprecated; use update_razorpay_keys.js');
main().catch((err) => {
    console.error('Razorpay configuration update failed:', err.message);
    process.exitCode = 1;
});
