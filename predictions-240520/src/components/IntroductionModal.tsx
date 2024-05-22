import { Devvit } from '@devvit/public-api';
import { Modal } from './Modal.js';
import { Button } from './Button.js';
import { getThemedColors, Theme } from '../utils/getThemedColors.js';

export type IntroductionModalProps = {
  tournamentName: string;
  tournamentTokens: number;
  onContinue: () => void;
  onClose: () => void;
  theme: Theme;
};

export const IntroductionModal = (
  props: IntroductionModalProps
): JSX.Element => {
  const { tournamentName, tournamentTokens, onContinue, onClose, theme } =
    props;

  const themedColor = getThemedColors(theme);
  return (
    <Modal onClose={onClose} theme={theme}>
      <vstack height="100%" width="100%" alignment="center">
        <text
          width="100%"
          alignment="center"
          size="large"
          color={themedColor('text')}
          selectable={false}
          overflow="ellipsis"
        >
          {tournamentName}
        </text>
        <text
          width="100%"
          alignment="center"
          size="xlarge"
          weight="bold"
          color={themedColor('text-strong')}
          selectable={false}
          overflow="ellipsis"
        >
          Predictions Tournament
        </text>

        <spacer grow />
        <image
          url="illustration-2.png"
          imageHeight={512}
          imageWidth={512}
          height="150px"
          width="150px"
          resizeMode="fit"
          description="Illustration of a Predictor riding a unicorn while holding a staff."
        />
        <spacer size="medium" />
        <text
          width="100%"
          alignment="center"
          size="large"
          color={themedColor('text')}
          selectable={false}
          wrap
        >
          {`Everyone starts with ${
            tournamentTokens.toLocaleString() || 'a few'
          } tokens to make predictions and climb the
          leaderboard. Good luck!`}
        </text>
        <spacer grow />
        <Button theme={theme} onPress={onContinue}>
          Let's do this!
        </Button>
      </vstack>
    </Modal>
  );
};
