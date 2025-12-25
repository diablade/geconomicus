import express from 'express';
import AvatarController from './avatar.controller.js';
import { schemas } from './avatar.validation.js';
import { validate } from '../../misc/validate.tool.js';

const router = express.Router();

router.get('/:sessionId/:avatarId', validate(schemas.getById, 'params'), AvatarController.getById);
// router.get('/:sessionId/:avatarId/rules', validate(schemas.getById, 'params'), AvatarController.getAvatarWithRules);
router.post('/join', validate(schemas.join), AvatarController.join);
router.put('/update', validate(schemas.update), AvatarController.update);
router.delete('/delete', validate(schemas.delete), AvatarController.delete);

export default router;
