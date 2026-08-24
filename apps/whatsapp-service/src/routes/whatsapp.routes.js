const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/whatsapp.controller');
const { ROLES } = require('@sparkcrm/shared-utils');

/**
 * Middleware: restricts route to superadmin role only.
 * The API Gateway forwards the JWT role as x-user-role.
 * Superadmins can manage templates and send broadcasts.
 * Regular agents can only chat (send/receive messages).
 */
const requireSuperAdmin = (req, res, next) => {
    const role = req.headers['x-user-role'];
    if (role !== ROLES.SUPER_ADMIN) {
        return res.status(403).json({
            success: false,
            message: 'Only administrators can perform this action.',
            code: 'FORBIDDEN',
        });
    }
    next();
};

// ─── Chat & Inbox ── (all users)
router.get('/stats', ctrl.getUsageStats);
router.get('/messages/:id/media', ctrl.getMessageMedia);
router.post('/messages/:id/reply', ctrl.replyToMessage);
router.post('/messages/:id/forward', ctrl.forwardMessage);
router.put('/messages/:id/reaction', ctrl.reactToMessage);
router.post('/send', ctrl.sendMessage);
router.get('/chat/:leadId', ctrl.getChat);
router.get('/team-inbox', ctrl.getTeamInbox);
router.get('/inbox-chat/:phone', ctrl.getInboxChat);
router.post('/inbox-chat/:phone/read', ctrl.markInboxRead);

// ─── Broadcast ── (superadmin only)
router.post('/broadcast', requireSuperAdmin, ctrl.broadcast);

// ─── Templates ── (read: all users | write: superadmin only)
router.get('/templates', ctrl.getTemplates);
router.get('/templates/approved', ctrl.getApprovedTemplates);
router.post('/templates', requireSuperAdmin, ctrl.createTemplate);
router.put('/templates/:id', requireSuperAdmin, ctrl.updateTemplate);
router.delete('/templates/:id', requireSuperAdmin, ctrl.deleteTemplate);
router.post('/templates/sync', requireSuperAdmin, ctrl.syncTemplatesFromMeta);

// ─── Chatbot rules ── (superadmin only)
router.get('/chatbot', ctrl.getChatbotRules);
router.post('/chatbot', requireSuperAdmin, ctrl.createChatbotRule);
router.put('/chatbot/:id', requireSuperAdmin, ctrl.updateChatbotRuleFn);
router.delete('/chatbot/:id', requireSuperAdmin, ctrl.deleteChatbotRule);

module.exports = router;
