import { isLightBoard } from './avatarTools';

describe('isLightBoard', () => {
	it('classifies the preset boards', () => {
		expect(isLightBoard('bgGradien6')).toBeTrue();
		expect(isLightBoard('bgWood')).toBeTrue();
		expect(isLightBoard('bgGradien7')).toBeFalse();
		expect(isLightBoard('bgGreen')).toBeFalse();
		expect(isLightBoard('')).toBeFalse();
	});

	it('reads custom hex colors, alpha included', () => {
		expect(isLightBoard('bgCustom', '#ffd89b')).toBeTrue();
		expect(isLightBoard('bgCustom', '#3382ac')).toBeFalse();
		expect(isLightBoard('bgCustom', '#ffd89b20')).toBeFalse();
		expect(isLightBoard('bgCustom', '#0019aa64')).toBeFalse();
	});

	it('reads custom rgb and rgba strings', () => {
		expect(isLightBoard('bgCustom', 'rgb(255, 216, 155)')).toBeTrue();
		expect(isLightBoard('bgCustom', 'rgba(255, 216, 155, 0.2)')).toBeFalse();
		expect(isLightBoard('bgCustom', 'rgba(10, 10, 30, 1)')).toBeFalse();
	});

	it('falls back to dark text on an unreadable color', () => {
		expect(isLightBoard('bgCustom', '')).toBeFalse();
		expect(isLightBoard('bgCustom', 'not-a-color')).toBeFalse();
	});
});
