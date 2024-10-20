class ActiveTransactions {
	constructor() {
		if (!ActiveTransactions.instance) {
			this.transactions = new Set();
			ActiveTransactions.instance = this;
		}

		return ActiveTransactions.instance;
	}

	add(transactionId) {
		this.transactions.add(transactionId);
	}

	has(transactionId) {
		return this.transactions.has(transactionId);
	}

	delete(transactionId) {
		this.transactions.delete(transactionId);
	}
}

const activeTransactions = new ActiveTransactions();
Object.freeze(activeTransactions);

export default activeTransactions;
