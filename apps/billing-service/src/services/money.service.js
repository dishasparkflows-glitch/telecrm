const CURRENCY_EXPONENTS = Object.freeze({
    BHD: 3,
    IQD: 3,
    JOD: 3,
    KWD: 3,
    OMR: 3,
    TND: 3,
    BIF: 0,
    CLP: 0,
    DJF: 0,
    GNF: 0,
    JPY: 0,
    KMF: 0,
    KRW: 0,
    MGA: 0,
    PYG: 0,
    RWF: 0,
    UGX: 0,
    VND: 0,
    VUV: 0,
    XAF: 0,
    XOF: 0,
    XPF: 0,
});

const getCurrencyExponent = (currency) => CURRENCY_EXPONENTS[String(currency).toUpperCase()] ?? 2;

const toMinorUnits = (amount, currency = 'INR') => {
    const numeric = Number(amount);
    if (!Number.isFinite(numeric) || numeric < 0) throw new Error('Invalid monetary amount');
    return Math.round(numeric * (10 ** getCurrencyExponent(currency)));
};

const fromMinorUnits = (amountMinor, currency = 'INR') => (
    Number(amountMinor) / (10 ** getCurrencyExponent(currency))
);

const calculateTotals = ({ subtotal, taxPercent = 18, currency = 'INR' }) => {
    const subtotalMinor = toMinorUnits(subtotal, currency);
    const taxMinor = Math.round(subtotalMinor * (Number(taxPercent) / 100));
    const totalMinor = subtotalMinor + taxMinor;
    return {
        subtotalMinor,
        taxMinor,
        totalMinor,
        subtotal: fromMinorUnits(subtotalMinor, currency),
        tax: fromMinorUnits(taxMinor, currency),
        total: fromMinorUnits(totalMinor, currency),
    };
};

module.exports = {
    getCurrencyExponent,
    toMinorUnits,
    fromMinorUnits,
    calculateTotals,
};
