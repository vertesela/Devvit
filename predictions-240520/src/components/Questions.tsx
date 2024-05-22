import { Context, Devvit } from '@devvit/public-api';
import { TournamentQuestion } from '../types/TournamentQuestion.js';
import { Question } from './Question.js';
import { PaginationControls } from './PaginationControls.js';
import { getThemedColors, Theme } from '../utils/getThemedColors.js';
import { shortenNumber } from '../utils/shortenNumber.js';

type QuestionsProps = {
  questions: TournamentQuestion[];
  offset: number;
  setOffset: (offset: number) => void;
  settings: {
    theme: string;
    tokenSymbol: string;
  };
  theme: Theme;
  userTokens: number;
};

export const Questions = (
  props: QuestionsProps,
  context: Context
): JSX.Element => {
  const { questions, offset, setOffset, settings, theme, userTokens } = props;
  const { ui, reddit } = context;
  const themedColor = getThemedColors(theme);

  // Pagination
  const questionCount = questions.length;
  const windowSize = 3;
  const windowStart = offset;
  const windowEnd = offset + windowSize;
  const questionsWindow = questions.slice(windowStart, windowEnd);
  const isPreviousActive = windowStart > 0;
  const isNextActive = windowEnd < questionCount;

  const beforeWindowCount = windowStart > windowSize ? windowSize : windowStart;
  const afterWindowCount =
    questionCount - windowEnd > windowSize
      ? windowSize
      : questionCount - windowEnd;

  return (
    <vstack width="100%" grow>
      <spacer size="medium" />

      {questionsWindow.length > 0 && (
        <hstack width="100%" grow>
          {beforeWindowCount > 0 && (
            <vstack height="100%" width="16px" gap="small" alignment="end">
              {Array.from({ length: windowSize }).map((_value, index) => (
                <hstack
                  height="33.33%"
                  width="200%"
                  backgroundColor={
                    beforeWindowCount > index
                      ? themedColor('background')
                      : 'transparent'
                  }
                  cornerRadius="small"
                />
              ))}
            </vstack>
          )}
          <spacer size="medium" />
          <vstack height="100%" grow width="100%" gap="small">
            {questionsWindow.map((question) => (
              <Question
                title={question.title}
                tokens={question.tokens}
                ended={question.ended}
                ends={question.ends}
                settings={settings}
                unanswered={
                  question.user?.hasPredicted === false && !question.ended
                }
                onPress={async () => {
                  const targetPost = await reddit.getPostById(question.postId);
                  ui.navigateTo(targetPost);
                }}
                theme={theme}
              />
            )) || []}

            {/* Filler elements to ensure same height */}
            {questionsWindow.length > 0 &&
              questionsWindow.length < windowSize &&
              Array.from({ length: windowSize - questionsWindow.length }).map(
                (_value, _index) => (
                  <hstack
                    height="33.33%"
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
                  height="33.33%"
                  width="200%"
                  backgroundColor={
                    afterWindowCount > index
                      ? themedColor('background')
                      : 'transparent'
                  }
                  cornerRadius="small"
                />
              ))}
            </vstack>
          )}
        </hstack>
      )}

      {/* Empty state */}
      {questionsWindow.length === 0 && (
        <vstack width="100%" grow gap="small" alignment="center middle">
          <image
            imageHeight={512}
            imageWidth={512}
            height="200px"
            width="200px"
            url="no-questions.png"
            description="illustration"
          />
          <vstack width="100%" alignment="center">
            <text size="large" weight="bold" color={themedColor('text-strong')}>
              There's nothing here
            </text>
            <text size="large" color={themedColor('text')}>
              Check back later...
            </text>
          </vstack>
        </vstack>
      )}

      {/* Footer */}
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
        <spacer size="small" grow />
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
