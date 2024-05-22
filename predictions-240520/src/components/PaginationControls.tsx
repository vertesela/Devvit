import { Devvit } from '@devvit/public-api';
import { getThemedColors, Theme } from '../utils/getThemedColors.js';

type PaginationControlsProps = {
  onPrevious?: () => void;
  onNext?: () => void;
  theme: Theme;
};

export const PaginationControls = (
  props: PaginationControlsProps
): JSX.Element => {
  const { onPrevious, onNext, theme } = props;
  const themedColor = getThemedColors(theme);

  const isPreviousActive = onPrevious !== undefined;
  const isNextActive = onNext !== undefined;
  const color = {
    default: themedColor('text-strong'),
    disabled: themedColor('content-disabled'),
  };

  return (
    <hstack>
      <hstack
        height="40px"
        width="40px"
        alignment="center middle"
        onPress={onPrevious}
      >
        <icon
          color={isPreviousActive ? color.default : color.disabled}
          name="back-fill"
        />
      </hstack>
      <spacer size="xsmall" />
      <hstack
        height="40px"
        width="40px"
        alignment="center middle"
        onPress={onNext}
      >
        <icon
          color={isNextActive ? color.default : color.disabled}
          size="medium"
          name="forward-fill"
        />
      </hstack>
    </hstack>
  );
};
