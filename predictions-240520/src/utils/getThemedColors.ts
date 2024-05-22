import { Devvit } from '@devvit/public-api';
import { themes } from '../data/themes.js';

export type Theme = keyof typeof themes;
export type Color = keyof (typeof themes)['reddit']['colors'];

export function getThemedColors(
  theme: Theme
): (color: Color) => Devvit.Blocks.ColorString {
  return (color) => themes[theme].colors[color] || '#FF4500';
}

/*

  "unicorn": {
    "neutral": {
      "default": "coolgray-900",
      "weak": "#E0E0E0",
      "weaker": "#BDBDBD",
      "weakest": "#9E9E9E"
    },
    "magenta": {
      "default": "#FF459A",
      "weak": "#FF85C6",
      "weaker": "#FF94C0",
      "weakest": "#FFC2DD"
    },
    "purple": {
      "default": "#532DA2",
      "weak": "#7E53C1",
      "weaker": "#C676FF"
    }
  },

*/
