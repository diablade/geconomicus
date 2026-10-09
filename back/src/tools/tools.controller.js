import ToolsService from './tools.service.js';
import log from '#config/log';

const ToolsController = {};

/**
 * POST /tools/simulate — run one simulation and return its result and verdict.
 *
 * The body has already been validated and defaulted by the sanitizer, so it is
 * passed straight to the service.
 *
 * @param {import('express').Request} req - validated simulation options in the body
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>} 200 with { result, verdict, elapsedMs }, 500 on failure
 */
ToolsController.simulate = async (req, res) => {
	try {
		const started = Date.now();
		const { result, verdict } = await ToolsService.simulate(req.body);
		log.info(
			`[ToolsController] simulated ${req.body.players} players ${result.config.typeMoney} in ${Date.now() - started}ms`
		);
		return res.status(200).json({ result, verdict, elapsedMs: Date.now() - started });
	} catch (error) {
		log.error(`[ToolsController] simulate failed: ${error.message}`);
		return res.status(500).json({ message: error.message });
	}
};

export default ToolsController;
