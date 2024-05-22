import { Devvit } from '@devvit/public-api';
import { getThemedColors, Theme } from '../utils/getThemedColors.js';

export type LiveBadgeProps = {
  isLive: boolean;
  theme: Theme;
};

export const LiveBadge = (props: LiveBadgeProps): JSX.Element => {
  const { isLive, theme } = props;
  const themedColor = getThemedColors(theme);

  return (
    <hstack
      alignment="center middle"
      backgroundColor={
        isLive
          ? themedColor('live-badge-live-background')
          : themedColor('live-badge-ended-background')
      }
      cornerRadius="small"
      height="24px"
    >
      <spacer size="small" />
      <text
        size="medium"
        weight="bold"
        color={
          isLive
            ? themedColor('live-badge-live-text')
            : themedColor('live-badge-ended-text')
        }
        selectable={false}
      >
        {isLive ? 'LIVE' : 'ENDED'}
      </text>
      <spacer size="small" />
    </hstack>
  );
};
