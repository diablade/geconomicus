import express from 'express';
import ToolsController from './tools.controller.js';
import { sanitize } from './tools.sanitize.js';
import { validate } from '../misc/validate.tool.js';

const router = express.Router();

router.post('/simulate', validate(sanitize.simulate), ToolsController.simulate);

export default router;
