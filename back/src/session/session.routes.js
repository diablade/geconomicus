import express from 'express';
import SessionController from './session.controller.js';
import { schemas } from './session.validation.js';
import { validate } from '../misc/validate.tool.js';

const router = express.Router();

router.get('/:sessionId', validate(schemas.getById, 'params'), SessionController.getById);
router.get('/short/:shortId', validate(schemas.getByShortId, 'params'), SessionController.getByShortId);
router.get('/all', SessionController.getAll);
router.post('/create', validate(schemas.create), SessionController.create);
router.put('/update', validate(schemas.update), SessionController.update);
router.delete('/:sessionId', validate(schemas.deleteSession, 'params'), SessionController.delete);

export default router;
