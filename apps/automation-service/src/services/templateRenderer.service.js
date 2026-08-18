const lodash = require('lodash');

/**
 * Replaces placeholders like {{lead.firstName}} with values from context.
 * 
 * @param {string} text - The template text containing placeholders.
 * @param {Object} context - The data context resolved from databases.
 * @returns {string} The rendered text.
 */
const renderText = (text, context) => {
    if (!text) return '';
    return text.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const trimmedPath = path.trim();
        const value = lodash.get(context, trimmedPath);
        return value !== undefined && value !== null ? String(value) : '';
    });
};

/**
 * Renders an email template.
 * @param {Object} params
 * @param {Object} params.template - The EmailTemplate mongoose document
 * @param {Object} params.context - The resolved context object
 * @returns {Object} Rendered subject, html, and text
 */
const renderEmailTemplate = ({ template, context }) => {
    return {
        subject: renderText(template.subject, context),
        bodyHtml: renderText(template.bodyHtml, context),
        bodyText: renderText(template.bodyText, context)
    };
};

module.exports = { renderText, renderEmailTemplate };
