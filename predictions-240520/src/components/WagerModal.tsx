import { Context, Devvit, FormKey } from '@devvit/public-api';
import { Modal } from './Modal.js';
import { Wallet } from './Wallet.js';
import { Button } from './Button.js';
import { getThemedColors, Theme } from '../utils/getThemedColors.js';

export type WagerModalProps = {
  option?: string;
  balance: number;
  wager: number;
  wagerChangeHandler: (wager: number) => void;
  onConfirm: () => void;
  onClose: () => void;
  setSpecificWagerForm: FormKey;
  settings: {
    tokenSymbol: string;
    theme: string;
  };
  theme: Theme;
};

export const WagerModal = (
  props: WagerModalProps,
  contex: Context
): JSX.Element => {
  const {
    option = 'Loading',
    balance,
    wager,
    wagerChangeHandler,
    onConfirm,
    onClose,
    setSpecificWagerForm,
    settings,
    theme,
  } = props;

  const themedColor = getThemedColors(theme);
  const balanceAfterWager = balance - wager;
  const canDecrement = wager > 0;
  const canIncrement = balanceAfterWager >= 5;

  return (
    <Modal onClose={onClose} theme={theme}>
      <vstack height="100%" width="100%">
        {/* header */}
        <hstack alignment="middle">
          <hstack
            height="40px"
            width="40px"
            alignment="center middle"
            onPress={onClose}
          >
            <icon
              color={themedColor('text-weak')}
              size="medium"
              name="close-fill"
            />
          </hstack>
          <spacer size="small" grow />

          <Wallet
            balance={balance - wager}
            settings={settings}
            onPress={() => {
              // Clicking the wallet = Go all in
              wagerChangeHandler(balance);
            }}
            theme={theme}
          />
        </hstack>

        <spacer size="large" grow />

        {/* Picked option */}
        <text
          width="100%"
          wrap
          style="heading"
          size="xxlarge"
          weight="bold"
          color={themedColor('text-strong')}
          alignment="center"
          overflow="ellipsis"
          selectable={false}
        >
          {option}
        </text>

        <spacer size="large" grow />

        {/* Points bar */}
        <hstack gap="medium" alignment="center middle" width="100%">
          <hstack
            height="40px"
            width="40px"
            alignment="center middle"
            cornerRadius="small"
            onPress={
              canDecrement ? () => wagerChangeHandler(wager - 5) : undefined
            }
          >
            <icon
              color={
                canDecrement
                  ? themedColor('button-background')
                  : themedColor('content-disabled')
              }
              size="large"
              name="subtract-fill"
            />
          </hstack>
          <hstack
            alignment="center middle"
            backgroundColor={themedColor('background')}
            border="thin"
            borderColor={themedColor('border-weak')}
            cornerRadius="small"
            height="56px"
            gap="small"
            padding="medium"
            onPress={() => contex.ui.showForm(setSpecificWagerForm)}
          >
            <image
              url={settings.tokenSymbol}
              imageHeight={256}
              imageWidth={256}
              height="32px"
              width="32px"
              description="Token symbol"
            />
            <text
              style="heading"
              size="xxlarge"
              color={themedColor('text-strong')}
              weight="bold"
              selectable={false}
            >
              {wager.toLocaleString()}
            </text>
          </hstack>
          <hstack
            height="40px"
            width="40px"
            alignment="center middle"
            cornerRadius="small"
            onPress={
              canIncrement ? () => wagerChangeHandler(wager + 5) : undefined
            }
          >
            <icon
              color={
                canIncrement
                  ? themedColor('button-background')
                  : themedColor('content-disabled')
              }
              size="large"
              name="add-fill"
            />
          </hstack>
        </hstack>

        <spacer size="large" />

        {/* Prediction button */}
        <Button onPress={onConfirm} theme={theme}>
          Predict
        </Button>
      </vstack>
    </Modal>
  );
};
