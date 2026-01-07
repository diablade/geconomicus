import express from 'express';
import SessionController from './session.controller.js';
import { sanitize } from './session.sanitize.js';
import { validate } from '../misc/validate.tool.js';

const router = express.Router();

router.get('/all', SessionController.getAll);
router.get('/:sessionId', validate(sanitize.getById, true), SessionController.getById);
router.get('/short/:shortId', validate(sanitize.getByShortId, true), SessionController.getByShortId);
router.post('/create', validate(sanitize.create), SessionController.create);
router.put('/update', validate(sanitize.update), SessionController.update);
router.delete('/:sessionId', validate(sanitize.deleteSession, true), SessionController.delete);

export default router;
