import express from 'express';
import RulesController from './rules.controller.js';
import { sanitize } from './rules.sanitize.js';
import { validate } from '../../misc/validate.tool.js';

const router = express.Router();

router.get('/:sessionId/:ruleIdx', validate(sanitize.getByIdx, true), RulesController.getByIdx);
router.post('/create', validate(sanitize.create), RulesController.create);
router.put('/update', validate(sanitize.update), RulesController.update);
router.delete('/:sessionId/:ruleIdx', validate(sanitize.remove, true), RulesController.remove);

export default router;
