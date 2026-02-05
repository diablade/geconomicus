export function hexToRgb(hex: string): string {
	// Remove the # symbol if present
	hex = hex.replace(/^#/, '');

	// Parse the hex value to an integer
	const hexValue = parseInt(hex, 16);

	// Extract the red, green, and blue components
	const red = (hexValue >> 16) & 255;
	const green = (hexValue >> 8) & 255;
	const blue = hexValue & 255;

	// Create the RGB string
	return `rgba(${red}, ${green}, ${blue},1)`;
}

export function getRandomColor(): string {
	const r = Math.floor(Math.random() * 256);
	const g = Math.floor(Math.random() * 256);
	const b = Math.floor(Math.random() * 256);
	return `rgba(${r}, ${g}, ${b}, ${0.6})`;
}

export function getBackgroundStyle(boardConf: string, boardColor: string | undefined): {} {
	switch (boardConf) {
		case "bank":
			return {"background-color": "#ffd89b"};
		case "green":
			return {"background-image": "url('/assets/images/green-carpet.jpg')"};
		case "custom":
			return {"background": boardColor};
		case "gradien1":
			return {"background": "linear-gradient(109.6deg, rgba(83, 94, 161, 1) 44.5%, rgba(188, 14, 107, 1) 100.2%)"};
		case "gradien2":
			return {"background": "linear-gradient(111.9deg, #19547b, #ffd89b)"};
		case "gradien3":
			return {"background": "linear-gradient(to bottom, #fddf62 0.000%, #fc9088 50.000%, #ff59d1 100.000%)"};
		case "gradien4":
			return {"background": "conic-gradient(from 11.1deg, rgba(0,40,70,1) -4.8%, rgba(255, 115, 115, 1) 82.7%, rgba(255, 175, 123, 1) 97.2%)"};
		case "gradien5":
			return {"background": "linear-gradient(111.9deg, rgba(255, 255, 169, 1) 0.2%, rgba(255, 208, 120, 1) 14.1%, rgba(255, 156, 94, 1) 27.4%, rgba(251, 99, 95, 1) 41.4%, rgba(226, 28, 114, 1) 55.8%, rgba(176, 0, 140, 1) 65.2%, rgba(83, 0, 166, 1) 88.1%)"};
		case "gradien6":
			return {"background": "linear-gradient(20.5deg, #ffd89b 0.000%, #fc9088 50.000%, #090152 100.000%)"};
		case "wood":
		default:
			return {"background-image": "url('/assets/images/woodJapAlt.jpg')"};
	}
}

