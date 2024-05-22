import { Devvit } from '@devvit/public-api';
import { Option } from '../types/Option.js';
import { shortenNumber } from '../utils/shortenNumber.js';
import { getThemedColors, Theme } from '../utils/getThemedColors.js';

export type OptionBarProps = {
  option: Option;
  totalVotes: number;
  reveal?: boolean;
  onPress?: (option: Option) => void;
  correct: boolean;
  theme: Theme;
};

export const OptionBar = (props: OptionBarProps): JSX.Element => {
  const { option, totalVotes, reveal = false, onPress, correct, theme } = props;
  const { label, votes = 0 } = option;
  const themedColor = getThemedColors(theme);

  const percentage =
    totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;

  return (
    <zstack
      width="100%"
      height="12.5%"
      onPress={onPress ? () => onPress(option) : undefined}
      cornerRadius="small"
      backgroundColor={themedColor('secondary-background')}
      alignment="top start"
    >
      {/* Progress bar */}
      {reveal && percentage > 1 && (
        <hstack
          height="100%"
          width={`${percentage}%`}
          backgroundColor={themedColor('progress-bar-background')}
          alignment="end"
        >
          {/* Leading edge highlight */}
          {/* <hstack height="100%" width="1px" backgroundColor="#7E53C1" /> */}
        </hstack>
      )}

      {/* Content */}
      <hstack height="100%" width="100%" alignment="middle">
        <spacer size="medium" />
        {correct && (
          <>
            <hstack
              height="24px"
              width="24px"
              cornerRadius="full"
              backgroundColor={themedColor('button-background')}
              alignment="center middle"
            >
              <icon
                name="contest-fill"
                size="small"
                color={themedColor('button-text')}
              />
            </hstack>
            <spacer size="small" />
          </>
        )}
        <text
          style="heading"
          size="large"
          weight="bold"
          color={themedColor('text-strong')}
          overflow="ellipsis"
          selectable={false}
          grow
        >
          {label}
        </text>
        <spacer size="medium" />
        {reveal && (
          <hstack height="100%" alignment="middle">
            {votes > 0 && (
              <>
                <text
                  size="large"
                  weight="regular"
                  color={themedColor('text')}
                  selectable={false}
                >
                  {shortenNumber(votes)}
                </text>
                <spacer size="small" />
                <icon
                  name={votes === 1 ? 'user-fill' : 'users-fill'}
                  size="small"
                  color={themedColor('button-background')}
                />
                <spacer size="small" />
              </>
            )}
            <text
              size="large"
              weight="bold"
              color={themedColor('text')}
              selectable={false}
            >
              {percentage}
            </text>
            <spacer size="xsmall" width="1px" />
            <text
              size="large"
              weight="regular"
              color={themedColor('text-weak')}
              selectable={false}
            >
              %
            </text>
            <spacer size="medium" />
          </hstack>
        )}
      </hstack>
    </zstack>
  );
};
