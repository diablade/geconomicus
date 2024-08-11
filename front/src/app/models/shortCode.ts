import * as _ from 'lodash-es';

export class ShortCode {
	idCard: string = "";
	code: string = "";
}

// export function generateUniqueShortCode = (existingCodes: ShortCode[]) => {
// 	let newCode;
	// Loop until a unique code is generated
	// do {
	// 	newCode = _.times(3, () => _.random(0, 9)).join(''); // Generate a 3-digit random code
	// } while (_.includes(existingCodes, newCode)); // Check if the code already exists

	// return newCode;
// }
