import { Devvit } from '@devvit/public-api';
import { getThemedColors, Theme } from '../utils/getThemedColors.js';

export type WalletProps = {
  balance?: number;
  onPress?: () => void;
  settings: {
    tokenSymbol: string;
    theme: string;
  };
  theme: Theme;
};

export const Wallet = (props: WalletProps): JSX.Element => {
  const { balance = 0, onPress, settings, theme } = props;
  const themedColor = getThemedColors(theme);
  return (
    <hstack
      height="32px"
      alignment="center middle"
      border="thin"
      borderColor={themedColor('button-background')}
      cornerRadius="small"
      padding="small"
      gap="small"
      onPress={onPress}
    >
      <image
        url={settings.tokenSymbol}
        imageHeight={256}
        imageWidth={256}
        height="20px"
        width="20px"
        description="Token symbol"
      />
      <text
        size="large"
        weight="bold"
        color={themedColor('text-strong')}
        selectable={false}
      >
        {balance.toLocaleString()}
      </text>
    </hstack>
  );
};
