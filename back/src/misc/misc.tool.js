import { customAlphabet } from 'nanoid';
const alphabet = 'abcdefghjkmnpqrstuvwxyz123456789'; // remove o,l,i,... to avoid confusion
const numbers = '1234567890'; // remove o,l,i,... to avoid confusion

export const nanoId4 = customAlphabet(alphabet, 4); // 4 characters
export const isNanoId4 = (value) => {
	if (typeof value !== 'string') return false;
	const regex = new RegExp(`^[${alphabet}]{4}$`);
	return regex.test(value);
};

export const numbersId4 = customAlphabet(numbers, 4); // 4 characters
export const isNumbersId4 = (value) => {
	if (typeof value !== 'string') return false;
	const regex = new RegExp(`^[${numbers}]{4}$`);
	return regex.test(value);
};

export default {
	nanoId4,
	isNanoId4,
	numbersId4,
	isNumbersId4,
};
