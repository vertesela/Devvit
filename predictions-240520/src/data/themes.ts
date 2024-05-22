// Global colors
const white = 'white';
const black = 'black';

// Unicorn constants
const neutralDefault = 'coolgray-900';
const neutralWeak = '#E0E0E0';
const neutralWeaker = '#BDBDBD';
const neutralWeakest = '#9E9E9E';
const magentaDefault = '#FF459A';
const purpleDefault = '#532DA2';
const purpleWeak = '#7E53C1';
const purpleWeaker = '#C676FF';

export const themes = {
  reddit: {
    colors: {
      background: 'neutral-background',
      'neutral-border': 'neutral-border',
      'content-disabled': 'interactive-content-disabled',

      highlight: 'primary-background',
      'border-weak': 'neutral-border-weak',
      'avatar-background': 'neutral-background',
      'progress-bar-background': '#532DA2',
      'scrim-background': 'rgba(0,0,0,0.8)',
      'modal-background': 'neutral-background',
      'text-strong': 'neutral-content-strong',
      text: 'neutral-content',
      'text-weak': 'neutral-content-weak',
      'secondary-background': 'secondary-background',
      'button-background': 'primary-background',
      'button-text': white,
      'live-badge-live-text': white,
      'live-badge-live-background': 'danger-background',
      'live-badge-ended-text': 'neutral-content-weak',
      'live-badge-ended-background': 'neutral-background',
    },
    buttons: {
      cornerRadius: 'small',
    },
  },
  unicorn: {
    colors: {
      background: 'coolgray-800',
      'neutral-border': 'neutral-border',
      'content-disabled': 'rgba(255, 255, 255, 0.2)',

      highlight: magentaDefault,
      'border-weak': 'rgba(255, 255, 255, 0.2)',
      'avatar-background': 'coolgray-700',
      'progress-bar-background': purpleDefault,
      'scrim-background': 'rgba(14, 17, 19, 0.8)',
      'modal-background': 'coolgray-650',
      'text-strong': white,
      text: 'coolgray-200',
      'text-weak': 'coolgray-400',
      'secondary-background': 'coolgray-650',
      'button-background': magentaDefault,
      'button-text': white,
      'live-badge-live-text': white,
      'live-badge-live-background': magentaDefault,
      'live-badge-ended-text': black,
      'live-badge-ended-background': white,
    },
    buttons: {
      cornerRadius: 'full',
    },
  },
};

export type Theme = keyof typeof themes;

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
