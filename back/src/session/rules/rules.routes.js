import express from 'express';
import RulesController from './rules.controller.js';
import { sanitize } from './rules.validation.js';
import { validate } from '../../misc/validate.tool.js';

const router = express.Router();

router.get('/:sessionId/:ruleId', validate(sanitize.getById, 'params'), RulesController.getById);
router.post('/create', validate(sanitize.create), RulesController.create);
router.put('/update', validate(sanitize.update), RulesController.update);
router.post('/reset', validate(sanitize.reset), RulesController.reset);
router.delete('/delete', validate(sanitize.remove), RulesController.remove);

export default router;
