import { Devvit } from '@devvit/public-api';
import { formatTimeLeft } from '../utils/formatTimeLeft.js';
import { getThemedColors, Theme } from '../utils/getThemedColors.js';

type QuestionProps = {
  title: string;
  tokens: number;
  ends: number;
  ended: boolean;
  unanswered: boolean;
  onPress: () => void;
  settings: {
    tokenSymbol: string;
    theme: string;
  };
  theme: Theme;
};

export const Question = (props: QuestionProps): JSX.Element => {
  const { title, tokens, ends, ended, unanswered, onPress, settings, theme } =
    props;
  const themedColor = getThemedColors(theme);

  // Calculate time left
  const millisecondsLeft = ends ? ends - Date.now() : 0;
  const timeLeft = formatTimeLeft(millisecondsLeft);

  return (
    <vstack
      height="33.33%"
      width="100%"
      padding="medium"
      backgroundColor={themedColor('background')}
      cornerRadius="small"
      onPress={onPress}
      border="thin"
      borderColor={unanswered ? themedColor('highlight') : 'transparent'}
    >
      <text
        grow
        width="100%"
        wrap
        overflow="ellipsis"
        size="large"
        weight="bold"
        color={themedColor('text-strong')}
        selectable={false}
      >
        {title}
      </text>

      <spacer size="medium" />

      {/* Metadata */}
      <hstack alignment="start middle" width="100%" gap="small">
        <image
          url={settings.tokenSymbol}
          imageHeight={256}
          imageWidth={256}
          height="28px"
          width="28px"
          description="Token symbol"
        />
        <text
          size="large"
          color={themedColor('text')}
          weight="bold"
          selectable={false}
        >
          {`${tokens} prize`}
        </text>
        {/* Divider */}
        <hstack
          backgroundColor={themedColor('button-background')}
          height="6px"
          width="6px"
          cornerRadius="full"
        />
        <text size="large" color={themedColor('text')} selectable={false} grow>
          {timeLeft}
        </text>
        <icon
          name="external-fill"
          size="small"
          color={themedColor('content-disabled')}
        />
        <spacer width="2px" />
      </hstack>
    </vstack>
  );
};
