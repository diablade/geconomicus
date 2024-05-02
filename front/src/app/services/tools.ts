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

