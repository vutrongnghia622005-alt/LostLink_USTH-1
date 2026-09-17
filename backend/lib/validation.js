const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
    return typeof value === 'string' && UUID.test(value);
}

function isText(value, min = 0, max = Infinity) {
    return typeof value === 'string' && value.trim().length >= min && value.trim().length <= max;
}

function isOptionalText(value, max) {
    return value == null || isText(value, 0, max);
}

function databaseError(res, error, label) {
    console.error(label, error);
    if (error.code === '22P02' || error.code === '22007' || error.code === '22008' || error.code === '22001') {
        return res.status(400).json({ message: 'Invalid input.' });
    }
    if (error.code === '23503') return res.status(404).json({ message: 'Related item not found.' });
    if (error.code === '23505') return res.status(409).json({ message: 'This item already exists.' });
    return res.status(500).json({ message: 'Internal server error.' });
}

module.exports = { isUuid, isText, isOptionalText, databaseError };
