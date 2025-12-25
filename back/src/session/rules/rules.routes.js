import express from 'express';
import RulesController from './rules.controller.js';
import { validate, schemas } from './rules.validation.js';

const router = express.Router();

router.get('/:sessionId/:ruleId', validate(schemas.getById, 'params'), RulesController.getById);
router.post('/create', validate(schemas.create), RulesController.create);
router.put('/update', validate(schemas.update), RulesController.update);
router.post('/reset', validate(schemas.reset), RulesController.reset);
router.delete('/delete', validate(schemas.remove), RulesController.remove);

export default router;
