import { Devvit } from '@devvit/public-api';
import { getThemedColors, Theme } from '../utils/getThemedColors.js';

export type ModalProps = {
  children: JSX.Element;
  onClose?: () => void;
  theme: Theme;
};

export const Modal = (props: ModalProps): JSX.Element => {
  const { children, onClose, theme } = props;
  const themedColor = getThemedColors(theme);
  return (
    <zstack width="100%" height="100%" alignment="center middle">
      {/* Scrim */}
      <hstack
        width="100%"
        height="100%"
        backgroundColor={themedColor('scrim-background')}
        onPress={onClose}
      />

      {/* Modal */}
      <vstack
        width="300px"
        height="400px"
        backgroundColor={themedColor('modal-background')}
        cornerRadius="small"
        padding="medium"
      >
        {children}
      </vstack>
    </zstack>
  );
};
