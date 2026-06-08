import { createAvatar, schema } from '@dicebear/core';
import { adventurer } from '@dicebear/collection';
import { Avatar } from '../models/avatar';
import * as _ from 'lodash-es';
import { Options as Opt } from '@dicebear/core/lib/types';

export const properties: any = {
	...schema.properties,
	...adventurer.schema.properties,
};
export const skinPalette: Array<any> = ['#f2d3b1', '#ecad80', '#9e5622', '#763900', '#371d00', '#ffffff', '#000000'];
export const hairPalette: Array<any> = [
	'#000000', // noir intense
	'#5e5e5e', // gris (argent)
	'#bdbdbd', // gris clair
	'#5a3e2b', // brun chaud
	'#a9745a', // brun clair
	'#e2b77b', // blond foncé
	'#d8bfd8', // lavande pastel (fantaisie)
	'#fff0b3', // blond très clair
	'#ffff00', // super sayian
	'#aeff00', // broly
	'#32cd32', // vert lime
	'#00ced1', // turquoise
	'#7fa0ff', // bleu clair
	'#0033e5', // bleu foncé
	'#6a5acd', // violet électrique
	'#900000', // rouge foncé
	'#c71585', // magenta foncé
	'#ff69b4', // rose flashy
	'#ff6e6e', // saumon
	'#d2691e', // roux foncé
];

export const boardPalette: Array<any> = [
	'#d34b4b',
	'#b09946',
	'#36a746',
	'#3382ac',
	'#a86ccb',
	'#ffd89b',
	'#d56f15',
	'#0019aa64',
];

export function createSvg(avatar: Avatar): string {
	const options: Partial<adventurer.Options & Opt> = {};

	options.hairColor = [avatar.hairColor];
	options.skinColor = [avatar.skinColor];
	options.mouth = [properties.mouth.default[avatar.mouth]];
	options.hair = [properties.hair.default[avatar.hair]];
	options.eyebrows = [properties.eyebrows.default[avatar.eyebrows]];
	options.eyes = [properties.eyes.default[avatar.eyes]];
	options.earrings = [properties.earrings.default[avatar.earrings]];
	options.glasses = [properties.glasses.default[avatar.glasses]];
	options.features = [properties.features.default[avatar.features]];
	options.glassesProbability = 100;
	options.featuresProbability = 100;
	options.earringsProbability = 100;
	options.hairProbability = 100;
	return createAvatar(adventurer, options).toString();
}

export function groupeDuplicatedHairColor(avatars: Avatar[]) {
	// check player with same hair color
	const grouped = Object.values(
		avatars.reduce((acc: any, player: Avatar) => {
			const color = player.hairColor;
			acc[color] = acc[color] || [];
			acc[color].push(player);
			return acc;
		}, {})
	);

	//remove not grouped avatar
	const groupedOnly = grouped.filter((group: any) => group.length > 1);
	return groupedOnly;
}

export function fixDuplicateHairColors(avatars: Avatar[]) {
	const colorsUsed = new Set(avatars.map((player: Avatar) => player.hairColor));
	const grouped = groupeDuplicatedHairColor(avatars);
	//then change one of those duplicate
	const playersWithChangedColor: Avatar[] = [];
	grouped.forEach((group: any) => {
		for (let i = 1; i < group.length; i++) {
			const paletteAvailable = _.filter(
				hairPalette.map((color) => color.replace('#', '')),
				(color) => !colorsUsed.has(color)
			);
			const randomIndex = _.random(0, paletteAvailable.length - 1, false);
			const nextColor = paletteAvailable[randomIndex];
			colorsUsed.add(nextColor);
			const player = group[i];
			player.hairColor = nextColor;
			player.image = createSvg(player);
			playersWithChangedColor.push(player);
		}
	});
	return playersWithChangedColor;
}


export function getBackgroundStyle(boardConf = '', boardColor = '#8e6beeab') {
    if (boardConf === 'bgCustom') {
        return { background: boardColor };
    }
    return {};
}
