import BankStateService from './services/bank.state.service.js';

const BankController = {};

BankController.createCredit = async (req, res, next) => {
	const { gameStateId, playerStateIdx, interest, amount, startNow } = req.body;
	try {
		const data = await BankStateService.createCredit(gameStateId, playerStateIdx, interest, amount, startNow);
		return res.status(200).json({ data });
	} catch (err) {
		log.error('[BankController] create credit error: ', err);
		return res.status(500).json({
			status: 'ko',
			message: 'ERROR.CREATE_CREDIT',
		});
	}
};

BankController.getCreditsByIdPlayer = async (req, res, next) => {
	const { gameStateId, playerStateIdx } = req.params;
	try {
		const credits = await BankStateService.getCreditsByPlayer(gameStateId, playerStateIdx);
		return res.status(200).json(credits);
	} catch (err) {
		log.error('[BankController] get credits error: ', err);
		next({
			status: 400,
			message: 'ERROR.GET_CREDITS',
		});
	}
};

BankController.settleCredit = async (req, res, next) => {
	const { creditId, gameStateId, playerStateIdx } = req.body;
	try {
		const creditUpdated = await BankStateService.settleCredit(creditId, gameStateId, playerStateIdx);
		return res.status(200).json(creditUpdated);
	} catch (err) {
		log.error('[BankController] settle credit error: ', err);
		next({
			status: 400,
			message: 'ERROR.REPAY_CREDIT',
		});
	}
};

BankController.payInterest = async (req, res, next) => {
	const { creditId, gameStateId, playerStateIdx } = req.body;
	try {
		const creditUpdated = await BankStateService.payInterest(creditId, gameStateId, playerStateIdx);
		return res.status(200).json(creditUpdated);
	} catch (err) {
		log.error('[BankController] pay interest error: ', err);
		next({
			status: 400,
			message: 'ERROR.PAY_INTEREST',
		});
	}
};

BankController.seizure = async (req, res, next) => {
	const { creditId, gameStateId, playerStateIdx, seizure } = req.body;
	try {
		const result = await BankStateService.seizure(creditId, gameStateId, playerStateIdx, seizure);
		return res.status(200).json(result);
	} catch (err) {
		log.error('[BankController] seizure error: ', err);
		next({
			status: 400,
			message: 'ERROR.SEIZURE',
		});
	}
};
// BankController.lockDownPlayer = async (req, res, next) => {
//     try {
//         await bankService.lockDownPlayer(req.idPlayer, req.idGame, req.prisonTime);
//         return res.status(200).json({});
//     }
//     catch (err) {
//         log.error(err);
//         next({
//             status: 400,
//             message: "ERROR.LOCK_DOWN_PLAYER",
//         });
//     }
// };
BankController.iveGotToBreakFree = async (req, res, next) => {
	const { gameStateId, playerStateIdx } = req.body;
	try {
		const success = await BankStateService.prisonBreak(gameStateId, playerStateIdx);
		return res.status(200).json({ status: success });
	} catch (err) {
		log.error('[BankController] prison break error: ', err);
		next({
			status: 500,
			message: err,
		});
	}
};

export default BankController;
