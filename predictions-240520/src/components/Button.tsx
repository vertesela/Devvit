import { Devvit } from '@devvit/public-api';
import { getThemedColors, Theme } from '../utils/getThemedColors.js';

export type ButtonProps = {
  children: string;
  width?: 'fill' | 'hug';
  onPress?: () => void;
  theme: Theme;
};

export const Button = ({
  children = 'label',
  width = 'fill',
  onPress,
  theme,
}: ButtonProps): JSX.Element => {
  const themedColor = getThemedColors(theme);
  return (
    <hstack
      height="40px"
      width={width ? '100%' : undefined}
      alignment="center middle"
      backgroundColor={themedColor('button-background')}
      cornerRadius="small"
      onPress={onPress}
    >
      <text
        size="large"
        weight="bold"
        color={themedColor('button-text')}
        selectable={false}
      >
        {children}
      </text>
    </hstack>
  );
};
