import { Devvit } from '@devvit/public-api';
import { getThemedColors, Theme } from '../utils/getThemedColors.js';

type ScoreboardRowProps = {
  username: string;
  score: number;
  rank: number;
  avatar?: string;
  settings: {
    tokenSymbol: string;
    theme: string;
  };
  theme: Theme;
};

export const ScoreboardRow = (props: ScoreboardRowProps): JSX.Element => {
  const { username, score, rank, avatar, settings, theme } = props;
  const themedColor = getThemedColors(theme);

  return (
    <hstack width="100%" height="12.5%" alignment="middle">
      <spacer size="medium" />

      <text size="large" color={themedColor('text')} selectable={false}>
        {`${rank}.`}
      </text>
      <spacer size="small" />

      <hstack
        height="32px"
        width="32px"
        cornerRadius="full"
        backgroundColor={themedColor('avatar-background')}
      >
        <image
          url={avatar ?? 'default-avatar.png'}
          imageHeight={256}
          imageWidth={256}
          height="100%"
          width="100%"
          resizeMode="cover"
          description="Avatar"
        />
      </hstack>
      <spacer size="small" />

      <text
        size="large"
        color={themedColor('text-strong')}
        weight="bold"
        overflow="ellipsis"
        selectable={false}
        grow
      >
        {username}
      </text>
      <spacer size="medium" />

      <hstack alignment="middle">
        <image
          url={settings.tokenSymbol}
          imageHeight={256}
          imageWidth={256}
          height="24px"
          width="24px"
          description="Token symbol"
        />
        <spacer size="xsmall" />
        <text
          size="large"
          color={themedColor('text-strong')}
          selectable={false}
        >
          {score && score.toLocaleString()}
        </text>
      </hstack>
      <spacer size="medium" />
    </hstack>
  );
};
