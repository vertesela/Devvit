import { Devvit } from '@devvit/public-api';
import { OptionBar } from './OptionBar.js';
import { PaginationControls } from './PaginationControls.js';
import { Option } from '../types/Option.js';
import { formatTimeLeft } from '../utils/formatTimeLeft.js';
import { shortenNumber } from '../utils/shortenNumber.js';
import { getThemedColors, Theme } from '../utils/getThemedColors.js';

type OptionsProps = {
  options: Option[];
  correctOption?: string | null;
  tokens: number;
  totalVotes: number;
  offset: number;
  setOffset: (offset: number) => void;
  reveal: boolean;
  ends?: number;
  ended: boolean;
  onOptionPress: (option: Option) => void;
  isModerator: boolean;
  settings: {
    theme: string;
    tokenSymbol: string;
  };
  theme: Theme;
};

export const Options = (props: OptionsProps): JSX.Element => {
  const {
    options,
    correctOption,
    tokens,
    totalVotes,
    offset,
    setOffset,
    reveal,
    ends,
    ended,
    onOptionPress,
    isModerator,
    settings,
    theme,
  } = props;

  const themedColor = getThemedColors(theme);

  if (reveal) {
    // Sort options by votes
    options.sort((a, b) => b.votes - a.votes);
  }

  // Pagination
  const optionCount = options.length;
  const windowSize = 8;
  const windowStart = offset;
  const windowEnd = offset + windowSize;
  const optionsWindow = options.slice(windowStart, windowEnd);
  const isPreviousActive = windowStart > 0;
  const isNextActive = windowEnd < optionCount;

  // Calculate time left
  const millisecondsLeft = ends ? ends - Date.now() : 0;
  const timeLeft = formatTimeLeft(millisecondsLeft);

  const timeLeftMessage = (): string => {
    const isOngoing = timeLeft !== 'ended';
    if (isOngoing) {
      return timeLeft;
    }

    const endedButNotResolved = ended && !correctOption;
    if (endedButNotResolved) {
      return 'Ended. Awaiting result';
    }

    return 'Ended';
  };

  // Option overflow hinting

  const beforeWindowCount = windowStart > windowSize ? windowSize : windowStart;
  const afterWindowCount =
    optionCount - windowEnd > windowSize ? windowSize : optionCount - windowEnd;

  return (
    <vstack grow width="100%">
      {/* List of options */}
      <spacer size="medium" />
      <hstack width="100%" grow>
        {beforeWindowCount > 0 && (
          <vstack height="100%" width="16px" gap="small" alignment="end">
            {Array.from({ length: windowSize }).map((_value, index) => (
              <hstack
                height="12.5%"
                width="200%"
                backgroundColor={
                  beforeWindowCount > index
                    ? themedColor('secondary-background')
                    : 'transparent'
                }
                cornerRadius="small"
              />
            ))}
          </vstack>
        )}
        <spacer size="medium" />
        <vstack gap="small" grow>
          {optionsWindow.map((option: Option) => {
            return (
              <OptionBar
                option={option}
                totalVotes={totalVotes}
                onPress={(option: Option) => onOptionPress(option)}
                reveal={reveal}
                correct={
                  option.id === correctOption && correctOption !== undefined
                }
                theme={theme}
              />
            );
          })}

          {/* Filler elements to ensure same height */}
          {optionsWindow.length > 0 &&
            optionsWindow.length < windowSize &&
            Array.from({ length: windowSize - optionsWindow.length }).map(
              (_value, _index) => (
                <hstack
                  height="12.5%"
                  width="100%"
                  backgroundColor="transparent"
                />
              )
            )}
        </vstack>
        <spacer size="medium" />
        {afterWindowCount > 0 && (
          <vstack height="100%" width="16px" gap="small" alignment="start">
            {Array.from({ length: windowSize }).map((_value, index) => (
              <hstack
                height="12.5%"
                width="200%"
                backgroundColor={
                  afterWindowCount > index
                    ? themedColor('secondary-background')
                    : 'transparent'
                }
                cornerRadius="small"
              />
            ))}
          </vstack>
        )}
      </hstack>

      {/* Metadata and pagination row */}
      <hstack height="56px" width="100%" alignment="middle">
        <spacer size="medium" />
        {/* Prompt for moderators to resolve ended prediction */}
        {!correctOption && ended && isModerator && (
          <>
            <icon
              name="warning-fill"
              size="large"
              color={themedColor('text-strong')}
            />
            <spacer size="small" />
            <text
              size="large"
              weight="bold"
              color={themedColor('text-strong')}
              selectable={false}
              grow
            >
              Ended. Select the outcome
            </text>
          </>
        )}

        {!(!correctOption && ended && isModerator) && (
          <>
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
              {`${shortenNumber(tokens)} prize`}
            </text>
            <spacer size="small" />
            <hstack
              backgroundColor={themedColor('button-background')}
              height="6px"
              width="6px"
              cornerRadius="full"
            />
            <spacer size="small" />
            <text
              color={themedColor('text-weak')}
              size="large"
              overflow="ellipsis"
              selectable={false}
              grow
            >
              {timeLeftMessage()}
            </text>
          </>
        )}

        <spacer size="medium" />

        <PaginationControls
          theme={theme}
          onNext={
            isNextActive
              ? () => {
                  setOffset(offset + windowSize);
                }
              : undefined
          }
          onPrevious={
            isPreviousActive
              ? () => {
                  setOffset(offset - windowSize);
                }
              : undefined
          }
        />
        <spacer size="small" />
      </hstack>
    </vstack>
  );
};
