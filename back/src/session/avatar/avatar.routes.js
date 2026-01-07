import express from 'express';
import AvatarController from './avatar.controller.js';
import { sanitize } from './avatar.sanitize.js';
import { validate } from '../../misc/validate.tool.js';

const router = express.Router();

router.get('/:sessionId/:avatarId', validate(sanitize.getById, true), AvatarController.getById);
// router.get('/:sessionId/:avatarId/rules', validate(sanitize.getById, true), AvatarController.getAvatarWithRules);
router.post('/join', validate(sanitize.join), AvatarController.join);
router.put('/update', validate(sanitize.update), AvatarController.update);
router.delete('/:sessionId/:avatarId', validate(sanitize.delete, true), AvatarController.delete);

export default router;
