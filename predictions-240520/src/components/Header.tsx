import { Devvit } from '@devvit/public-api';
import { LiveBadge } from './LiveBadge.js';
import { shortenNumber } from '../utils/shortenNumber.js';
import { getThemedColors, Theme } from '../utils/getThemedColors.js';

export type HeaderProps = {
  title?: string;
  playerCount?: number;
  active?: boolean;
  open?: boolean;
  onPress?: () => void;
  theme: Theme;
};

export const Header = (props: HeaderProps): JSX.Element => {
  const {
    title = 'Offline',
    playerCount = 0,
    active = false,
    open = false,
    onPress,
    theme,
  } = props;
  const themedColor = getThemedColors(theme);

  return (
    <hstack
      width="100%"
      height="56px"
      alignment="middle"
      backgroundColor={themedColor('secondary-background')}
      onPress={onPress}
    >
      <spacer size="medium" />
      <vstack height="100%" alignment="middle" grow>
        <text
          style="heading"
          color={themedColor('text-strong')}
          weight="bold"
          size="large"
          overflow="ellipsis"
          selectable={false}
          maxWidth="100%"
        >
          {title}
        </text>
        <text
          color={themedColor('text')}
          style="heading"
          maxWidth="100%"
          size="large"
          weight="regular"
          overflow="ellipsis"
          selectable={false}
        >
          {`${shortenNumber(playerCount)} player${
            playerCount !== 1 ? 's' : ''
          } predicting`}
        </text>
      </vstack>
      <spacer size="medium" />
      <LiveBadge isLive={active} theme={theme} />
      <spacer size="small" />
      <hstack height="40px" width="40px" alignment="center middle">
        <icon
          color={themedColor('text-strong')}
          size="medium"
          name={open ? 'close-fill' : 'down-fill'}
        />
      </hstack>
      <spacer size="small" />
    </hstack>
  );
};
