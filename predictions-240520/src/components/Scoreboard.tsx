import { Devvit } from '@devvit/public-api';
import { ScoreboardEntry } from '../types/ScoreboardEntry.js';
import { ScoreboardRow } from './ScoreboardRow.js';
import { getThemedColors, Theme } from '../utils/getThemedColors.js';
import { shortenNumber } from '../utils/shortenNumber.js';

type ScoreboardProps = {
  scores: ScoreboardEntry[];
  settings: {
    tokenSymbol: string;
    theme: string;
  };
  theme: Theme;
  userTokens: number;
};

export const Scoreboard = (props: ScoreboardProps): JSX.Element => {
  const { scores, settings, theme, userTokens } = props;
  const themedColor = getThemedColors(theme);

  return (
    <vstack width="100%" grow>
      <spacer size="medium" />

      <hstack width="100%" grow>
        <spacer size="medium" />

        <vstack
          grow
          backgroundColor={themedColor('background')}
          cornerRadius="small"
        >
          <spacer size="small" />
          {scores.map((entry: ScoreboardEntry) => (
            <ScoreboardRow
              username={entry.username}
              avatar={entry.avatar}
              rank={entry.rank}
              score={entry.score}
              settings={settings}
              theme={theme}
            />
          ))}
          <spacer size="small" />
        </vstack>
        <spacer size="medium" />
      </hstack>

      <hstack height="56px" width="100%" alignment="middle">
        <spacer size="medium" />
        <text color={themedColor('text')} size="large" selectable={false}>
          You have:
        </text>
        <spacer size="xsmall" />
        <image
          url={settings.tokenSymbol}
          imageHeight={256}
          imageWidth={256}
          height="28px"
          width="28px"
          description="Token symbol"
        />
        <spacer size="xsmall" />
        <text color={themedColor('text')} size="large" selectable={false}>
          {shortenNumber(userTokens)}
        </text>
        <spacer size="medium" grow />
      </hstack>
    </vstack>
  );
};
