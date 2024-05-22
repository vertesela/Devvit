import { Devvit } from '@devvit/public-api';
import { getThemedColors, Theme } from '../utils/getThemedColors.js';
import { Pages } from '../types/Pages.js';

type TabsProps = {
  data: {
    label: string;
    value: Pages;
    count?: number;
  }[];
  tab: string;
  setTab: (tab: Pages) => void;
  theme: Theme;
};

export const Tabs = (props: TabsProps): JSX.Element => {
  const { data, tab, setTab, theme } = props;
  const themedColor = getThemedColors(theme);
  return (
    <hstack height="32px" width="100%" alignment="start middle">
      {data.map(({ label, value, count }) => (
        <hstack height="100%" onPress={() => setTab(value)}>
          <spacer size="medium" />
          <vstack height="100%" alignment="bottom">
            <hstack alignment="middle">
              <text
                size="large"
                weight="bold"
                color={
                  tab === value
                    ? themedColor('text-strong')
                    : themedColor('text-weak')
                }
                selectable={false}
              >
                {label}
              </text>
              {count !== undefined && count > 0 && (
                <>
                  <spacer size="small" />
                  <hstack
                    height="20px"
                    cornerRadius="small"
                    backgroundColor={themedColor('background')}
                    alignment="center middle"
                  >
                    <spacer size="xsmall" />
                    <text color={themedColor('text')} size="large">
                      {count}
                    </text>
                    <spacer size="xsmall" />
                  </hstack>
                </>
              )}
            </hstack>
            <spacer size="xsmall" />
            <hstack
              width="100%"
              height="2px"
              cornerRadius="full"
              backgroundColor={
                tab === value ? themedColor('button-background') : 'transparent'
              }
            />
          </vstack>
          <spacer size="medium" />
        </hstack>
      ))}
    </hstack>
  );
};
